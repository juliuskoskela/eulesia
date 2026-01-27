#!/usr/bin/env npx tsx
/**
 * Quick test for Mistral API integration
 *
 * Usage:
 *   cd apps/api && npx tsx src/services/import/test-mistral.ts
 */

import 'dotenv/config'
import { generateMinutesSummary } from './mistral.js'

const TEST_MINUTES = `
RAUTALAMMIN KUNTA
KUNNANHALLITUS
PÖYTÄKIRJA 5/2024

§ 45 Kunnan talousarvion muutos

Kunnanhallitus päätti esittää valtuustolle, että vuoden 2024 talousarvioon tehdään seuraavat muutokset:

1. Teknisen toimen määrärahaa korotetaan 150 000 eurolla koulurakennuksen korjaustöihin
2. Sosiaalitoimen määrärahaa korotetaan 80 000 eurolla lisääntyneiden palvelutarpeiden vuoksi

Päätös oli yksimielinen.

Esittelijä: Kunnanjohtaja Matti Virtanen
Valmistelija: Talousjohtaja Anna Korhonen

Asiaan liittyvät asiakirjat:
- Talousarvioesitys 2024
- Teknisen toimen selvitys korjaustarpeista
- Sosiaalitoimen palvelutarveselvitys
`

async function main() {
  console.log('Testing Mistral API integration...\n')

  if (!process.env.MISTRAL_API_KEY) {
    console.error('❌ MISTRAL_API_KEY not set in .env')
    process.exit(1)
  }

  console.log('✅ API key found')
  console.log('📤 Sending test request...\n')

  try {
    const result = await generateMinutesSummary(TEST_MINUTES, 'Rautalampi', 'kunnanhallituksen kokous')

    console.log('='.repeat(50))
    console.log('RESULT')
    console.log('='.repeat(50))
    console.log()
    console.log(`Title: ${result.title}`)
    console.log()
    console.log('Summary:')
    console.log(result.summary)
    console.log()
    console.log('Tags:', result.tags.join(', '))
    console.log()
    console.log('Key Points:')
    result.keyPoints.forEach(p => console.log(`  - ${p}`))
    console.log()
    console.log('Discussion Prompt:')
    console.log(`  "${result.discussionPrompt}"`)
    console.log()
    console.log('✅ Mistral integration working!')

  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

main()
