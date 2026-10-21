import { describe, expect, it } from 'vitest'
import { adminLoginSchema, loginSchema, usernameKey } from '../../../layers/core/shared/auth'
import { COUNTRY_CODES } from '../../../layers/core/shared/countries'
import { readApiError } from '../../../layers/core/shared/errors'
import { formatAuditLine } from '../../../layers/core/server/utils/audit'
import { verifyAdminCredentials } from '../../../layers/core/server/services/admin'

const login = (username: unknown, country: unknown = 'RU') => loginSchema.safeParse({ username, country })

describe('loginSchema', () => {
  it.each(['Маша', 'kate_2', 'Anna-Maria', 'abc', 'Ёлка', 'Олег-2', 'Їжак', 'Қайрат', 'a'.repeat(20)])('accepts %s', (name) => {
    expect(login(name).success).toBe(true)
  })

  it.each([
    ['too short', 'ab'],
    ['too long', 'a'.repeat(21)],
    ['with a space inside', 'two words'],
    ['starting with an underscore', '_name'],
    ['with markup', '<script>'],
    ['with quotes (SQL-looking)', 'x\' OR \'1\'=\'1'],
    ['empty', ''],
    ['in Devanagari', 'हिमांशु'],
    ['in Thai', 'สมชาย'],
    ['in Arabic', 'مُحَمَّد'],
    ['in Chinese', '日本語名前'],
    ['in Greek', 'Ελένη'],
    ['with a Latin accent', 'José'],
    ['made of invisible Hangul fillers', 'ㅤㅤㅤ'],
    ['with a zero-width space', 'ab\u200Bc'],
    ['with a combining mark', 'Маша\u0301'],
    ['with a variation selector', 'ab\uFE0Fc'],
  ])('rejects a name %s', (_label, name) => {
    expect(login(name).success).toBe(false)
  })

  it('does not let Latin and Cyrillic letters mix, so one name cannot imitate another', () => {
    // The first letter is Cyrillic "А", the rest Latin: it looks like "Anna".
    const result = login('\u0410nna')

    expect(result.success).toBe(false)
    expect(!result.success && result.error.issues[0]?.message).toBe('Не смешивайте русские и английские буквы в одном имени')
  })

  it('lets digits and separators go with either alphabet', () => {
    expect(login('Олег_2024').success).toBe(true)
    expect(login('Oleg-2024').success).toBe(true)
  })

  it('trims and composes the name before checking it', () => {
    const result = login('  Kate  ')

    expect(result.success && result.data.username).toBe('Kate')
  })

  it('rejects anything that is not a string', () => {
    expect(login(42).success).toBe(false)
    expect(login(null).success).toBe(false)
    expect(login({ $gt: '' }).success).toBe(false)
  })

  it('accepts only known ISO country codes', () => {
    expect(login('Kate', 'US').success).toBe(true)
    expect(login('Kate', 'XX').success).toBe(false)
    expect(login('Kate', 'ru').success).toBe(false)
    expect(login('Kate', '').success).toBe(false)
  })

  it('reports problems per field, in Russian', () => {
    const result = loginSchema.safeParse({ username: 'a', country: 'XX' })
    const messages = result.success ? [] : result.error.issues.map(issue => issue.message)

    expect(messages).toEqual([
      'Имя должно быть не короче 3 символов',
      'Выберите страну из списка',
    ])
  })
})

describe('usernameKey', () => {
  it('is case-insensitive', () => {
    expect(usernameKey('KATE')).toBe(usernameKey('kate'))
    expect(usernameKey('МАША')).toBe(usernameKey('маша'))
  })

  it('treats "ё" as "е"', () => {
    expect(usernameKey('Ёлка')).toBe(usernameKey('Елка'))
  })

  it('composes compatibility forms: full-width letters are the plain ones', () => {
    expect(usernameKey('Ｋａｔｅ')).toBe('kate')
  })
})

describe('COUNTRY_CODES', () => {
  it('has unique, valid, named codes', () => {
    const names = new Intl.DisplayNames('en', { type: 'region' })

    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length)
    expect(COUNTRY_CODES.every(code => /^[A-Z]{2}$/.test(code) && names.of(code) !== code)).toBe(true)
    expect(COUNTRY_CODES).toContain('RU')
  })
})

describe('adminLoginSchema', () => {
  it('needs both fields', () => {
    expect(adminLoginSchema.safeParse({ login: 'admin', password: 'x' }).success).toBe(true)
    expect(adminLoginSchema.safeParse({ login: '', password: 'x' }).success).toBe(false)
    expect(adminLoginSchema.safeParse({ login: 'admin' }).success).toBe(false)
  })
})

describe('verifyAdminCredentials', () => {
  const expected = { login: 'boss', password: 'correct horse' }

  it('accepts the exact credentials', () => {
    expect(verifyAdminCredentials({ login: 'boss', password: 'correct horse' }, expected)).toBe('ok')
  })

  it.each([
    ['wrong password', { login: 'boss', password: 'nope' }],
    ['wrong login', { login: 'Boss', password: 'correct horse' }],
    ['both wrong', { login: 'x', password: 'y' }],
  ])('rejects %s', (_label, input) => {
    expect(verifyAdminCredentials(input, expected)).toBe('invalid')
  })

  it('is disabled, never open, when the environment is not configured', () => {
    expect(verifyAdminCredentials({ login: '', password: '' }, {})).toBe('disabled')
    expect(verifyAdminCredentials({ login: 'boss', password: 'x' }, { login: 'boss' })).toBe('disabled')
  })
})

describe('readApiError', () => {
  it('shows the rate limit message for the 429 that the limiter sends without our body', () => {
    expect(readApiError({ statusCode: 429, data: { statusCode: 429 } })).toMatchObject({
      code: 'rate_limited',
      message: expect.stringContaining('Слишком много попыток'),
    })
  })

  it('reads the error body that the API sends', () => {
    const error = { data: { data: { code: 'username_taken', message: 'Занято' } } }

    expect(readApiError(error)).toMatchObject({ code: 'username_taken', message: 'Занято' })
  })

  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['an unexpected payload', { data: { data: 'oops' } }],
    ['nothing', null],
  ])('falls back to the generic message for %s', (_label, error) => {
    expect(readApiError(error)).toMatchObject({ code: 'internal' })
  })
})

describe('formatAuditLine', () => {
  const at = new Date('2026-10-21T10:00:00Z')

  it('is one line of JSON with the event, the address and the time', () => {
    const line = formatAuditLine('admin_login_failed', '203.0.113.7', at)

    expect(JSON.parse(line)).toEqual({ audit: 'admin_login_failed', ip: '203.0.113.7', at: '2026-10-21T10:00:00.000Z' })
    expect(line).not.toContain('\n')
  })

  it('does not fail without an address and has no room for what the visitor typed', () => {
    expect(JSON.parse(formatAuditLine('admin_login_disabled', undefined, at)).ip).toBe('unknown')
    // The signature takes an event name and an address only: nothing else can reach the line.
    expect(formatAuditLine.length).toBeLessThanOrEqual(3)
  })
})
