import { z } from 'zod'

// Validation messages that a schema does not override are in Russian.
export default defineNitroPlugin(() => {
  z.config(z.locales.ru())
})
