import { AuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { pool, upsertUser, logActivity } from './db'
import { notifyNewSignup, notifyLogin, notifyError, sendWelcomeEmail } from './notifications'

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
        try {
          const { rows } = await pool.query(
            `SELECT id, name, email, image, role, product_access, is_active, password_hash
             FROM auth_users WHERE email = $1`,
            [credentials.email.toLowerCase()]
          )
          const user = rows[0]
          if (!user || !user.password_hash || !user.is_active) return null
          const valid = await bcrypt.compare(credentials.password, user.password_hash as string)
          if (!valid) return null
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
          await logActivity({
            user_id: dbUser.id,
            event_type: 'login',
            event_data: { email: user.email, provider: 'credentials' },
            severity: 'info',
          })
          await notifyLogin({ name: user.name ?? null, email: user.email! })
        } catch { /* non-fatal */ }
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
          await notifyLogin({ name: user.name ?? null, email: user.email! })
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

    async jwt({ token, account, user }) {
      if (account?.provider) {
        token.provider = account.provider
      }
      // Attach role + tenant from DB on first sign-in (both Google and credentials)
      if (user?.email && !token.role) {
        const { getUserByEmail } = await import('./db')
        const dbUser = await getUserByEmail(user.email)
        if (dbUser) {
          token.role = dbUser.role
          token.userId = dbUser.id
          token.productAccess = dbUser.product_access
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
            } else {
              // Auto-provision tenant for new users
              const { provisionTenantForUser } = await import('./tenant')
              const tId = await provisionTenantForUser(dbUser.id, dbUser.name ?? '', dbUser.email)
              token.tenantId   = tId
              token.tenantSlug = dbUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
              token.tenantName = dbUser.name ?? dbUser.email
              token.tenantRole = 'owner'
            }
          } catch (err) {
            console.error('[auth] tenant resolve error — continuing without tenant ctx:', err)
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
