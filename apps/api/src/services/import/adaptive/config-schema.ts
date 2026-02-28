/**
 * FetcherConfig Zod Schema
 *
 * Declarative configuration format for the AdaptiveFetcher.
 * AI generates these configs (or they come from templates).
 * The schema validates and sanitizes all configs before storage.
 *
 * Safety: regex patterns are length-limited and checked for
 * catastrophic backtracking patterns (nested quantifiers).
 */

import { z } from 'zod'

// ============================================
// Regex Safety Validator
// ============================================

const MAX_REGEX_LENGTH = 500

/**
 * Detect potentially catastrophic regex patterns:
 * - Nested quantifiers: (a+)+, (a*)*
 * - Overlapping alternations with quantifiers: (a|a)+
 */
function isDangerousRegex(pattern: string): boolean {
  // Nested quantifiers: quantifier applied to a group containing a quantifier
  if (/\([^)]*[+*][^)]*\)[+*{]/.test(pattern)) return true
  // Very long alternations with quantifiers
  if (/\([^)]{50,}\)[+*{]/.test(pattern)) return true
  return false
}

const safeRegexString = z.string()
  .min(1)
  .max(MAX_REGEX_LENGTH)
  .refine(
    (val) => {
      try {
        new RegExp(val)
        return true
      } catch {
        return false
      }
    },
    { message: 'Invalid regex pattern' }
  )
  .refine(
    (val) => !isDangerousRegex(val),
    { message: 'Regex pattern contains potentially catastrophic backtracking' }
  )

// ============================================
// URL Template Validator
// ============================================

const urlTemplate = z.string()
  .min(1)
  .max(2000)
  .refine(
    (val) => {
      // Allow {placeholder} tokens in URL templates
      const withoutPlaceholders = val.replace(/\{[a-zA-Z]+\}/g, 'PLACEHOLDER')
      try {
        new URL(withoutPlaceholders)
        return true
      } catch {
        // Allow relative URLs (starting with /)
        return withoutPlaceholders.startsWith('/')
      }
    },
    { message: 'Invalid URL template' }
  )

// ============================================
// Meeting Selector Schema
// ============================================

const meetingSelectorSchema = z.object({
  // Regex pattern to match meeting links in HTML
  pattern: safeRegexString,
  // Capture group indices for extracting data
  groups: z.object({
    id: z.number().int().min(0).max(20),
    url: z.number().int().min(0).max(20),
    title: z.number().int().min(0).max(20).optional(),
    date: z.number().int().min(0).max(20).optional(),
    organ: z.number().int().min(0).max(20).optional(),
  }),
})

// ============================================
// Meeting List Schema
// ============================================

const meetingListSchema = z.object({
  // URL to fetch the meeting list from
  url: urlTemplate,
  method: z.enum(['GET', 'POST']).default('GET'),
  headers: z.record(z.string()).optional(),

  // How to find meetings in the HTML
  meetingSelector: meetingSelectorSchema,

  // Date parsing
  dateFormat: z.string().max(50).default('DD.MM.YYYY'),
  dateLocale: z.string().max(10).optional(),

  // Keywords that indicate a link is to minutes (not agenda)
  protocolIndicators: z.array(z.string().max(100)).default(['Pöytäkirja']),

  // Pagination (if the list is paginated)
  paginationPattern: safeRegexString.optional(),

  // Max number of meetings to return per fetch
  maxMeetings: z.number().int().min(1).max(50).default(10),
})

// ============================================
// Content Extraction Schema
// ============================================

const pdfExtractionSchema = z.object({
  // URL template for constructing PDF URL from meeting data
  // Placeholders: {origin}, {pathPrefix}, {meetingId}, {baseUrl}
  urlTemplate: urlTemplate.optional(),
  // Regex to find PDF download link on meeting page
  linkPattern: safeRegexString.optional(),
})

const htmlExtractionSchema = z.object({
  // Regex to find individual agenda item links on meeting page
  itemPattern: safeRegexString.optional(),
  // URL template for item pages
  itemUrlTemplate: urlTemplate.optional(),
  // CSS-like selectors to try for content extraction (tried in order)
  contentSelectors: z.array(z.string().max(200)).optional(),
  // Regex patterns for content areas (tried in order)
  contentPatterns: z.array(safeRegexString).optional(),
})

const apiExtractionSchema = z.object({
  endpoint: urlTemplate,
  method: z.enum(['GET', 'POST']).default('GET'),
  headers: z.record(z.string()).optional(),
  responseFormat: z.enum(['json', 'xml']).default('json'),
  // JSONPath-like expression to extract content from response
  contentPath: z.string().max(200),
})

const contentExtractionSchema = z.object({
  strategy: z.enum(['pdf', 'html', 'pdf-with-html-fallback', 'api']),
  pdf: pdfExtractionSchema.optional(),
  html: htmlExtractionSchema.optional(),
  api: apiExtractionSchema.optional(),
})

// ============================================
// Text Cleaning Schema
// ============================================

const textCleaningSchema = z.object({
  // Regex patterns for text to remove entirely
  stripPatterns: z.array(safeRegexString).optional(),
  // Find-and-replace pairs
  replacePatterns: z.array(z.object({
    from: safeRegexString,
    to: z.string().max(200),
  })).optional(),
})

// ============================================
// Root FetcherConfig Schema
// ============================================

export const fetcherConfigSchema = z.object({
  meetingList: meetingListSchema,
  contentExtraction: contentExtractionSchema,
  textCleaning: textCleaningSchema.optional(),
})

export type FetcherConfig = z.infer<typeof fetcherConfigSchema>

// ============================================
// Validation Helper
// ============================================

export function validateFetcherConfig(config: unknown): { success: true; data: FetcherConfig } | { success: false; errors: string[] } {
  const result = fetcherConfigSchema.safeParse(config)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
  }
}
