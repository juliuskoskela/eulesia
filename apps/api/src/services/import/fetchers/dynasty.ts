/**
 * Dynasty (Innofactor) Minute Fetcher
 *
 * Fetches meeting minutes from Dynasty document management system.
 * Used by 40-50+ Finnish municipalities.
 *
 * Dynasty uses DREQUEST.PHP CGI interface with consistent URL patterns:
 * - ?page=meeting_frames  → Front page: latest meetings for all organs
 * - ?page=meetings&id=X   → Organ's meeting list
 * - ?page=meeting&id=X    → Single meeting agenda
 * - ?page=meetingitem&id=X-N → Single agenda item decision text
 *
 * PDF paths are predictable: /kokous/[MEETING_ID].PDF
 *
 * URL variations handled via pathPrefix:
 * - Default: https://poytakirjat.[kunta].fi/cgi/DREQUEST.PHP
 * - Variation A: .../[prefix]/cgi/DREQUEST.PHP (e.g., /D10_Haapajarvi)
 * - Variation B: https://dynasty.[kunta].fi/djulkaisu/cgi/DREQUEST.PHP
 */

import type { MinuteFetcher, MinuteSource, Meeting } from './types.js'

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

// ============================================
// Dynasty Municipality Configuration
// ============================================

export const DYNASTY_SOURCES: MinuteSource[] = [
  // === Direct servers (poytakirjat.[kunta].fi) ===
  { municipality: 'Ylivieska', type: 'dynasty', url: 'https://poytakirjat.ylivieska.fi/cgi/DREQUEST.PHP' },
  { municipality: 'Haapajärvi', type: 'dynasty', url: 'https://poytakirjat.haapajarvi.fi/cgi/DREQUEST.PHP', pathPrefix: '/D10_Haapajarvi' },

  // === Custom domain ===
  { municipality: 'Suonenjoki', type: 'dynasty', url: 'https://www.suonenjoki.info/djulkaisu/cgi/DREQUEST.PHP', pathPrefix: '/djulkaisu' },

  // === Regional: Kaustisen seutukunta (dynastyjulkaisu.kase.fi) ===
  { municipality: 'Toholampi', type: 'dynasty', url: 'https://dynastyjulkaisu.kase.fi/D10_Toholampi/cgi/DREQUEST.PHP', pathPrefix: '/D10_Toholampi' },
  { municipality: 'Kaustinen', type: 'dynasty', url: 'https://dynastyjulkaisu.kase.fi/D10_Kaustinen/cgi/DREQUEST.PHP', pathPrefix: '/D10_Kaustinen' },
  { municipality: 'Perho', type: 'dynasty', url: 'https://dynastyjulkaisu.kase.fi/D10_Perho/cgi/DREQUEST.PHP', pathPrefix: '/D10_Perho' },
  { municipality: 'Veteli', type: 'dynasty', url: 'https://dynastyjulkaisu.kase.fi/D10_Veteli/cgi/DREQUEST.PHP', pathPrefix: '/D10_Veteli' },

  // === Discovered: poytakirjat.[kunta].fi pattern ===
  { municipality: 'Haapavesi', type: 'dynasty', url: 'https://poytakirjat.haapavesi.fi/cgi/DREQUEST.PHP' },
  { municipality: 'Merijärvi', type: 'dynasty', url: 'https://poytakirjat.merijarvi.fi/cgi/DREQUEST.PHP' },
  { municipality: 'Mynämäki', type: 'dynasty', url: 'https://poytakirjat.mynamaki.fi/cgi/DREQUEST.PHP' },
  { municipality: 'Nivala', type: 'dynasty', url: 'https://poytakirjat.nivala.fi/cgi/DREQUEST.PHP' },
  { municipality: 'Nousiainen', type: 'dynasty', url: 'https://poytakirjat.nousiainen.fi/cgi/DREQUEST.PHP' },
  { municipality: 'Oulainen', type: 'dynasty', url: 'https://poytakirjat.oulainen.fi/cgi/DREQUEST.PHP' },
  { municipality: 'Savukoski', type: 'dynasty', url: 'https://poytakirjat.savukoski.fi/cgi/DREQUEST.PHP' },
  { municipality: 'Siikajoki', type: 'dynasty', url: 'https://poytakirjat.siikajoki.fi/cgi/DREQUEST.PHP' },
  { municipality: 'Utsjoki', type: 'dynasty', url: 'https://poytakirjat.utsjoki.fi/cgi/DREQUEST.PHP' },
  { municipality: 'Vantaa', type: 'dynasty', url: 'https://poytakirjat.vantaa.fi/cgi/DREQUEST.PHP' },

  // === Discovered: dynasty.[kunta].fi/djulkaisu pattern ===
  { municipality: 'Rautavaara', type: 'dynasty', url: 'https://dynasty.rautavaara.fi/djulkaisu/cgi/DREQUEST.PHP', pathPrefix: '/djulkaisu' },
  { municipality: 'Vesanto', type: 'dynasty', url: 'https://dynasty.vesanto.fi/djulkaisu/cgi/DREQUEST.PHP', pathPrefix: '/djulkaisu' },

  // === Discovered: www.[kunta].fi/djulkaisu pattern ===
  { municipality: 'Brändo', type: 'dynasty', url: 'https://www.brando.fi/djulkaisu/cgi/DREQUEST.PHP', pathPrefix: '/djulkaisu' },
  { municipality: 'Evijärvi', type: 'dynasty', url: 'https://www.evijarvi.fi/djulkaisu/cgi/DREQUEST.PHP', pathPrefix: '/djulkaisu' },
  { municipality: 'Hartola', type: 'dynasty', url: 'https://www.hartola.fi/djulkaisu/cgi/DREQUEST.PHP', pathPrefix: '/djulkaisu' },
  { municipality: 'Kristiinankaupunki', type: 'dynasty', url: 'https://www.kristiinankaupunki.fi/djulkaisu/cgi/DREQUEST.PHP', pathPrefix: '/djulkaisu' },

  // === Regional: Pohjois-Karjala (dynastyjulkaisu.pohjoiskarjala.net) ===
  { municipality: 'Joensuu', type: 'dynasty', url: 'https://dynastyjulkaisu.pohjoiskarjala.net/Joensuu/cgi/DREQUEST.PHP', pathPrefix: '/Joensuu' },
  { municipality: 'Lieksa', type: 'dynasty', url: 'https://dynastyjulkaisu.pohjoiskarjala.net/Lieksa/cgi/DREQUEST.PHP', pathPrefix: '/Lieksa' },
  { municipality: 'Nurmes', type: 'dynasty', url: 'https://dynastyjulkaisu.pohjoiskarjala.net/Nurmes/cgi/DREQUEST.PHP', pathPrefix: '/Nurmes' },
  { municipality: 'Outokumpu', type: 'dynasty', url: 'https://dynastyjulkaisu.pohjoiskarjala.net/Outokumpu/cgi/DREQUEST.PHP', pathPrefix: '/Outokumpu' },
  { municipality: 'Kitee', type: 'dynasty', url: 'https://dynastyjulkaisu.pohjoiskarjala.net/Kitee/cgi/DREQUEST.PHP', pathPrefix: '/Kitee' },
  { municipality: 'Kontiolahti', type: 'dynasty', url: 'https://dynastyjulkaisu.pohjoiskarjala.net/Kontiolahti/cgi/DREQUEST.PHP', pathPrefix: '/Kontiolahti' },
  { municipality: 'Liperi', type: 'dynasty', url: 'https://dynastyjulkaisu.pohjoiskarjala.net/Liperi/cgi/DREQUEST.PHP', pathPrefix: '/Liperi' },
  { municipality: 'Juuka', type: 'dynasty', url: 'https://dynastyjulkaisu.pohjoiskarjala.net/Juuka/cgi/DREQUEST.PHP', pathPrefix: '/Juuka' },
  { municipality: 'Ilomantsi', type: 'dynasty', url: 'https://dynastyjulkaisu.pohjoiskarjala.net/Ilomantsi/cgi/DREQUEST.PHP', pathPrefix: '/Ilomantsi' },
  { municipality: 'Tohmajärvi', type: 'dynasty', url: 'https://dynastyjulkaisu.pohjoiskarjala.net/Tohmajarvi/cgi/DREQUEST.PHP', pathPrefix: '/Tohmajarvi' },
  { municipality: 'Polvijärvi', type: 'dynasty', url: 'https://dynastyjulkaisu.pohjoiskarjala.net/Polvijarvi/cgi/DREQUEST.PHP', pathPrefix: '/Polvijarvi' },
  { municipality: 'Rääkkylä', type: 'dynasty', url: 'https://dynastyjulkaisu.pohjoiskarjala.net/Raakkyla/cgi/DREQUEST.PHP', pathPrefix: '/Raakkyla' },
  { municipality: 'Heinävesi', type: 'dynasty', url: 'https://dynastyjulkaisu.pohjoiskarjala.net/Heinavesi/cgi/DREQUEST.PHP', pathPrefix: '/Heinavesi' },
]

