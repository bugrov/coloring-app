import { describe, expect, it } from 'vitest'
import { adminLoginSchema, loginSchema, usernameKey } from '../../../layers/core/shared/auth'
import { COUNTRY_CODES } from '../../../layers/core/shared/countries'
import { readApiError } from '../../../layers/core/shared/errors'
import { verifyAdminCredentials } from '../../../layers/core/server/services/admin'

const login = (username: unknown, country: unknown = 'RU') => loginSchema.safeParse({ username, country })

describe('loginSchema', () => {
  // Vowel signs in Devanagari and Thai are combining marks, not letters: they must be allowed.
  it.each(['Маша', 'kate_2', 'Anna-Maria', 'abc', '日本語名前', 'हिमांशु', 'สมชาย', 'مُحَمَّد', 'a'.repeat(20)])('accepts %s', (name) => {
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
    ['made of invisible Hangul fillers', 'ㅤㅤㅤ'],
    ['with a zero-width space', 'ab\u200Bc'],
    ['with a combining grapheme joiner', 'ab\u034Fc'],
    ['with a variation selector', 'ab\uFE0Fc'],
    // NFKC joins the first mark with the letter, so more than four marks are needed to leave four.
    ['with stacked marks ("zalgo")', 'a\u0300\u0301\u0302\u0303\u0304\u0305\u0306bc'],
    ['starting with a combining mark', '\u0301abc'],
  ])('rejects a name %s', (_label, name) => {
    expect(login(name).success).toBe(false)
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
  it('folds case the way Unicode does, not only by lower-casing', () => {
    // Final and medial sigma, sharp s: written differently, the same name.
    expect(usernameKey('ΟΔΟΣ')).toBe(usernameKey('οδοσ'))
    expect(usernameKey('οδος')).toBe(usernameKey('οδοσ'))
    expect(usernameKey('STRASSE')).toBe(usernameKey('Straße'))
  })

  it('stays stable when lower-casing produces characters that normalize differently', () => {
    expect(usernameKey('İstanbul')).toBe(usernameKey(usernameKey('İstanbul')))
  })

  it('is case-insensitive and composed', () => {
    expect(usernameKey('KATE')).toBe(usernameKey('kate'))
    // Full-width "Ｋａｔｅ" is the same name as "Kate" after NFKC.
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
