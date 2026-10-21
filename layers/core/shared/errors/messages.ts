import type { ApiErrorCode } from '../types/api'

/** Shown to the user. The server never sends raw validation, SQL or stack messages. */
export const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  validation: 'Проверьте введённые данные',
  username_taken: 'Это имя уже занято в другой стране. Выберите другое имя или свою страну',
  rate_limited: 'Слишком много попыток. Подождите немного и попробуйте снова',
  unauthorized: 'Нужно войти',
  forbidden: 'Недостаточно прав',
  invalid_credentials: 'Неверный логин или пароль',
  admin_disabled: 'Вход администратора не настроен',
  internal: 'Что-то пошло не так. Попробуйте ещё раз',
}
