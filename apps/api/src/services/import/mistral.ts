/**
 * Mistral AI Integration Service
 *
 * Uses Mistral Large for generating summaries of civic content.
 * Mistral is EU-based (Paris), GDPR-compliant.
 *
 * Minutes processing uses a 3-stage agentic pipeline:
 *  1. Editorial Gate — split minutes into items, decide newsworthiness
 *  2. Article Writing — write focused article from a single item excerpt
 *  3. Verification — cross-check article against original source text
 */

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'

interface MistralMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface MistralResponse {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface SummaryResult {
  title: string
  summary: string
  tags: string[]
  keyPoints: string[]
  discussionPrompt: string
}

/**
 * Rate limiting configuration.
 *
 * Currently using Mistral free tier which allows max 1 request/second.
 * Using 2s delay to stay safely under the limit.
 *
 * When upgrading to a paid Mistral plan:
 *  1. Reduce API_CALL_DELAY_MS to 500 or remove entirely
 *  2. The retry logic will still handle any occasional 429s
 */
const API_CALL_DELAY_MS = 2_000 // 2s between calls → safe under 1 req/s (free tier)
const MAX_RETRIES = 5
let lastCallTime = 0

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Wait until enough time has passed since the last API call.
 * Enforces a global rate limit across all Mistral calls.
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastCallTime
  if (elapsed < API_CALL_DELAY_MS) {
    const waitMs = API_CALL_DELAY_MS - elapsed
    console.log(`   ⏳ Rate limit: waiting ${Math.ceil(waitMs / 1000)}s...`)
    await sleep(waitMs)
  }
}

/**
 * Helper: call Mistral API with retry and rate limiting.
 * Handles 429 (rate limited) and 5xx errors with exponential backoff.
 */
async function callMistral(messages: MistralMessage[], options?: {
  temperature?: number
  maxTokens?: number
}): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY not configured')
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Respect global rate limit
    await waitForRateLimit()

    lastCallTime = Date.now()

    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.MISTRAL_MODEL || 'mistral-large-latest',
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 2000,
        response_format: { type: 'json_object' }
      })
    })

    if (response.ok) {
      const data = await response.json() as MistralResponse
      const content = data.choices[0]?.message?.content

      if (!content) {
        throw new Error('Empty response from Mistral')
      }

      return content
    }

    // Retry on rate limit (429) or server errors (5xx)
    const status = response.status
    if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = response.headers.get('retry-after')
      const backoffMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(60_000 * Math.pow(2, attempt), 300_000) // 60s, 120s, 240s, 300s, 300s
      console.log(`   ⏳ Mistral ${status} — retry ${attempt + 1}/${MAX_RETRIES} in ${Math.ceil(backoffMs / 1000)}s`)
      await sleep(backoffMs)
      continue
    }

    const errorText = await response.text()
    throw new Error(`Mistral API error: ${status} - ${errorText}`)
  }

  throw new Error(`Mistral API: max retries (${MAX_RETRIES}) exceeded`)
}

// ============================================
// STAGE 1: EDITORIAL GATE (uutiskynnys)
// ============================================

export interface EditorialItem {
  itemNumber: string     // e.g. "§ 5"
  title: string          // Original title from minutes
  excerpt: string        // Verbatim excerpt from the source
  newsworthy: boolean    // Does this pass the editorial gate?
  reason: string         // Why newsworthy or not
}

/**
 * Stage 1: Editorial Gate
 *
 * Splits meeting minutes into individual agenda items and decides
 * which ones are newsworthy. Filters out procedural/technical items.
 */
