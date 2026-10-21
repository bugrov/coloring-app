// Typing of the session, as documented by nuxt-auth-utils:
// `user` is visible to the client, `secure` stays on the server.
declare module '#auth-utils' {
  interface User {
    id: string
    username: string
    /** ISO country of a player; the administrator has none. */
    country?: string
    role: 'user' | 'admin'
  }

  interface SecureSessionData {
    /** The role the server trusts. The client-visible `user.role` is only a hint for routing. */
    role: 'user' | 'admin'
  }
}

export {}
