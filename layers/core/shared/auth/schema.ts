import { z } from 'zod'
import { COUNTRY_CODES } from '../countries'
import { ADMIN_LOGIN_MAX_LENGTH, ADMIN_PASSWORD_MAX_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from './constants'
import { normalizeUsername } from './username'

const username = z.string({ error: 'Введите имя' })
  .transform(normalizeUsername)
  .pipe(z.string()
    .min(USERNAME_MIN_LENGTH, `Имя должно быть не короче ${USERNAME_MIN_LENGTH} символов`)
    .max(USERNAME_MAX_LENGTH, `Имя должно быть не длиннее ${USERNAME_MAX_LENGTH} символов`)
    .regex(USERNAME_PATTERN, 'Имя может содержать буквы, цифры, «_» и «-» и должно начинаться с буквы или цифры'))

const country = z.string({ error: 'Выберите страну' })
  .refine(value => (COUNTRY_CODES as readonly string[]).includes(value), 'Выберите страну из списка')

/** Sign in or sign up: the same form, no password. */
export const loginSchema = z.object({ username, country })

export const adminLoginSchema = z.object({
  login: z.string({ error: 'Введите логин' }).min(1, 'Введите логин').max(ADMIN_LOGIN_MAX_LENGTH, 'Слишком длинный логин'),
  password: z.string({ error: 'Введите пароль' }).min(1, 'Введите пароль').max(ADMIN_PASSWORD_MAX_LENGTH, 'Слишком длинный пароль'),
})