export async function editorialGate(
  fullText: string,
  municipalityName: string,
  organ?: string
): Promise<EditorialItem[]> {
  const systemPrompt = `Olet uutistoimituksen portinvartija. Tehtäväsi on jäsentää kunnan pöytäkirja erillisiin päätöskohtiin ja arvioida jokaisen uutisarvo.

HYLKÄÄ (newsworthy: false) kokoustekniset asiat:
- Kokouksen avaus ja järjestäytyminen
- Kokouksen laillisuus ja päätösvaltaisuus
- Pöytäkirjantarkastajien valinta
- Kokouksen päättäminen
- Esityslistan hyväksyminen
- Edellisen kokouksen pöytäkirjan hyväksyminen
- Muut puhtaasti hallinnolliset menettelyt joilla ei ole vaikutusta kuntalaisiin

HYVÄKSY (newsworthy: true) asiat joilla on merkitystä kuntalaisille:
- Kaavoitus, rakentaminen, infrastruktuuri
- Palvelut (koulut, päiväkodit, terveys, liikunta)
- Talous, verotus, budjetti
- Ympäristö, luonto
- Tapahtumat, kulttuuri
- Henkilöstö- ja organisaatiopäätökset jotka vaikuttavat palveluihin
- Äänestykset tai erimielisyydet
- Mikä tahansa muu asia joka vaikuttaa asukkaiden arkeen

TÄRKEÄÄ "excerpt"-kenttään:
- Kopioi alkuperäisestä tekstistä kyseisen pykälän KOKO sisältö sanatarkasti
- Älä tiivistä tai muokkaa — kopioi sellaisenaan
- Ota mukaan kaikki yksityiskohdat, numerot, rahamäärät, päivämäärät

Vastaa JSON-muodossa:
{
  "items": [
    {
      "itemNumber": "§ 1",
      "title": "Asian otsikko pöytäkirjasta",
      "excerpt": "Koko pykälän alkuperäinen teksti sanatarkasti kopioituna...",
      "newsworthy": true,
      "reason": "Lyhyt perustelu miksi tämä on/ei ole uutisarvoinen"
    }
  ]
}`

  const userPrompt = `Jäsennä ja arvioi ${municipalityName}n ${organ || 'kunnan'} pöytäkirja:

---
${fullText.slice(0, 30000)}
${fullText.length > 30000 ? '\n\n[Teksti katkaistu pituuden vuoksi...]' : ''}
---`

  const content = await callMistral([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], { temperature: 0.1, maxTokens: 8000 })

  try {
    const parsed = JSON.parse(content)
    const items = Array.isArray(parsed) ? parsed : (parsed.items || [])
    return items.map((item: EditorialItem) => ({
      itemNumber: item.itemNumber || '§ ?',
      title: item.title || 'Nimetön asia',
      excerpt: item.excerpt || '',
      newsworthy: item.newsworthy ?? false,
      reason: item.reason || ''
    }))
  } catch {
    console.error('Failed to parse editorial gate response:', content.slice(0, 200))
    return []
  }
}

// ============================================
// STAGE 2: ARTICLE WRITING
// ============================================

/**
 * Stage 2: Write Article
 *
 * Creates a focused civic article from a single agenda item excerpt.
 * Uses ONLY the provided excerpt + metadata — no hallucination.
 */
export async function writeArticle(
  excerpt: string,
  municipalityName: string,
  itemNumber: string,
  organ?: string
): Promise<SummaryResult> {
  const systemPrompt = `Olet kansalaisfoorumin toimittaja. Kirjoita selkeä uutinen yhdestä kunnan päätöksestä.

Käytettävissäsi on VAIN alla oleva pöytäkirjan ote. ÄLÄ keksi mitään mikä ei ole tekstissä.

Ohjeet:
- Kirjoita selkeästi, vältä kapulakieltä ja byrokratiakieltä
- Kerro mitä päätettiin ja miksi se vaikuttaa kunnan asukkaisiin
- Nosta esiin rahamäärät, päivämäärät ja konkreettiset vaikutukset
- Jos asiasta äänestettiin tai jätettiin eriävä mielipide, mainitse se
- Ole neutraali — älä ota kantaa
- Otsikon tulee olla informatiivinen, ei klikkiotsikko

Vastaa JSON-muodossa:
{
  "title": "Selkeä otsikko (max 100 merkkiä)",
  "summary": "2-4 kappaleen uutisteksti selkokielellä.",
  "tags": ["aihetunniste1", "aihetunniste2"],
  "keyPoints": ["Keskeisin asia", "Toinen tärkeä asia"],
  "discussionPrompt": "Keskustelukysymys asukkaille"
}`

  const userPrompt = `Kirjoita uutinen seuraavasta ${municipalityName}n ${organ || 'kunnan'} päätöksestä (${itemNumber}):

---
${excerpt.slice(0, 15000)}
---

Vastaa vain JSON-muodossa, ei muuta tekstiä.`

  const content = await callMistral([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], { temperature: 0.3, maxTokens: 2000 })

  try {
    const parsed = JSON.parse(content) as SummaryResult
    return {
      title: parsed.title || 'Kunnan päätös',
      summary: parsed.summary || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      discussionPrompt: parsed.discussionPrompt || 'Mitä mieltä olet tästä päätöksestä?'
    }
  } catch (err) {
    console.error('Failed to parse article response:', content.slice(0, 200))
    throw new Error('Invalid JSON response from Mistral (article)')
  }
}

// ============================================
// STAGE 3: VERIFICATION
// ============================================

export interface VerificationResult {
  passed: boolean
  issues: string[]       // List of factual issues found
  severity: 'none' | 'minor' | 'major'  // Overall severity
}

