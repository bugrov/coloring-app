import { z } from 'zod'
import { COUNTRY_CODES } from '../countries'
import { ADMIN_LOGIN_MAX_LENGTH, ADMIN_PASSWORD_MAX_LENGTH, CYRILLIC_LETTER, LATIN_LETTER, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from './constants'
import { normalizeUsername } from './username'

const username = z.string({ error: 'Введите имя' })
  .transform(normalizeUsername)
  .pipe(z.string()
    .min(USERNAME_MIN_LENGTH, `Имя должно быть не короче ${USERNAME_MIN_LENGTH} символов`)
    .max(USERNAME_MAX_LENGTH, `Имя должно быть не длиннее ${USERNAME_MAX_LENGTH} символов`)
    .regex(USERNAME_PATTERN, 'Имя: русские или английские буквы, цифры, «_» и «-»; начинаться должно с буквы или цифры')
    // Cyrillic "а" and Latin "a" look the same: a name from both alphabets could imitate another.
    .refine(value => !(LATIN_LETTER.test(value) && CYRILLIC_LETTER.test(value)), 'Не смешивайте русские и английские буквы в одном имени'))

const country = z.enum(COUNTRY_CODES, { error: 'Выберите страну из списка' })

/** Sign in or sign up: the same form, no password. */
export const loginSchema = z.object({ username, country })

export const adminLoginSchema = z.object({
  login: z.string({ error: 'Введите логин' }).min(1, 'Введите логин').max(ADMIN_LOGIN_MAX_LENGTH, 'Слишком длинный логин'),
  password: z.string({ error: 'Введите пароль' }).min(1, 'Введите пароль').max(ADMIN_PASSWORD_MAX_LENGTH, 'Слишком длинный пароль'),
})
