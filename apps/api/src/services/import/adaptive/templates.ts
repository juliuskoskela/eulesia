/**
 * FetcherConfig Templates
 *
 * Pre-built declarative configurations for known municipality systems.
 * These convert hand-coded fetcher logic into JSON configs that the
 * AdaptiveFetcher can interpret.
 *
 * When a known system type is detected during discovery, the template
 * is used directly — no AI call needed.
 *
 * Supported systems:
 * - CloudNC (Finland)
 * - Dynasty (Finland)
 * - Tweb/Triplan (Finland)
 * - ALLRIS (Germany)
 * - SessionNet (Germany)
 * - VOLIS/Amphora (Estonia)
 * - Flexite (Sweden)
 * - WebDelib (France)
 */

import type { FetcherConfig } from './config-schema.js'

// ============================================
// FINLAND: CloudNC
// ============================================

export const cloudncTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}',
    method: 'GET',
    meetingSelector: {
      // Matches: href='/fi-FI/Toimielimet/Organ/Kokous_DATE' ... >Organ - Kokous DATE Pöytäkirja
      pattern: "href='([^']*\\/Kokous_([^']+))'[^>]*>([^<]+P\u00f6yt\u00e4kirja)",
      groups: { url: 1, id: 2, title: 3 },
    },
    dateFormat: 'DD.MM.YYYY',
    protocolIndicators: ['Pöytäkirja'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'pdf',
    pdf: {
      // CloudNC: find download button on meeting page
      linkPattern: 'href="(\\/download\\/noname\\/\\{[^}]+\\}\\/\\d+)"',
    },
  },
}

// ============================================
// FINLAND: Dynasty
// ============================================

export const dynastyTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}?page=meeting_frames',
    method: 'GET',
    meetingSelector: {
      // Matches meeting links with protocol indicators
      // Dynasty uses <tr> rows with page=meeting&id=NNNN and protocol icons/text
      pattern: 'page=meeting&(?:amp;)?id=(\\d+).*?(?:icon_protocol|class=["\'][^"\']*\\bprotocol\\b|>\\s*P\u00f6yt\u00e4kirja\\s*<)',
      groups: { id: 1, url: 1 }, // URL is constructed from ID
    },
    dateFormat: 'DD.MM.YYYY',
    protocolIndicators: ['icon_protocol', 'Pöytäkirja', 'protocol'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'pdf-with-html-fallback',
    pdf: {
      // Dynasty: predictable PDF path
      urlTemplate: '{origin}{pathPrefix}/kokous/{meetingId}.PDF',
    },
    html: {
      // Fallback: extract individual meeting items
      itemPattern: 'page=meetingitem&(?:amp;)?id=(\\d+-\\d+)[^"]*"[^>]*>([^<]*)',
      itemUrlTemplate: '{baseUrl}?page=meetingitem&id={itemId}',
      contentSelectors: ['div.content'],
      contentPatterns: ['<div[^>]*class="[^"]*content[^"]*"[^>]*>([\\s\\S]*?)<\\/div>'],
    },
  },
}

// ============================================
// FINLAND: Tweb (Triplan)
// ============================================

export const twebTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}/dbisa.dll/ktwebscr/pk_tek_tweb.htm',
    method: 'GET',
    meetingSelector: {
      // Matches: pk_asil_tweb.htm?+bid=NNNN">Link text
      pattern: 'pk_asil_tweb\\.htm\\?\\+bid=(\\d+)[^"]*"[^>]*>([^<]*)',
      groups: { id: 1, url: 1, title: 2 },
    },
    dateFormat: 'DD.MM.YYYY',
    protocolIndicators: [], // Tweb doesn't distinguish protocol from agenda in search
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'html',
    html: {
      itemPattern: 'ktproxy2\\.dll\\?doctype=3&(?:amp;)?docid=(\\d+)[^"]*"[^>]*>([^<]*)',
      itemUrlTemplate: '{baseUrl}/ktproxy2.dll?doctype=3&docid={itemId}',
    },
  },
}

