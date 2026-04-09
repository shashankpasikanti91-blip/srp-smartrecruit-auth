import { AuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { upsertUser, logActivity } from './db'
import { notifyNewSignup, notifyLogin, notifyError } from './notifications'

export const authOptions: AuthOptions = {
  providers: [
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
      if (account?.provider === 'google') {
        token.provider = account.provider
      }
      // Attach role from DB on first sign-in
      if (user?.email && !token.role) {
        const { getUserByEmail } = await import('./db')
        const dbUser = await getUserByEmail(user.email)
        if (dbUser) {
          token.role = dbUser.role
          token.userId = dbUser.id
          token.productAccess = dbUser.product_access
        }
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.provider     = (token.provider as string) ?? 'google'
        session.user.productAccess = (token.productAccess as string[]) ?? ['recruit']
        // Include role so owner dashboard can guard itself client-side too
        ;(session.user as Record<string, unknown>).role = token.role ?? 'user'
        ;(session.user as Record<string, unknown>).userId = token.userId ?? null
      }
      return session
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}
