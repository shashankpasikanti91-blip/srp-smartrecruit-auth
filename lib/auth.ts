import { AuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { pool, upsertUser, logActivity } from './db'
import { notifyNewSignup, notifyLogin, notifyError, sendWelcomeEmail } from './notifications'
import { logLogin } from './activityLog'
import { createUserSession } from './sessions'
import { isAccountLocked, recordFailedLogin, clearFailedLogins, getTenantSecuritySettings } from './passwordPolicy'

async function resolvePrimaryTenantId(userId: string): Promise<string | null> {
  try {
    const { rows } = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM tenant_members
       WHERE user_id = $1 AND invite_accepted = TRUE
       ORDER BY created_at ASC LIMIT 1`,
      [userId]
    )
    return rows[0]?.tenant_id ?? null
  } catch {
    return null
  }
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const email = credentials.email.toLowerCase()
        try {
          const { rows } = await pool.query(
            `SELECT id, name, email, image, role, product_access, is_active, password_hash,
                    locked_until, failed_login_count, mfa_enabled
             FROM auth_users WHERE email = $1`,
            [email]
          )
          const user = rows[0]
          if (!user || !user.password_hash || !user.is_active) {
            await logLogin({
              userId: user?.id ?? null,
              email,
              success: false,
              failureReason: !user ? 'unknown_user' : !user.is_active ? 'inactive' : 'no_password',
            }).catch(() => {})
            return null
          }
          if (await isAccountLocked(user.id)) {
            await logLogin({
              userId: user.id,
              email,
              success: false,
              failureReason: 'account_locked',
            }).catch(() => {})
            return null
          }
          const valid = await bcrypt.compare(credentials.password, user.password_hash as string)
          if (!valid) {
            const tenantId = await resolvePrimaryTenantId(user.id)
            const settings = tenantId ? await getTenantSecuritySettings(tenantId) : null
            const { locked } = await recordFailedLogin(
              user.id,
              settings?.max_login_attempts ?? 5,
              settings?.lock_duration_minutes ?? 30
            )
            await logLogin({
              userId: user.id,
              email,
              tenantId: tenantId ?? undefined,
              success: false,
              failureReason: locked ? 'account_locked' : 'bad_password',
            }).catch(() => {})
            if (locked && tenantId) {
              const { createNotification } = await import('./notificationCenter')
              await createNotification({
                tenantId,
                userId: user.id,
                category: 'security',
                title: 'Account locked',
                body: `Too many failed sign-in attempts. Try again in ${settings?.lock_duration_minutes ?? 30} minutes or reset your password.`,
              }).catch(() => {})
            }
            return null
          }
          await clearFailedLogins(user.id)
          return { id: user.id, name: user.name, email: user.email, image: user.image }
        } catch (err) {
          console.error('[auth] credentials error:', err)
          return null
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile',
          prompt: 'select_account',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user, account }) {
      // Credentials sign-in: user already validated in authorize(), just log activity
      if (account?.provider === 'credentials') {
        try {
          const { getUserByEmail } = await import('./db')
          const dbUser = await getUserByEmail(user.email!)
          if (!dbUser) return false
          const tenantId = await resolvePrimaryTenantId(dbUser.id)
          await logActivity({
            user_id: dbUser.id,
            event_type: 'login',
            event_data: { email: user.email, provider: 'credentials' },
            severity: 'info',
          })
          await logLogin({
            userId: dbUser.id,
            email: user.email!,
            tenantId: tenantId ?? undefined,
            success: true,
            role: dbUser.role,
          })
          ;(user as unknown as Record<string, unknown>)._tenantId = tenantId
        } catch { /* activity log non-fatal */ }
        try {
          await notifyLogin({ name: user.name ?? null, email: user.email! })
        } catch { /* owner Telegram non-fatal */ }
        return true
      }
      if (account?.provider !== 'google') return false
      try {
        const { user: dbUser, isNew } = await upsertUser({
          name: user.name,
          email: user.email!,
          image: user.image,
          provider: 'google',
          provider_id: account.providerAccountId,
        })

        if (!dbUser) return false

        // Log activity
        await logActivity({
          user_id: dbUser.id,
          event_type: isNew ? 'signup' : 'login',
          event_data: { email: user.email, provider: 'google', name: user.name },
          severity: 'info',
        })

        // Notify owner
        if (isNew) {
          await notifyNewSignup({
            name: user.name ?? null,
            email: user.email!,
            provider: 'google',
          })
          // Send welcome email to the new user
          sendWelcomeEmail({
            name: user.name ?? null,
            email: user.email!,
            provider: 'google',
          }).catch(() => {})
        } else {
          try {
            const tenantId = await resolvePrimaryTenantId(dbUser.id)
            await logLogin({
              userId: dbUser.id,
              email: user.email!,
              tenantId: tenantId ?? undefined,
              success: true,
              role: dbUser.role,
            })
          } catch { /* activity log non-fatal */ }
          try {
            await notifyLogin({ name: user.name ?? null, email: user.email! })
          } catch { /* owner Telegram non-fatal */ }
        }

        return true
      } catch (err) {
        console.error('[auth] signIn error:', err)
        await notifyError({
          message: 'signIn callback failed',
          email: user.email,
          severity: 'error',
          stack: String(err),
        }).catch(() => {})
        return false
      }
    },

    async jwt({ token, account, user, trigger }) {
      if (account?.provider) {
        token.provider = account.provider
      }
      // Attach role + tenant from DB on first sign-in, or refresh after invite accept
      const shouldResolveTenant = (user?.email && !token.role) || trigger === 'update'
      if (shouldResolveTenant) {
        const email = user?.email ?? (token.email as string | undefined)
        if (!email) return token
        const { getUserByEmail } = await import('./db')
        const dbUser = await getUserByEmail(email)
        if (dbUser) {
          token.role = dbUser.role
          token.userId = dbUser.id
          token.productAccess = dbUser.product_access
          token.email = dbUser.email
          // Resolve primary tenant membership
          try {
            const { pool } = await import('./db')
            const { rows } = await pool.query<{ tenant_id: string; tenant_slug: string; tenant_name: string; tenant_role: string }>(
              `SELECT t.id AS tenant_id, t.slug AS tenant_slug, t.name AS tenant_name, tm.role AS tenant_role
               FROM tenant_members tm
               JOIN tenants t ON t.id = tm.tenant_id
               WHERE tm.user_id = $1 AND tm.invite_accepted = TRUE AND t.is_active = TRUE
               ORDER BY tm.created_at ASC LIMIT 1`,
              [dbUser.id]
            )
            if (rows[0]) {
              token.tenantId   = rows[0].tenant_id
              token.tenantSlug = rows[0].tenant_slug
              token.tenantName = rows[0].tenant_name
              token.tenantRole = rows[0].tenant_role
            } else if (trigger !== 'update') {
              // Only provision a new tenant if the user has NO pending invites.
              // If they have a pending invite (invite_accepted = FALSE) they must
              // accept it through the invite flow — not get a phantom tenant.
              const { rows: pendingRows } = await pool.query<{ count: string }>(
                `SELECT COUNT(*) AS count FROM tenant_members
                 WHERE user_id = $1 AND invite_accepted = FALSE AND invite_expires > NOW()`,
                [dbUser.id]
              )
              const hasPendingInvite = parseInt(pendingRows[0]?.count ?? '0') > 0

              if (!hasPendingInvite) {
                const { provisionTenantForUser } = await import('./tenant')
                const tId = await provisionTenantForUser(dbUser.id, dbUser.name ?? '', dbUser.email)
                token.tenantId   = tId
                token.tenantSlug = dbUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
                token.tenantName = dbUser.name ?? dbUser.email
                token.tenantRole = 'owner'
              }
              // If hasPendingInvite: tenantId stays undefined; middleware / dashboard
              // will show the "accept your invite" prompt.
            }
          } catch (err) {
            console.error('[auth] tenant resolve error — continuing without tenant ctx:', err)
          }

          // Create tracked DB session on fresh sign-in (JWT remains source of auth)
          if (user && !token.sessionToken) {
            try {
              const sessToken = await createUserSession({
                userId: dbUser.id,
                tenantId: (token.tenantId as string) ?? null,
              })
              if (sessToken) token.sessionToken = sessToken
            } catch { /* non-fatal */ }
          }
        }
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.provider     = (token.provider as string) ?? 'google'
        session.user.productAccess = (token.productAccess as string[]) ?? ['recruit']
        ;(session.user as Record<string, unknown>).role       = token.role ?? 'user'
        ;(session.user as Record<string, unknown>).userId     = token.userId ?? null
        ;(session.user as Record<string, unknown>).tenantId   = token.tenantId ?? null
        ;(session.user as Record<string, unknown>).tenantSlug = token.tenantSlug ?? null
        ;(session.user as Record<string, unknown>).tenantName = token.tenantName ?? null
        ;(session.user as Record<string, unknown>).tenantRole = token.tenantRole ?? null
        ;(session.user as Record<string, unknown>).sessionToken = token.sessionToken ?? null
      }
      return session
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',

  // Fix: ensure OAuth state & PKCE cookies work behind nginx reverse proxy
  cookies: {
    state: {
      name: '__Secure-next-auth.state',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true, maxAge: 900 },
    },
    pkceCodeVerifier: {
      name: '__Secure-next-auth.pkce.code_verifier',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true, maxAge: 900 },
    },
  },
}
