import { readApiError } from '#layers/core/shared/errors'

/** The settings the administrator changes: for now the share of a region that counts as coloured. */
export function useAdminSettings() {
  const api = useApi()
  const { data, error, refresh } = useFetch<{ paintedTolerance: number }>('/api/admin/coloring/settings', { timeout: API_TIMEOUT_MS, key: 'admin-coloring-settings' })

  const message = ref('')
  const saving = ref(false)

  async function saveTolerance(value: number): Promise<boolean> {
    saving.value = true
    message.value = ''

    try {
      await api('/api/admin/coloring/settings', { method: 'PUT', body: { paintedTolerance: value } })
      await refresh()
      message.value = 'Сохранено.'

      return true
    } catch (failure) {
      message.value = readApiError(failure).message

      return false
    } finally {
      saving.value = false
    }
  }

  return { tolerance: computed(() => data.value?.paintedTolerance), loadError: computed(() => (error.value ? readApiError(error.value).message : '')), message, saving, saveTolerance }
}