/**
 * Stage 3: Verify Article
 *
 * Cross-checks the written article against the original source text.
 * Catches hallucinations, wrong numbers, misattributions, etc.
 */
export async function verifyArticle(
  article: SummaryResult,
  originalExcerpt: string,
  municipalityName: string
): Promise<VerificationResult> {
  const systemPrompt = `Olet faktantarkistaja. Vertaa kirjoitettua uutista alkuperäiseen pöytäkirjaotteeseen.

Tarkista:
1. Ovatko kaikki uutisessa mainitut faktat (päivämäärät, rahamäärät, henkilöt, päätökset) alkuperäisessä tekstissä?
2. Onko jotain keksitty tai lisätty mitä alkuperäisessä EI ole?
3. Onko jokin fakta vääristelty tai väärin tulkittu?
4. Onko äänestystulos tai muu yksityiskohta raportoitu oikein?

ÄLÄ arvioi kirjoitustyyliä tai otsikkoa — tarkista VAIN faktuaalinen oikeellisuus.

Vastaa JSON-muodossa:
{
  "passed": true/false,
  "issues": ["Ongelma 1", "Ongelma 2"],
  "severity": "none" | "minor" | "major"
}

- "none": Ei ongelmia, kaikki faktat vastaavat
- "minor": Pieni epätarkkuus, mutta ei harhaanjohtava
- "major": Fakta väärin, keksitty tieto, tai harhaanjohtava`

  const userPrompt = `UUTINEN:

Otsikko: ${article.title}

${article.summary}

Keskeiset kohdat:
${article.keyPoints.map(p => `- ${p}`).join('\n')}

---

ALKUPERÄINEN PÖYTÄKIRJAOTE (${municipalityName}):

${originalExcerpt.slice(0, 15000)}

---

Vertaa uutista alkuperäiseen. Vastaa vain JSON-muodossa.`

  const content = await callMistral([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], { temperature: 0.1, maxTokens: 1000 })

  try {
    const parsed = JSON.parse(content)
    return {
      passed: parsed.passed ?? true,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      severity: parsed.severity || 'none'
    }
  } catch {
    // If verification itself fails, pass with warning
    console.error('Failed to parse verification response:', content.slice(0, 200))
    return { passed: true, issues: ['Verification parsing failed'], severity: 'minor' }
  }
}

// ============================================
// LEGACY: single-call summary (kept for compatibility)
// ============================================

/**
 * Generate a civic-friendly summary of meeting minutes content
 * @deprecated Use the 3-stage pipeline (editorialGate → writeArticle → verifyArticle) instead
 */
