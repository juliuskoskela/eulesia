/**
 * Mistral AI Integration Service
 *
 * Uses Mistral Large for generating summaries of municipal meeting minutes.
 * Mistral is EU-based (Paris), GDPR-compliant.
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
 * Generate a civic-friendly summary of meeting minutes content
 */
export async function generateMinutesSummary(
  originalText: string,
  municipalityName: string,
  meetingType?: string
): Promise<SummaryResult> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY not configured')
  }

  const systemPrompt = `Olet kansalaisfoorumin avustaja. Tehtäväsi on muuttaa kunnan pöytäkirja ymmärrettävään muotoon keskustelun pohjaksi.

Ohjeet:
- Kirjoita selkeästi, vältä kapulakieltä ja byrokratiakieltä
- Kerro mitä päätettiin ja miksi se vaikuttaa kunnan asukkaisiin
- Nosta esiin jos päätös ei ollut yksimielinen tai jos asiasta äänestettiin
- Ole neutraali - älä ota kantaa päätöksiin
- Älä keksi faktoja, käytä vain alkuperäistekstin tietoja
- Jos kyseessä on esityslista (ei pöytäkirja), mainitse että päätöksiä ei ole vielä tehty

Vastaa JSON-muodossa:
{
  "title": "Selkeä otsikko päätökselle (max 100 merkkiä)",
  "summary": "2-4 kappaleen yhteenveto selkokielellä. Kerro mitä päätettiin, miksi, ja miten se vaikuttaa asukkaisiin.",
  "tags": ["aihetunniste1", "aihetunniste2"],
  "keyPoints": ["Keskeisin päätös", "Toinen tärkeä asia", "Kolmas huomio"],
  "discussionPrompt": "Keskustelukysymys asukkaille, esim. 'Mitä mieltä olet tästä päätöksestä?'"
}`

  const userPrompt = `Tee yhteenveto seuraavasta ${municipalityName}n kunnan ${meetingType || 'kokouksen'} pöytäkirjasta:

---
${originalText.slice(0, 12000)}
${originalText.length > 12000 ? '\n\n[Teksti katkaistu pituuden vuoksi...]' : ''}
---

Vastaa vain JSON-muodossa, ei muuta tekstiä.`

  const messages: MistralMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'mistral-large-latest',  // Auto-points to latest Large model
      messages,
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Mistral API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json() as MistralResponse
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('Empty response from Mistral')
  }

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
    console.error('Failed to parse Mistral response:', content)
    throw new Error('Invalid JSON response from Mistral')
  }
}

/**
 * Split long meeting minutes into separate decision items
 */
export async function splitMinutesIntoItems(
  fullText: string,
  municipalityName: string
): Promise<{ itemNumber: string; title: string; content: string }[]> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY not configured')
  }

  const systemPrompt = `Olet pöytäkirjojen jäsentäjä. Tehtäväsi on pilkkoa kuntakokouksen pöytäkirja erillisiin päätöskohtiin.

Palauta JSON-array, jossa jokainen päätöskohta on erillinen objekti:
[
  {
    "itemNumber": "§ 1",
    "title": "Asian otsikko",
    "content": "Koko päätöskohdan teksti..."
  }
]

Ohita tekniset/hallinnolliset kohdat kuten:
- Kokouksen avaus
- Kokouksen laillisuus ja päätösvaltaisuus
- Pöytäkirjantarkastajien valinta
- Kokouksen päättäminen
- Ilmoitusasiat (ellei sisällä merkittävää päätöstä)

Keskity päätöksiin, jotka vaikuttavat kuntalaisiin.`

  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'mistral-large-latest',  // Auto-points to latest Large model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Jäsennä ${municipalityName}n pöytäkirja:\n\n${fullText.slice(0, 30000)}` }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status}`)
  }

  const data = await response.json() as MistralResponse
  const content = data.choices[0]?.message?.content

  try {
    const parsed = JSON.parse(content || '[]')
    // Handle both array and object with items property
    const items = Array.isArray(parsed) ? parsed : (parsed.items || [])
    return items
  } catch {
    return []
  }
}
