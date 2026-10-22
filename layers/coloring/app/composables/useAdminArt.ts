import { readApiError } from '#layers/core/shared/errors'
import type { AdminArt, ArtStatus, ColoringArt } from '../../shared'

interface ArtDrawing {
  id: string
  title: string
  source: 'builtin' | 'admin'
  status: ArtStatus
  art: ColoringArt
}

/** One art for the administrator: its drawing, status, title and who may see it. */
export function useAdminArt(artId: Readonly<Ref<string>>) {
  const api = useApi()
  const drawing = useFetch<ArtDrawing>(() => `/api/admin/coloring/arts/${artId.value}`, { timeout: API_TIMEOUT_MS, key: () => `admin-coloring-art-${artId.value}` })
  const list = useFetch<AdminArt[]>('/api/admin/coloring/arts', { timeout: API_TIMEOUT_MS, key: 'admin-coloring-arts' })

  const details = computed(() => drawing.data.value)
  const summary = computed(() => list.data.value?.find(art => art.id === artId.value))
  const loadError = computed(() => (drawing.error.value ? readApiError(drawing.error.value).message : ''))
  const notice = ref('')
  const busy = ref(false)

  /** Runs a change and reloads what the page shows (not after a delete: that art is gone); on failure shows its message. */
  async function act(run: () => Promise<unknown>, reload = true): Promise<boolean> {
    busy.value = true
    notice.value = ''
    try {
      await run()
      if (reload) await Promise.all([drawing.refresh(), list.refresh()])
      return true
    }
    catch (failure) {
      notice.value = readApiError(failure).message
      return false
    }
    finally {
      busy.value = false
    }
  }

  const url = () => `/api/admin/coloring/arts/${artId.value}`

  return {
    details,
    summary,
    loadError,
    notice,
    busy,
    rename: (title: string) => act(() => api(url(), { method: 'PATCH', body: { title } })),
    setStatus: (status: ArtStatus) => act(() => api(url(), { method: 'PATCH', body: { status } })),
    assign: (countries: string[], players: string[]) => act(() => api(`${url()}/assignments`, { method: 'PUT', body: { countries, players } })),
    remove: () => act(() => api(url(), { method: 'DELETE' }), false),
  }
}
