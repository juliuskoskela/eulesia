/**
 * Language Support Module
 *
 * Central entry point for multilingual support in the import pipeline.
 * Provides language detection, prompt selection, and date parsing.
 */

export { getPrompts, getSupportedLanguages, fillTemplate } from './prompts.js'
export type { EditorialPrompts } from './prompts.js'
export { parseDate, normalizeDateString } from './date-parser.js'

/**
 * Map country code to default content language.
 */
const COUNTRY_LANGUAGES: Record<string, string> = {
  FI: 'fi',
  SE: 'sv',
  NO: 'no',
  DK: 'da',
  EE: 'et',
  DE: 'de',
  AT: 'de',
  CH: 'de',
  FR: 'fr',
  NL: 'nl',
  BE: 'nl',
  ES: 'es',
  IT: 'it',
  PT: 'pt',
  PL: 'pl',
  CZ: 'cs',
}

/**
 * Get the content language for a country code.
 */
export function getLanguageForCountry(countryCode: string): string {
  return COUNTRY_LANGUAGES[countryCode.toUpperCase()] || 'en'
}

/**
 * Get the organ label for a language.
 * Used when organ is not specified.
 */
export function getDefaultOrganLabel(language: string): string {
  switch (language) {
    case 'fi': return 'kunnan'
    case 'sv': return 'kommunens'
    case 'no': return 'kommunens'
    case 'da': return 'kommunens'
    case 'et': return 'omavalitsuse'
    case 'de': return 'der Gemeinde'
    default: return 'municipal'
  }
}
