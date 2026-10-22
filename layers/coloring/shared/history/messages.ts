/** Errors of the history API that are not platform-wide. */
export const HISTORY_ERROR_MESSAGES = {
  history_conflict: 'Рисунок уже изменён в другом окне или на другом устройстве.',
  history_full: 'В этой попытке накопилось слишком много действий. Начните рисунок заново.',
  history_unsaved: 'Рисунок ещё не сохранён: нет связи с сервером. Подождите немного и попробуйте снова.',
  history_open: 'Не удалось показать сохранённый рисунок. Обновите страницу.',
  history_region: 'В рисунке нет такой области.',
} as const

/** What the editor tells the player when the server's version of the history was put together with theirs. */
export const HISTORY_NOTICES = {
  merged: 'Рисунок изменили на другом устройстве. Мы загрузили свежую версию и дописали ваши последние действия.',
  replaced: 'Рисунок изменили на другом устройстве. Загрузили свежую версию.',
} as const

/** Saving or sharing the finished picture. */
export const IMAGE_MESSAGES = {
  share_failed: 'Не получилось сохранить картинку. Попробуйте ещё раз.',
  thumbnail_too_large: 'Картинка слишком большая.',
} as const

export type HistoryErrorCode = keyof typeof HISTORY_ERROR_MESSAGES
