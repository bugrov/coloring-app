import { readApiError } from '#layers/core/shared/errors'
import type { AdminPlayer, PlayerArt } from '../../shared'

/** Finding a player by name and listing what they have started. */
export function useAdminPlayers() {
  const api = useRequestFetch()
  const query = ref('')
  const found = ref<AdminPlayer[]>([])
  const selected = ref<AdminPlayer | null>(null)
  const arts = ref<PlayerArt[]>([])
  const error = ref('')
  const searched = ref(false)

  async function search() {
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

  async function select(player: AdminPlayer) {
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
