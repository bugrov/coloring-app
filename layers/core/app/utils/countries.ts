import { COUNTRY_CODES } from '../../shared/countries'

export interface CountryOption {
  code: string
  name: string
}

const regionNames = new Intl.DisplayNames('ru', { type: 'region' })

/** The Russian name of a country, or its code when the browser does not know it. */
export function countryName(code: string): string {
  return regionNames.of(code) ?? code
}

/** Countries with Russian names (from the browser's own data), sorted by name. */
export function countryOptions(): CountryOption[] {
  return COUNTRY_CODES
    .map(code => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}
