import type { ZodType } from 'zod'
import { API_ERROR_MESSAGES, readApiError } from '../../shared/errors'
import type { CoreRoute } from '../../shared/routes'

interface CredentialsFormOptions<T extends Record<string, unknown>> {
  endpoint: string
  schema: ZodType<T>
  initial: T
  /**
   * Where to go after the session is established. The name of one of our own pages, never a value
   * from the address bar or a response: it is also used for a full page load (external navigation).
   */
  redirectTo: CoreRoute
}

interface CredentialsForm<T> {
  values: T
  pending: Ref<boolean>
  /** Messages shown under the inputs, by field name. */
  fieldErrors: Ref<Record<string, string>>
  /** A message for the form as a whole. */
  formError: Ref<string>
  submit: () => Promise<void>
}

/**
 * A form that posts to a sign-in endpoint. Input is checked with the same zod
 * schema the server uses (messages in Russian), and server errors are shown as
 * the API sends them: per field, or as one message for the form.
 */
export function useCredentialsForm<T extends Record<string, unknown>>({ endpoint, schema, initial, redirectTo }: CredentialsFormOptions<T>): CredentialsForm<T> {
  const { fetch: refreshSession } = useUserSession()
  const router = useRouter()

  const values = reactive({ ...initial }) as T
  const pending = ref(false)
  const fieldErrors = ref<Record<string, string>>({})
  const formError = ref('')

  function showServerError(error: unknown) {
    const { message, fields } = readApiError(error)
    // Only messages for inputs that exist can be shown next to them; the rest belongs to the form.
    const known = Object.entries(fields ?? {}).filter(([name]) => name in values)
    fieldErrors.value = Object.fromEntries(known)
    formError.value = known.length > 0 ? '' : (fields ? API_ERROR_MESSAGES.validation : message)
  }

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
    }
    catch (error) {
      showServerError(error)
      pending.value = false
      return
    }

    // Signed in. Only the sign-in itself can be a sign-in error; if the page cannot refresh its
    // own view of the session, a full page load (external navigation) reads it from the cookie.
    // The form stays disabled until the page leaves.
    try {
      await refreshSession()
      await navigateTo({ name: redirectTo })
    }
    catch {
      await navigateTo(router.resolve({ name: redirectTo }).href, { external: true })
    }
  }

  return { values, pending, fieldErrors, formError, submit }
}