export async function generateMinutesSummary(
  originalText: string,
  municipalityName: string,
  meetingType?: string
): Promise<SummaryResult> {
  const systemPrompt = `Olet kansalaisfoorumin avustaja. Tehtäväsi on muuttaa kunnan pöytäkirja ymmärrettävään muotoon keskustelun pohjaksi.

Ohjeet:
- Kirjoita selkeästi, vältä kapulakieltä ja byrokratiakieltä
- Kerro mitä päätettiin ja miksi se vaikuttaa kunnan asukkaisiin
- Nosta esiin jos päätös ei ollut yksimielinen tai jos asiasta äänestettiin
- Ole neutraali - älä ota kantaa päätöksiin
- Älä keksi faktoja, käytä vain alkuperäistekstin tietoja

Vastaa JSON-muodossa:
{
  "title": "Selkeä otsikko päätökselle (max 100 merkkiä)",
  "summary": "2-4 kappaleen yhteenveto selkokielellä.",
  "tags": ["aihetunniste1", "aihetunniste2"],
  "keyPoints": ["Keskeisin päätös", "Toinen tärkeä asia"],
  "discussionPrompt": "Keskustelukysymys asukkaille"
}`

  const content = await callMistral([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Tee yhteenveto ${municipalityName}n kunnan ${meetingType || 'kokouksen'} pöytäkirjasta:\n\n---\n${originalText.slice(0, 12000)}\n---\n\nVastaa vain JSON-muodossa.` }
  ])

  try {
    const parsed = JSON.parse(content) as SummaryResult
    return {
      title: parsed.title || 'Kunnan päätös',
      summary: parsed.summary || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      discussionPrompt: parsed.discussionPrompt || 'Mitä mieltä olet tästä päätöksestä?'
    }
  } catch (err) {
    console.error('Failed to parse Mistral response:', content.slice(0, 200))
    throw new Error('Invalid JSON response from Mistral')
  }
}

/**
 * Extended result for ministry summaries — includes scope classification.
 */
export interface MinistrySummaryResult extends SummaryResult {
  scope: 'national' | 'local'
  /** Region/municipality name if scope is 'local' (e.g. "Kanta-Häme") */
  region?: string
}

/**
 * Generate a civic-friendly summary of ministry/government content.
 * Also classifies scope: 'national' vs 'local' (regional decisions).
 */
export async function generateMinistrySummary(
  originalText: string,
  institutionName: string,
  contentType: string
): Promise<MinistrySummaryResult> {
  const contentTypeLabel = contentType === 'press' ? 'tiedotteen' : contentType === 'law' ? 'lakiuutisen' : 'päätöksen'

  const content = await callMistral([
    { role: 'system', content: `Olet kansalaisfoorumin avustaja. Tehtäväsi on tiivistää ${institutionName}n ${contentTypeLabel} ymmärrettävään muotoon keskustelun pohjaksi.

Ohjeet:
- Kerro mitä päätettiin/tiedotetaan ja miksi se vaikuttaa kansalaisiin
- Kirjoita selkeästi, vältä kapulakieltä ja byrokratiakieltä
- Ole neutraali - älä ota kantaa
- Nosta esiin tärkeimmät kohdat
- Älä keksi faktoja, käytä vain alkuperäistekstin tietoja

Luokittele scope:
- "national": koskee koko Suomea (esim. verotus, lait, yleinen talouspolitiikka)
- "local": koskee yhtä tiettyä aluetta, kuntaa tai hyvinvointialuetta (esim. lainanottovaltuus Kanta-Hämeelle, Pohjois-Savon sairaalahanke)

Vastaa JSON-muodossa:
{
  "title": "Selkeä otsikko (max 100 merkkiä)",
  "summary": "2-4 kappaleen yhteenveto selkokielellä.",
  "tags": ["aihetunniste1", "aihetunniste2"],
  "keyPoints": ["Keskeisin asia", "Toinen tärkeä asia"],
  "discussionPrompt": "Keskustelukysymys kansalaisille",
  "scope": "national tai local",
  "region": "Alueen nimi jos local, muuten null"
}` },
    { role: 'user', content: `Tee yhteenveto seuraavasta ${institutionName}n ${contentTypeLabel}sta:\n\n---\n${originalText.slice(0, 12000)}\n---\n\nVastaa vain JSON-muodossa.` }
  ])

  try {
    const parsed = JSON.parse(content)
    return {
      title: parsed.title || `${institutionName}: päätös`,
      summary: parsed.summary || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      discussionPrompt: parsed.discussionPrompt || 'Mitä mieltä olet tästä?',
      scope: parsed.scope === 'local' ? 'local' : 'national',
      region: parsed.region || undefined
    }
  } catch {
    console.error('Failed to parse Mistral response:', content.slice(0, 200))
    throw new Error('Invalid JSON response from Mistral')
  }
}

/**
 * Generate a civic-friendly summary of EU content (English → Finnish)
 */
export async function generateEuSummary(
  originalText: string,
  institutionName: string,
  contentType: string
): Promise<SummaryResult> {
  const content = await callMistral([
    { role: 'system', content: `You are a civic forum assistant. Your task is to summarize content from ${institutionName} for Finnish citizens.

Instructions:
- Explain what was decided and how it affects EU citizens, particularly in Finland
- Write ALL output in Finnish (the source text may be in English)
- Be neutral and factual
- Avoid bureaucratic language, write in plain Finnish
- Highlight the most important points
- Do not fabricate facts, use only information from the source text

Respond in JSON format:
{
  "title": "Clear title in Finnish (max 100 characters)",
  "summary": "2-4 paragraph summary in plain Finnish.",
  "tags": ["tag1", "tag2"],
  "keyPoints": ["Key point 1 in Finnish", "Key point 2 in Finnish"],
  "discussionPrompt": "Discussion question for citizens in Finnish"
}` },
    { role: 'user', content: `Summarize this ${institutionName} ${contentType} for Finnish citizens:\n\n---\n${originalText.slice(0, 12000)}\n---\n\nRespond ONLY in JSON format. All fields must be in Finnish.` }
  ])

  try {
    const parsed = JSON.parse(content) as SummaryResult
    return {
      title: parsed.title || `${institutionName}: päätös`,
      summary: parsed.summary || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      discussionPrompt: parsed.discussionPrompt || 'Mitä mieltä olet tästä EU-päätöksestä?'
    }
  } catch {
    console.error('Failed to parse Mistral response:', content.slice(0, 200))
    throw new Error('Invalid JSON response from Mistral')
  }
}
