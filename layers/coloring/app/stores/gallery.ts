import { defineStore } from 'pinia'
import { readApiError } from '#layers/core/shared/errors'
import type { GalleryItem, GalleryPage } from '../../shared'

type Status = 'idle' | 'loading' | 'ready' | 'error'

/** Gallery cards and the paging state. Server calls go through the player's own session. */
export const useGalleryStore = defineStore('coloring-gallery', () => {
  // Every call goes through this one function. During SSR a plain `$fetch` to our own API would
  // not carry the player's cookie (Nuxt docs), so the first page would be refused; `useRequestFetch`
  // forwards the incoming headers there, and in the browser it is the usual `$fetch`.
  const api = useRequestFetch()

  const items = ref<GalleryItem[]>([])
  const nextCursor = ref<string | null>(null)
  const status = ref<Status>('idle')
  const loadingMore = ref(false)
  /** A message for the user when the last list request failed. */
  const error = ref('')
  /** Result of the last action (import, delete, restart): a message, or empty. */
  const notice = ref('')

  /** Bumped by every first-page load: a page request that started before it is stale and dropped. */
  let generation = 0

  async function fetchPage(cursor?: string): Promise<GalleryPage> {
    return api<GalleryPage>('/api/coloring/arts', { query: cursor ? { cursor } : undefined })
  }

  /** First page; also the way to start over after an error or an import. */
  async function loadFirst(): Promise<void> {
    generation += 1
    const mine = generation
    // A refresh of a shown list keeps the cards on screen instead of flashing placeholders.
    if (status.value !== 'ready') status.value = 'loading'
    error.value = ''
    try {
      const page = await fetchPage()
      if (mine !== generation) return
      items.value = page.items
      nextCursor.value = page.nextCursor
      status.value = 'ready'
    }
    catch (failure) {
      if (mine !== generation) return
      error.value = readApiError(failure).message
      status.value = 'error'
    }
  }

  async function loadMore(): Promise<void> {
    if (!nextCursor.value || loadingMore.value || status.value !== 'ready') return
    const mine = generation
    loadingMore.value = true
    try {
      const page = await fetchPage(nextCursor.value)
      // The list was reloaded meanwhile: this page belongs to the old one.
      if (mine !== generation) return
      // A card removed or added meanwhile cannot repeat: keep the first occurrence of an id.
      const known = new Set(items.value.map(item => item.id))
      items.value.push(...page.items.filter(item => !known.has(item.id)))
      nextCursor.value = page.nextCursor
    }
    catch (failure) {
      notice.value = readApiError(failure).message
    }
    finally {
      loadingMore.value = false
    }
  }

  /** Runs a change on the server; on failure shows its message and leaves the cards as they were. */
  async function act(run: () => Promise<void>): Promise<boolean> {
    notice.value = ''
    try {
      await run()
      return true
    }
    catch (failure) {
      notice.value = readApiError(failure).message
      return false
    }
  }

  async function importSvg(file: File): Promise<boolean> {
    const done = await act(async () => {
      await api('/api/coloring/imports', {
        method: 'POST',
        query: { name: file.name },
        // The raw file is the body: the server decodes it strictly as UTF-8.
        body: await file.arrayBuffer(),
        headers: { 'Content-Type': 'image/svg+xml' },
      })
    })
    if (done) await loadFirst()
    return done
  }

  async function remove(id: string): Promise<boolean> {
    const done = await act(async () => {
      await api(`/api/coloring/arts/${id}`, { method: 'DELETE' })
    })
    if (done) items.value = items.value.filter(item => item.id !== id)
    return done
  }

  async function restart(id: string): Promise<boolean> {
    let attempt = 0
    const done = await act(async () => {
      const result = await api<{ attempt: number }>(`/api/coloring/arts/${id}/restart`, { method: 'POST' })
      attempt = result.attempt
    })
    if (done) {
      // The new attempt starts empty; the server keeps the old one and says which attempt is current.
      const card = items.value.find(item => item.id === id)
      if (card) Object.assign(card, { percent: 0, completed: false, thumbnail: null, attempt })
    }
    return done
  }

  return { items, nextCursor, status, loadingMore, error, notice, loadFirst, loadMore, importSvg, remove, restart }
})
