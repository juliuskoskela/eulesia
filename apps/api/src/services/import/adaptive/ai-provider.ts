/**
 * Multi-Provider AI Service
 *
 * Routes AI tasks to different providers based on task type:
 * - Config generation / self-healing → GPT-5.2 or Claude (high capability)
 * - System classification → Mistral (cost-effective)
 * - Editorial pipeline → Mistral (existing, EU-hosted)
 *
 * Provider selection:
 * 1. If OPENAI_API_KEY is set → use OpenAI for complex tasks
 * 2. If ANTHROPIC_API_KEY is set → use Claude for complex tasks
 * 3. Fallback → Mistral for everything
 */

interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AiCallOptions {
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
}

type TaskType = 'config-generation' | 'classification' | 'editorial' | 'self-healing'

// ============================================
// Rate Limiting
// ============================================

const rateLimits: Record<string, { lastCallTime: number; delayMs: number }> = {
  mistral: { lastCallTime: 0, delayMs: parseInt(process.env.MISTRAL_RATE_LIMIT_MS || '500', 10) },
  openai: { lastCallTime: 0, delayMs: 200 },
  anthropic: { lastCallTime: 0, delayMs: 200 },
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForRateLimit(provider: string): Promise<void> {
  const limit = rateLimits[provider]
  if (!limit) return

  const now = Date.now()
  const elapsed = now - limit.lastCallTime
  if (elapsed < limit.delayMs) {
    await sleep(limit.delayMs - elapsed)
  }
  limit.lastCallTime = Date.now()
}

// ============================================
// Provider Implementations
// ============================================

async function callMistralDirect(messages: AiMessage[], options: AiCallOptions = {}): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) throw new Error('MISTRAL_API_KEY not configured')

  await waitForRateLimit('mistral')

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 4000,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Mistral API ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

async function callOpenAI(messages: AiMessage[], options: AiCallOptions = {}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  await waitForRateLimit('openai')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CONFIG_MODEL || 'gpt-4o',
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4000,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

async function callAnthropic(messages: AiMessage[], options: AiCallOptions = {}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  await waitForRateLimit('anthropic')

  // Convert messages to Anthropic format (system prompt separate)
  const systemMessage = messages.find(m => m.role === 'system')
  const userMessages = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_CONFIG_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: options.maxTokens ?? 4000,
      temperature: options.temperature ?? 0.2,
      ...(systemMessage ? { system: systemMessage.content } : {}),
      messages: userMessages,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic API ${response.status}: ${err}`)
  }

  const data = await response.json()
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
  return textBlock?.text || ''
}

// ============================================
// Provider Selection & Routing
// ============================================

function getProviderForTask(taskType: TaskType): 'openai' | 'anthropic' | 'mistral' {
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY

  switch (taskType) {
    case 'config-generation':
    case 'self-healing':
      // Complex tasks: prefer GPT/Claude, fallback to Mistral
      if (hasOpenAI) return 'openai'
      if (hasAnthropic) return 'anthropic'
      return 'mistral'

    case 'classification':
      // Simple classification: Mistral is sufficient
      return 'mistral'

    case 'editorial':
      // Editorial pipeline: always Mistral (existing, EU-hosted, GDPR)
      return 'mistral'

    default:
      return 'mistral'
  }
}

const MAX_RETRIES = 3

/**
 * Call AI with automatic provider selection and retry logic.
 */
export async function callAi(
  taskType: TaskType,
  messages: AiMessage[],
  options: AiCallOptions = {}
): Promise<string> {
  const provider = getProviderForTask(taskType)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      switch (provider) {
        case 'openai':
          return await callOpenAI(messages, options)
        case 'anthropic':
          return await callAnthropic(messages, options)
        case 'mistral':
          return await callMistralDirect(messages, options)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)

      if (attempt < MAX_RETRIES) {
        // On provider error, try fallback
        if (attempt === MAX_RETRIES - 1 && provider !== 'mistral') {
          console.log(`   [ai] ${provider} failed, falling back to Mistral: ${errMsg}`)
          try {
            return await callMistralDirect(messages, options)
          } catch {
            // Mistral fallback also failed
          }
        }

        const backoffMs = Math.min(5000 * Math.pow(2, attempt), 60000)
        console.log(`   [ai] Retry ${attempt + 1}/${MAX_RETRIES} in ${Math.ceil(backoffMs / 1000)}s: ${errMsg}`)
        await sleep(backoffMs)
        continue
      }

      throw new Error(`AI call failed after ${MAX_RETRIES} retries (${provider}): ${errMsg}`)
    }
  }

  throw new Error('AI call: max retries exceeded')
}

/**
 * Parse JSON from AI response, handling markdown code blocks.
 */
export function parseAiJson<T = unknown>(response: string): T {
  // Strip markdown code blocks if present
  let cleaned = response.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }
  return JSON.parse(cleaned) as T
}