// ============================================
// FINLAND: Helsinki (Ahjo/Drupal)
// ============================================
// Helsinki uses a custom Drupal-based system "Päätökset" (paatokset.hel.fi).
// Each decision-making body has its own document listing page.
// baseUrl = https://paatokset.hel.fi/fi/paattajat/{body}/asiakirjat

export const helsinkiPaatoksetTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}',
    method: 'GET',
    meetingSelector: {
      // Cards with links to /fi/paattajat/{body}/asiakirjat/{docId}
      pattern: 'href="(/fi/paattajat/[^/]+/asiakirjat/(\\d+))"',
      groups: { url: 1, id: 2 },
    },
    dateFormat: 'D.M.YYYY',
    protocolIndicators: ['Pöytäkirja'],
    paginationPattern: '\\?page=(\\d+)',
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'html',
    html: {
      // Agenda items link to /fi/asia/hel-YYYY-NNNNNN?paatos=UUID
      itemPattern: 'href="(/fi/asia/(hel-[^"?]+)[^"]*)"',
      itemUrlTemplate: 'https://paatokset.hel.fi{itemUrl}',
      contentSelectors: ['#main-content', 'article', 'main'],
    },
  },
  textCleaning: {
    stripPatterns: [
      'VALITUSOSOITUS[\\s\\S]*$',
    ],
  },
}

// ============================================
// GERMANY: ALLRIS (CC e-gov GmbH)
// ============================================
// ALLRIS is the most common Ratsinformationssystem in Germany.
// Used by 1000+ municipalities including many major cities.
// Pattern: ratsinfo.[stadt].de or [stadt].de/buergerinfo

export const allrisTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}/bi/si010_e.asp',
    method: 'GET',
    meetingSelector: {
      // ALLRIS lists sessions with links to si010_j.asp?Si_ID=NNNN
      pattern: 'si010_j\\.asp\\?(?:__cjsSi=|Si_ID=)(\\d+)[^"]*"[^>]*>([^<]*)',
      groups: { id: 1, url: 1, title: 2 },
    },
    dateFormat: 'DD.MM.YYYY',
    protocolIndicators: ['Niederschrift', 'Protokoll', 'Sitzungsprotokoll'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'html',
    html: {
      // ALLRIS: agenda items link to to010.asp?Si_ID=NNN&To_ID=NNN
      itemPattern: 'to010\\.asp\\?[^"]*To_ID=(\\d+)[^"]*"[^>]*>([^<]*)',
      itemUrlTemplate: '{baseUrl}/bi/to010.asp?To_ID={itemId}',
      contentSelectors: ['div.WordSection1', 'div.allris_body', 'article'],
      contentPatterns: [
        '<div[^>]*class="[^"]*WordSection[^"]*"[^>]*>([\\s\\S]*?)<\\/div>',
        '<div[^>]*class="[^"]*allris_body[^"]*"[^>]*>([\\s\\S]*?)<\\/div>',
      ],
    },
  },
}

// ============================================
// GERMANY: SessionNet
// ============================================
// Used by major cities like Cologne, Bielefeld.
// Pattern: ratsinformation.stadt-[stadt].de or [stadt].more-rubin.de

export const sessionNetTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}/bi/si010.asp',
    method: 'GET',
    meetingSelector: {
      pattern: 'si010\\.asp\\?(?:__csiSi=|Si_ID=)(\\d+)[^"]*"[^>]*>([^<]*)',
      groups: { id: 1, url: 1, title: 2 },
    },
    dateFormat: 'DD.MM.YYYY',
    protocolIndicators: ['Niederschrift', 'Protokoll'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'html',
    html: {
      itemPattern: 'to010\\.asp\\?[^"]*To_ID=(\\d+)[^"]*"[^>]*>([^<]*)',
      itemUrlTemplate: '{baseUrl}/bi/to010.asp?To_ID={itemId}',
      contentSelectors: ['div.smc_field_text', 'div.WordSection1'],
    },
  },
}

// ============================================
// GERMANY: SD.NET (regio iT)
// ============================================

