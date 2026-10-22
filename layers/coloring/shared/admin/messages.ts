/** Errors of the admin API that are not platform-wide. */
export const ADMIN_ERROR_MESSAGES = {
  art_not_editable: 'Этот рисунок нельзя изменить: он загружен игроком.',
  player_not_found: 'Игрок не найден.',
} as const

export type AdminErrorCode = keyof typeof ADMIN_ERROR_MESSAGES
