import { COUNTRY_CODES } from '../../shared/countries'

export interface CountryOption {
  code: string
  name: string
}

/** Countries with Russian names (from the browser's own data), sorted by name. */
export function useCountries(): CountryOption[] {
  const names = new Intl.DisplayNames('ru', { type: 'region' })
  return COUNTRY_CODES
    .map(code => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}