export const sdnetTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}/sdnetrim/UGhVM0hpd2NXNFdFcExjZQ==/Sitzungskalender',
    method: 'GET',
    meetingSelector: {
      pattern: 'Sitzung/(\\d+)[^"]*"[^>]*>([^<]*)',
      groups: { id: 1, url: 1, title: 2 },
    },
    dateFormat: 'DD.MM.YYYY',
    protocolIndicators: ['Niederschrift', 'Protokoll'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'html',
    html: {
      contentSelectors: ['div.sitzung-content', 'article', 'main'],
    },
  },
}

// ============================================
// ESTONIA: VOLIS / Amphora
// ============================================
// VOLIS is a nationwide system for Estonian local governments.
// All 79 municipalities use variants of this system.
// URL: atp.amphora.ee/[municipality]/ or volis.ee

export const volisTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}/index.aspx?type=12&org=1',
    method: 'GET',
    meetingSelector: {
      // VOLIS lists sessions with links containing document IDs
      pattern: 'index\\.aspx\\?id=(\\d+)&type=12[^"]*"[^>]*>([^<]*)',
      groups: { id: 1, url: 1, title: 2 },
    },
    dateFormat: 'DD.MM.YYYY',
    protocolIndicators: ['Protokoll', 'protokoll'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'html',
    html: {
      itemPattern: 'index\\.aspx\\?id=(\\d+)&type=7[^"]*"[^>]*>([^<]*)',
      itemUrlTemplate: '{baseUrl}/index.aspx?id={itemId}&type=7',
      contentSelectors: ['div.doc-content', 'div.content-area', 'article'],
    },
  },
}

// ============================================
// ESTONIA: Delta (newer system)
// ============================================

export const deltaTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}/documents',
    method: 'GET',
    meetingSelector: {
      pattern: 'documents/(\\d+)[^"]*"[^>]*>([^<]*)',
      groups: { id: 1, url: 1, title: 2 },
    },
    dateFormat: 'DD.MM.YYYY',
    protocolIndicators: ['Protokoll', 'Istungi protokoll'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'html',
    html: {
      contentSelectors: ['div.document-content', 'article', 'main'],
    },
  },
}

// ============================================
// SWEDEN: Municipal Protocols
// ============================================
// Swedish municipalities are highly heterogeneous.
// Common patterns: [kommun].se/protokoll or [kommun].se/kommun-och-politik/handlingar

export const swedenGenericTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}',
    method: 'GET',
    meetingSelector: {
      // Swedish municipalities often list protocols as PDF links
      pattern: 'href="([^"]*protokoll[^"]*\\.pdf)"[^>]*>([^<]*)',
      groups: { url: 1, id: 1, title: 2 },
    },
    dateFormat: 'YYYY-MM-DD',
    protocolIndicators: ['Protokoll', 'protokoll', 'Sammanträdesprotokoll'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'pdf',
    pdf: {
      linkPattern: 'href="([^"]*\\.pdf)"',
    },
  },
}

// ============================================
// SWEDEN: Flexite
// ============================================

export const flexiteTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}/meetings',
    method: 'GET',
    meetingSelector: {
      pattern: 'meetings/(\\d+)[^"]*"[^>]*>([^<]*)',
      groups: { id: 1, url: 1, title: 2 },
    },
    dateFormat: 'YYYY-MM-DD',
    protocolIndicators: ['Protokoll', 'Justerat protokoll'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'pdf',
    pdf: {
      linkPattern: 'href="([^"]*\\.pdf)"',
    },
  },
}

// ============================================
// FRANCE: WebDelib (open-source, ADULLACT)
// ============================================
// Used by many French communes. Open-source platform for
// managing deliberations (délibérations).

export const webDelibTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}/seances',
    method: 'GET',
    meetingSelector: {
      pattern: 'seances/(\\d+)[^"]*"[^>]*>([^<]*)',
      groups: { id: 1, url: 1, title: 2 },
    },
    dateFormat: 'DD/MM/YYYY',
    protocolIndicators: ['Procès-verbal', 'PV', 'Délibération'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'pdf',
    pdf: {
      linkPattern: 'href="([^"]*\\.pdf)"',
    },
  },
}

