// Who may open a page (checked in middleware/auth.global.ts). Default: signed-in players;
// admin pages must say 'admin' themselves.
declare module '#app' {
  interface PageMeta {
    auth?: 'public' | 'user' | 'admin'
  }
}

export {}
