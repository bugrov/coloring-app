import type { ZodType } from 'zod'
import { readApiError } from '../../shared/errors'

interface CredentialsFormOptions<T extends Record<string, unknown>> {
  endpoint: string
  schema: ZodType<T>
  initial: T
  /** Where to go after the session is established. */
  redirectTo: string
}

/**
 * A form that posts to a sign-in endpoint. Input is checked with the same zod
 * schema the server uses (messages in Russian), and server errors are shown as
 * the API sends them: per field or as one message for the form.
 */
export function useCredentialsForm<T extends Record<string, unknown>>({ endpoint, schema, initial, redirectTo }: CredentialsFormOptions<T>) {
  const { fetch: refreshSession } = useUserSession()

  const values = reactive({ ...initial }) as T
  const pending = ref(false)
  const fieldErrors = ref<Record<string, string>>({})
  const formError = ref('')

  async function submit() {
    if (pending.value) return
    fieldErrors.value = {}
    formError.value = ''

    const parsed = schema.safeParse({ ...values })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) fieldErrors.value[String(issue.path[0])] ??= issue.message
      return
    }

    pending.value = true
    try {
      await $fetch(endpoint, { method: 'POST', body: parsed.data })
      await refreshSession()
      await navigateTo(redirectTo)
    }
    catch (error) {
      const { message, fields } = readApiError(error)
      fieldErrors.value = fields ?? {}
      if (!fields) formError.value = message
    }
    finally {
      pending.value = false
    }
  }

  return { values, pending, fieldErrors, formError, submit }
}