// ============================================
// FRANCE: iDélibes
// ============================================

export const iDelibesTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}/deliberations',
    method: 'GET',
    meetingSelector: {
      pattern: 'deliberations/(\\d+)[^"]*"[^>]*>([^<]*)',
      groups: { id: 1, url: 1, title: 2 },
    },
    dateFormat: 'DD/MM/YYYY',
    protocolIndicators: ['Procès-verbal', 'Délibération'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'pdf',
    pdf: {
      linkPattern: 'href="([^"]*\\.pdf)"',
    },
  },
}

// ============================================
// NETHERLANDS: iBabs / NotuBiz
// ============================================

export const ibabsTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}/meetings',
    method: 'GET',
    meetingSelector: {
      pattern: 'meetings/(\\d+)[^"]*"[^>]*>([^<]*)',
      groups: { id: 1, url: 1, title: 2 },
    },
    dateFormat: 'DD-MM-YYYY',
    protocolIndicators: ['Notulen', 'Besluitenlijst'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'html',
    html: {
      contentSelectors: ['div.meeting-content', 'article', 'main'],
    },
  },
}

export const notubizTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}/vergaderingen',
    method: 'GET',
    meetingSelector: {
      pattern: 'vergadering/(\\d+)[^"]*"[^>]*>([^<]*)',
      groups: { id: 1, url: 1, title: 2 },
    },
    dateFormat: 'DD-MM-YYYY',
    protocolIndicators: ['Notulen', 'Besluitenlijst', 'Verslag'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'html',
    html: {
      contentSelectors: ['div.vergadering-content', 'article'],
    },
  },
}

// ============================================
// NORWAY: Municipal Protocols
// ============================================

export const norwayGenericTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}',
    method: 'GET',
    meetingSelector: {
      pattern: 'href="([^"]*protokoll[^"]*)"[^>]*>([^<]*)',
      groups: { url: 1, id: 1, title: 2 },
    },
    dateFormat: 'DD.MM.YYYY',
    protocolIndicators: ['Protokoll', 'Møteprotokoll'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'pdf',
    pdf: {
      linkPattern: 'href="([^"]*\\.pdf)"',
    },
  },
}

// ============================================
// DENMARK: Municipal Decisions
// ============================================

export const denmarkGenericTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}',
    method: 'GET',
    meetingSelector: {
      pattern: 'href="([^"]*referat[^"]*)"[^>]*>([^<]*)',
      groups: { url: 1, id: 1, title: 2 },
    },
    dateFormat: 'DD.MM.YYYY',
    protocolIndicators: ['Referat', 'Beslutningsprotokol'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'html',
    html: {
      contentSelectors: ['div.meeting-content', 'article', 'main'],
    },
  },
}

// ============================================
// SPAIN: Municipal Acts (Actas)
// ============================================

export const spainGenericTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}',
    method: 'GET',
    meetingSelector: {
      pattern: 'href="([^"]*acta[^"]*)"[^>]*>([^<]*)',
      groups: { url: 1, id: 1, title: 2 },
    },
    dateFormat: 'DD/MM/YYYY',
    protocolIndicators: ['Acta', 'Pleno', 'Sesión'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'pdf',
    pdf: {
      linkPattern: 'href="([^"]*\\.pdf)"',
    },
  },
}

// ============================================
// ITALY: Municipal Deliberations
// ============================================

export const italyGenericTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}',
    method: 'GET',
    meetingSelector: {
      pattern: 'href="([^"]*deliber[^"]*)"[^>]*>([^<]*)',
      groups: { url: 1, id: 1, title: 2 },
    },
    dateFormat: 'DD/MM/YYYY',
    protocolIndicators: ['Delibera', 'Verbale', 'Seduta'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'pdf',
    pdf: {
      linkPattern: 'href="([^"]*\\.pdf)"',
    },
  },
}

// ============================================
// PORTUGAL: Municipal Minutes (Atas)
// ============================================

