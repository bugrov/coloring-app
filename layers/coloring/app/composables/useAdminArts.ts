import { readApiError } from '#layers/core/shared/errors'
import type { AdminArt } from '../../shared'

/** The built-in and admin arts for the administrator, and the upload of a new one. */
export function useAdminArts() {
  const api = useApi()
  const { data, status, error, refresh } = useFetch<AdminArt[]>('/api/admin/coloring/arts', { timeout: API_TIMEOUT_MS, key: 'admin-coloring-arts' })

  const arts = computed(() => data.value ?? [])
  const loadError = computed(() => (error.value ? readApiError(error.value).message : ''))
  const uploading = ref(false)
  /** What went wrong with the last upload, for the administrator; empty when nothing did. */
  const uploadError = ref('')

  /** Uploads an SVG as a draft; the id of the new art, or null with `uploadError` set. */
  async function upload(file: File): Promise<string | null> {
    uploading.value = true
    uploadError.value = ''

    try {
      const result = await api<{ id: string }>('/api/admin/coloring/arts', {
        method: 'POST',
        query: { name: file.name },
        body: await file.arrayBuffer(),
        headers: { 'Content-Type': 'image/svg+xml' },
      })

      return result.id
    } catch (failure) {
      uploadError.value = readApiError(failure).message

      return null
    } finally {
      uploading.value = false
    }
  }

  return { arts, pending: computed(() => status.value === 'pending'), loadError, refresh, uploading, uploadError, upload }
}