// ============================================
// Dynasty Fetcher Implementation
// ============================================

/**
 * Build the CGI URL for a Dynasty source.
 * Dynasty sources store the full CGI URL in source.url.
 */
function buildCgiUrl(source: MinuteSource, page: string, id?: string): string {
  let url = `${source.url}?page=${page}`
  if (id) {
    url += `&id=${id}`
  }
  return url
}

/**
 * Build the PDF URL for a Dynasty meeting.
 * PDF path: [origin][pathPrefix]/kokous/[meetingId].PDF
 */
function buildPdfUrl(source: MinuteSource, meetingId: string): string {
  const origin = new URL(source.url).origin
  const prefix = source.pathPrefix || ''
  return `${origin}${prefix}/kokous/${meetingId}.PDF`
}

/**
 * Parse HTML to extract text content, stripping tags.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const dynastyFetcher: MinuteFetcher = {
  type: 'dynasty',

  async fetchMeetings(source: MinuteSource): Promise<Meeting[]> {
    const url = buildCgiUrl(source, 'meeting_frames')
    console.log(`   Fetching: ${url}`)

    const response = await rateLimitedFetch(url)
    if (!response.ok) {
      throw new Error(`Dynasty fetch failed: ${response.status} for ${url}`)
    }
    const html = await response.text()

    const meetings: Meeting[] = []

    // Parse meeting_frames page: look for links to individual meetings
    // Split by <tr to handle HTML with or without </tr> closing tags
    const rows = html.split(/<tr\b/i).slice(1) // Skip content before first <tr>

    for (const rawRow of rows) {
      const row = rawRow

      // Check if this row has a protocol (pöytäkirja) link
      const protocolMatch = row.match(/page=meeting&(?:amp;)?id=(\d+)/)
      if (!protocolMatch) continue

      // Check for protocol indicator: multiple Dynasty variants exist:
      // - icon_protocol.png (e.g., Ylivieska)
      // - icon_doc1.png with "Pöytäkirja" text (e.g., Hartola, Rautavaara)
      // - Plain "Pöytäkirja" text link without icons (e.g., Suonenjoki, Joensuu)
      // - 'protocol' CSS class (newer Dynasty versions)
      // Exclude rows that only have "Esityslista" (agenda) without "Pöytäkirja"
      const isProtocol = row.includes('icon_protocol')
        || /class=['"][^'"]*\bprotocol\b/.test(row)
        || />\s*P\u00f6yt\u00e4kirja\s*</i.test(row)
      if (!isProtocol) continue

      const meetingId = protocolMatch[1]

      // Extract organ name: first link in the row usually points to meetings&id=BODY_ID
      const organMatch = row.match(/page=meetings&(?:amp;)?id=\d+[^"']*['"][^>]*>([^<]+)/)
      const organ = organMatch ? organMatch[1].trim() : undefined

      // Extract date from the row (Finnish date format: DD.MM.YYYY)
      const dateMatch = row.match(/(\d{1,2}\.\d{1,2}\.\d{4})/)
      const date = dateMatch ? dateMatch[1] : undefined

      const title = organ
        ? `${organ}${date ? ` ${date}` : ''} Pöytäkirja`
        : `Pöytäkirja ${meetingId}`

      meetings.push({
        id: meetingId,
        pageUrl: buildCgiUrl(source, 'meeting', meetingId),
        title,
        date,
        organ
      })
    }

    // Fallback: if row-based parsing found nothing, try simpler regex
    if (meetings.length === 0) {
      let simpleMatch
      const simpleRegex = /page=meeting&(?:amp;)?id=(\d+)/g
      const seenIds = new Set<string>()

      while ((simpleMatch = simpleRegex.exec(html)) !== null) {
        const meetingId = simpleMatch[1]
        if (seenIds.has(meetingId)) continue
        seenIds.add(meetingId)

        meetings.push({
          id: meetingId,
          pageUrl: buildCgiUrl(source, 'meeting', meetingId),
          title: `Pöytäkirja ${meetingId}`
        })
      }
    }

    console.log(`   Found ${meetings.length} pöytäkirjat`)
    return meetings.slice(0, 10)
  },

  async extractContent(meeting: Meeting, source: MinuteSource): Promise<string | null> {
    // Strategy A: Try full meeting PDF (predictable URL)
    const pdfUrl = buildPdfUrl(source, meeting.id)
    console.log(`   Trying PDF: ${pdfUrl}`)

    try {
      const pdfResponse = await rateLimitedFetch(pdfUrl)
      if (pdfResponse.ok) {
        const contentType = pdfResponse.headers.get('content-type') || ''
        if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
          const arrayBuffer = await pdfResponse.arrayBuffer()
          const { PDFParse } = await import('pdf-parse')
          const parser = new PDFParse({ data: arrayBuffer })
          const result = await parser.getText()
          console.log(`   Extracted ${result.text.length} characters from PDF`)
          return result.text
        }
      }
    } catch (err) {
      console.log(`   PDF not available, falling back to HTML extraction`)
    }

    // Strategy B: Extract from individual meeting items via HTML
    console.log(`   Extracting content from HTML...`)

    const agendaResponse = await rateLimitedFetch(meeting.pageUrl)
    if (!agendaResponse.ok) {
      return null
    }
    const agendaHtml = await agendaResponse.text()

    // Parse agenda: find links to individual items
    // Pattern: page=meetingitem&id=MEETING_ID-ITEM_NUMBER
    const itemRegex = /page=meetingitem&(?:amp;)?id=(\d+-\d+)[^"]*"[^>]*>([^<]*)/g
    const items: { id: string; title: string }[] = []
    let itemMatch

    while ((itemMatch = itemRegex.exec(agendaHtml)) !== null) {
      items.push({
        id: itemMatch[1],
        title: itemMatch[2].trim()
      })
    }

    if (items.length === 0) {
      return null
    }

    // Fetch each item's content
    const contentParts: string[] = []
    for (const item of items) {
      const itemUrl = buildCgiUrl(source, 'meetingitem', item.id)

      try {
        const itemResponse = await rateLimitedFetch(itemUrl)
        if (!itemResponse.ok) continue

        const itemHtml = await itemResponse.text()

        // Extract the main content area
        // Dynasty meetingitem pages contain the decision text in the main content div
        const contentMatch = itemHtml.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
          || itemHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)

        if (contentMatch) {
          const text = stripHtml(contentMatch[1])
          if (text.length > 20) {
            contentParts.push(`§ ${item.title}\n\n${text}`)
          }
        }
      } catch {
        // Skip failed items
      }
    }

    if (contentParts.length === 0) {
      return null
    }

    return contentParts.join('\n\n---\n\n')
  }
}