export const portugalGenericTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}',
    method: 'GET',
    meetingSelector: {
      pattern: 'href="([^"]*ata[^"]*)"[^>]*>([^<]*)',
      groups: { url: 1, id: 1, title: 2 },
    },
    dateFormat: 'DD/MM/YYYY',
    protocolIndicators: ['Ata', 'Deliberação', 'Sessão'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'pdf',
    pdf: {
      linkPattern: 'href="([^"]*\\.pdf)"',
    },
  },
}

// ============================================
// POLAND: Municipal Protocols (BIP)
// ============================================
// Polish municipalities publish through BIP (Biuletyn Informacji Publicznej)

export const polandBipTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}',
    method: 'GET',
    meetingSelector: {
      pattern: 'href="([^"]*protok[^"]*)"[^>]*>([^<]*)',
      groups: { url: 1, id: 1, title: 2 },
    },
    dateFormat: 'DD.MM.YYYY',
    protocolIndicators: ['Protokół', 'Protokol'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'pdf',
    pdf: {
      linkPattern: 'href="([^"]*\\.pdf)"',
    },
  },
}

// ============================================
// CZECH REPUBLIC: Municipal Minutes (Zápis)
// ============================================

export const czechGenericTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}',
    method: 'GET',
    meetingSelector: {
      pattern: 'href="([^"]*zapis[^"]*)"[^>]*>([^<]*)',
      groups: { url: 1, id: 1, title: 2 },
    },
    dateFormat: 'DD.MM.YYYY',
    protocolIndicators: ['Zápis', 'Usnesení'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'pdf',
    pdf: {
      linkPattern: 'href="([^"]*\\.pdf)"',
    },
  },
}

// ============================================
// AUSTRIA: Municipal Protocols
// ============================================
// Austria uses similar systems to Germany (ALLRIS/SessionNet variants)

export const austriaGenericTemplate: FetcherConfig = {
  meetingList: {
    url: '{baseUrl}',
    method: 'GET',
    meetingSelector: {
      pattern: 'href="([^"]*(?:protokoll|sitzung)[^"]*)"[^>]*>([^<]*)',
      groups: { url: 1, id: 1, title: 2 },
    },
    dateFormat: 'DD.MM.YYYY',
    protocolIndicators: ['Protokoll', 'Niederschrift', 'Sitzungsprotokoll'],
    maxMeetings: 10,
  },
  contentExtraction: {
    strategy: 'pdf',
    pdf: {
      linkPattern: 'href="([^"]*\\.pdf)"',
    },
  },
}

// ============================================
// Template Registry
// ============================================

export const TEMPLATES: Record<string, FetcherConfig> = {
  // Finland
  cloudnc: cloudncTemplate,
  dynasty: dynastyTemplate,
  tweb: twebTemplate,
  'helsinki-paatokset': helsinkiPaatoksetTemplate,

  // Germany
  allris: allrisTemplate,
  sessionnet: sessionNetTemplate,
  sdnet: sdnetTemplate,

  // Estonia
  volis: volisTemplate,
  delta: deltaTemplate,

  // Sweden
  flexite: flexiteTemplate,
  'sweden-generic': swedenGenericTemplate,

  // France
  webdelib: webDelibTemplate,
  idelbes: iDelibesTemplate,

  // Netherlands
  ibabs: ibabsTemplate,
  notubiz: notubizTemplate,

  // Nordics
  'norway-generic': norwayGenericTemplate,
  'denmark-generic': denmarkGenericTemplate,

  // Southern Europe
  'spain-generic': spainGenericTemplate,
  'italy-generic': italyGenericTemplate,
  'portugal-generic': portugalGenericTemplate,

  // Central/Eastern Europe
  'poland-bip': polandBipTemplate,
  'czech-generic': czechGenericTemplate,
  'austria-generic': austriaGenericTemplate,
}

/**
 * Get a template config for a known system type.
 * Returns null if no template exists.
 */
export function getTemplate(systemType: string): FetcherConfig | null {
  return TEMPLATES[systemType] || null
}
