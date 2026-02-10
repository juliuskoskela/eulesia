/**
 * CloudNC Minute Fetcher
 *
 * Fetches meeting minutes from CloudNC system used by Finnish municipalities.
 * URL pattern: https://[municipality].cloudnc.fi/fi-FI
 *
 * CloudNC provides:
 * - Meeting listing on the main page with links to individual meetings
 * - PDF downloads via /download/noname/{GUID}/ID pattern
 */

import type { MinuteFetcher, MinuteSource, Meeting } from './types.js'

// Rate limiting (shared with main module via import)
const RATE_LIMIT_MS = 2000
let lastRequestTime = 0

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - timeSinceLastRequest)
  }
  lastRequestTime = Date.now()
  return fetch(url)
}

/**
 * Extract text from PDF using pdf-parse
 */
async function extractTextFromPdf(pdfUrl: string): Promise<string> {
  console.log(`   Downloading PDF: ${pdfUrl}`)

  const response = await rateLimitedFetch(pdfUrl)
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()

  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: arrayBuffer })
  const result = await parser.getText()

  console.log(`   Extracted ${result.text.length} characters from PDF`)
  return result.text
}

// ============================================
// CloudNC Municipality Configuration
// ============================================

const CLOUDNC_MUNICIPALITIES = [
  'rautalampi', 'tampere', 'jyvaskyla', 'mikkeli', 'rovaniemi',
  'kajaani', 'pori', 'hollola', 'tuusula', 'jarvenpaa',
  // New municipalities:
  'laitila', 'laihia', 'kangasniemi', 'muonio', 'aura',
  'vesilahti', 'mantyharju'
]

const CLOUDNC_WELFARE_REGIONS = [
  { name: 'Pirkanmaan hyvinvointialue', subdomain: 'pirha' },
  { name: 'Pohjois-Pohjanmaan hyvinvointialue', subdomain: 'pohde' },
  { name: 'Satakunnan hyvinvointialue', subdomain: 'sata' },
  { name: 'Itä-Uusimaan hyvinvointialue', subdomain: 'itauusimaa' },
  { name: 'Keski-Uusimaan hyvinvointialue', subdomain: 'keuh' },
  { name: 'Vantaan ja Keravan hyvinvointialue', subdomain: 'vakehyva' },
  { name: 'Kainuun hyvinvointialue', subdomain: 'kainuunhyvinvointialue' },
]

export const CLOUDNC_SOURCES: MinuteSource[] = [
  ...CLOUDNC_MUNICIPALITIES.map(m => ({
    municipality: m.charAt(0).toUpperCase() + m.slice(1),
    type: 'cloudnc' as const,
    url: `https://${m}.cloudnc.fi/fi-FI`
  })),
  ...CLOUDNC_WELFARE_REGIONS.map(r => ({
    municipality: r.name,
    type: 'cloudnc' as const,
    url: `https://${r.subdomain}.cloudnc.fi/fi-FI`,
    region: r.name
  }))
]

// ============================================
// CloudNC Fetcher Implementation
// ============================================

export const cloudncFetcher: MinuteFetcher = {
  type: 'cloudnc',

  async fetchMeetings(source: MinuteSource): Promise<Meeting[]> {
    const response = await rateLimitedFetch(source.url)
    const html = await response.text()

    const meetings: Meeting[] = []

    // CloudNC pattern: href='/fi-FI/Toimielimet/Organ/Kokous_DATE'
    // Match: Organ - Kokous DATE Pöytäkirja (skip Esityslista)
    const regex = /href='([^']*\/Kokous_[^']+)'[^>]*>([^<]+Pöytäkirja)/gi
    let match

    while ((match = regex.exec(html)) !== null) {
      const href = match[1]
      const title = match[2].trim()

      // Extract organ from title
      const parts = title.split(' - ')
      const organ = parts[0]?.trim()

      // Create unique ID from path
      const pathParts = href.split('/')
      const id = pathParts[pathParts.length - 1]  // e.g., "Kokous_1912026"

      // Extract date from title (Finnish format: DD.MM.YYYY)
      const dateMatch = title.match(/(\d{1,2}\.\d{1,2}\.\d{4})/)
      const date = dateMatch ? dateMatch[1] : undefined

      meetings.push({
        id,
        pageUrl: new URL(href, source.url).toString(),
        title,
        date,
        organ
      })
    }

    console.log(`   Found ${meetings.length} pöytäkirjat`)
    return meetings.slice(0, 10)
  },

  async extractContent(meeting: Meeting, _source: MinuteSource): Promise<string | null> {
    // Fetch meeting page to find PDF download link
    const response = await rateLimitedFetch(meeting.pageUrl)
    const html = await response.text()

    // Look for download button with /download/noname/ pattern
    // Pattern: href="/download/noname/{GUID}/ID"
    const pdfMatch = html.match(/href="(\/download\/noname\/\{[^}]+\}\/\d+)"/i)
    if (!pdfMatch) {
      return null
    }

    const baseUrl = new URL(meeting.pageUrl)
    const pdfUrl = `${baseUrl.origin}${pdfMatch[1]}`

    return extractTextFromPdf(pdfUrl)
  }
}
