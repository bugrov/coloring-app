import { readApiError } from '#layers/core/shared/errors'
import type { PaletteColor } from '../../shared'
import { PALETTE } from '../../shared'

/** The colours of the panel for the administrator: loaded, edited as a draft, saved or reset to the standard set. */
export function useAdminPalette() {
  const api = useApi()
  const { data, error, refresh } = useFetch<PaletteColor[]>('/api/admin/coloring/palette', { timeout: API_TIMEOUT_MS, key: 'admin-coloring-palette' })

  /** The draft the administrator is editing; independent copies, so typing does not touch what is saved. */
  const colors = ref<PaletteColor[]>([])
  watch(data, (saved) => {
    if (saved) colors.value = saved.map(color => ({ ...color }))
  }, { immediate: true })

  const message = ref('')
  const saving = ref(false)

  async function save(): Promise<boolean> {
    saving.value = true
    message.value = ''
    try {
      await api('/api/admin/coloring/palette', { method: 'PUT', body: { palette: colors.value } })
      await refresh()
      message.value = 'Сохранено. Игроки увидят новые цвета при следующем открытии рисунка.'
      return true
    }
    catch (failure) {
      message.value = readApiError(failure).message
      return false
    }
    finally {
      saving.value = false
    }
  }

  /** Puts the standard set into the draft; nothing is saved until the administrator saves. */
  function resetToStandard(): void {
    colors.value = PALETTE.map(color => ({ ...color }))
  }

  const dirty = computed(() => JSON.stringify(colors.value) !== JSON.stringify(data.value))

  return { colors, loadError: computed(() => (error.value ? readApiError(error.value).message : '')), message, saving, dirty, save, resetToStandard }
}
