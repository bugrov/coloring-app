// Who may open a page (checked in middleware/auth.global.ts). Default: signed-in users;
// pages under /admin default to the admin.
declare module '#app' {
  interface PageMeta {
    auth?: 'public' | 'user' | 'admin'
  }
}

export {}
