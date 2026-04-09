import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      provider?: string
      productAccess?: string[]
      role?: string
      userId?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    provider?: string
    productAccess?: string[]
    role?: string
    userId?: string
  }
}
