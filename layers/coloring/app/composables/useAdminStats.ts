import { readApiError } from '#layers/core/shared/errors'
import type { AdminStats } from '../../shared'

/** The analytics of the last `days` days, reloaded when the period changes. */
export function useAdminStats(days: Readonly<Ref<number>>) {
  const { data, status, error } = useFetch<AdminStats>('/api/admin/coloring/stats', { query: { days }, key: 'admin-coloring-stats' })
  return {
    stats: data,
    pending: computed(() => status.value === 'pending'),
    loadError: computed(() => (error.value ? readApiError(error.value).message : '')),
  }
}
