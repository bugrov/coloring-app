import { readApiError } from '#layers/core/shared/errors'
import type { AdminPlayer, PlayerArt } from '../../shared'

/** Finding a player by the beginning of the name. */
export function usePlayerSearch() {
  const api = useRequestFetch()
  const query = ref('')
  const found = ref<AdminPlayer[]>([])
  const error = ref('')
  const searched = ref(false)

  async function search(): Promise<void> {
    error.value = ''
    const text = query.value.trim()
    if (!text) return
    try {
      found.value = await api<AdminPlayer[]>('/api/admin/coloring/players', { query: { query: text } })
      searched.value = true
    }
    catch (failure) {
      error.value = readApiError(failure).message
    }
  }

  return { query, found, error, searched, search }
}

/** Finding a player and listing what they have started. */
export function useAdminPlayers() {
  const api = useRequestFetch()
  const { query, found, error, searched, search } = usePlayerSearch()
  const selected = ref<AdminPlayer | null>(null)
  const arts = ref<PlayerArt[]>([])

  async function select(player: AdminPlayer): Promise<void> {
    error.value = ''
    try {
      const result = await api<{ player: AdminPlayer, arts: PlayerArt[] }>(`/api/admin/coloring/players/${player.id}/arts`)
      selected.value = result.player
      arts.value = result.arts
    }
    catch (failure) {
      error.value = readApiError(failure).message
    }
  }

  return { query, found, selected, arts, error, searched, search, select }
}
