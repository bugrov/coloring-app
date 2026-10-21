/** Errors of the history API that are not platform-wide. */
export const HISTORY_ERROR_MESSAGES = {
  history_conflict: 'Рисунок уже изменён в другом окне или на другом устройстве.',
  history_full: 'В этой попытке накопилось слишком много действий. Начните рисунок заново.',
  history_unsaved: 'Рисунок ещё не сохранён: нет связи с сервером. Подождите немного и попробуйте снова.',
  history_region: 'В рисунке нет такой области.',
} as const

export type HistoryErrorCode = keyof typeof HISTORY_ERROR_MESSAGES
