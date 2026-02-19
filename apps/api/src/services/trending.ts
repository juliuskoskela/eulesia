/**
 * Discovery & Trending Service
 *
 * Implements the Civic Value Score (CVS) — a transparent, deterministic
 * ranking formula designed for civic discourse. No ML, no black box.
 *
 * CVS = engagement × source_quality × freshness
 *
 * Engagement weights discussion quality over passive voting:
 *   (score × 1.5) + (replies × 2.0) + (unique_repliers × 3.0) + (views × 0.01)
 *
 * Source quality boosts institutional/democratic content:
 *   minutes_import → ×1.5, rss_import → ×1.3, institution → ×1.2, verified → ×1.1
 *
 * Freshness decays with a 24h half-life (institutional content: 72h):
 *   1 / (1 + hours/halflife)^0.8
 *
 * Full documentation available at GET /api/v1/discover/algorithm
 */

import { db, threads, comments, threadVotes, trendingCache, threadTags } from '../db/index.js'
import { eq, and, gt, sql, desc, count, countDistinct } from 'drizzle-orm'

// ============================================
// CIVIC VALUE SCORE (CVS)
// ============================================

export interface CvsBreakdown {
  engagement: number
  sourceQuality: number
  freshness: number
  total: number
}

export interface ScoredThread {
  id: string
  title: string
  score: number
  replyCount: number
  viewCount: number
  source: string
  authorRole: string
  authorVerified: boolean
  createdAt: Date
  uniqueRepliers: number
  cvsScore: number
  scoreBreakdown: CvsBreakdown
}

/**
 * Compute the Civic Value Score for a thread.
 * Fully deterministic — same inputs always produce same output.
 */
export function computeCivicValueScore(thread: {
  score: number
  replyCount: number
  viewCount: number
  uniqueRepliers: number
  source: string
  authorRole: string
  authorVerified: boolean
  createdAt: Date
  isInstitutional?: boolean
}): CvsBreakdown {
  // 1. Engagement: discussion > votes > views
  const engagement = Math.max(0,
    (thread.score * 1.5) +
    (thread.replyCount * 2.0) +
    (thread.uniqueRepliers * 3.0) +
    (thread.viewCount * 0.01)
  )

  // 2. Source quality multiplier
  let sourceQuality = 1.0
  if (thread.source === 'minutes_import') {
    sourceQuality = 1.5 // Municipal meeting minutes — core civic content
  } else if (thread.source === 'rss_import') {
    sourceQuality = 1.3 // Government/EU press releases
  } else if (thread.authorRole === 'institution') {
    sourceQuality = 1.2 // Verified institution
  } else if (thread.authorVerified) {
    sourceQuality = 1.1 // Identity-verified citizen
  }

  // 3. Freshness decay
  const ageMs = Date.now() - thread.createdAt.getTime()
  const ageHours = ageMs / (1000 * 60 * 60)

  // Institutional content decays slower (72h half-life vs 24h)
  const halflife = (thread.source === 'minutes_import' || thread.source === 'rss_import') ? 72 : 24
  const freshness = 1.0 / Math.pow(1.0 + ageHours / halflife, 0.8)

  const total = engagement * sourceQuality * freshness

  return {
    engagement: Math.round(engagement * 100) / 100,
    sourceQuality: Math.round(sourceQuality * 100) / 100,
    freshness: Math.round(freshness * 1000) / 1000,
    total: Math.round(total * 100) / 100
  }
}

// ============================================
// EXPLORE FEED QUERY
// ============================================

/**
 * Get CVS-ranked threads for the Explore (Tutustu) feed.
 * Returns threads from the last 7 days, scored and sorted by CVS.
 */
export async function getExploreFeed(options: {
  page?: number
  limit?: number
  scope?: string
} = {}): Promise<{
  items: ScoredThread[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}> {
  const page = options.page || 1
  const limit = Math.min(options.limit || 20, 50)
  const offset = (page - 1) * limit

  // Step 1: Get candidate threads from last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const conditions = [
    eq(threads.isHidden, false),
    gt(threads.createdAt, sevenDaysAgo)
  ]

  if (options.scope && options.scope !== 'all') {
    conditions.push(eq(threads.scope, options.scope as 'local' | 'national' | 'european'))
  }

  // Fetch top 200 candidates by score + reply count (pre-filter)
  const candidates = await db
    .select({
      id: threads.id,
      title: threads.title,
      score: threads.score,
      replyCount: threads.replyCount,
      viewCount: threads.viewCount,
      source: threads.source,
      createdAt: threads.createdAt,
      authorId: threads.authorId
    })
    .from(threads)
    .where(and(...conditions))
    .orderBy(desc(threads.score), desc(threads.replyCount))
    .limit(200)

  if (candidates.length === 0) {
    return { items: [], total: 0, page, limit, hasMore: false }
  }

  // Step 2: Get unique repliers count for each candidate
  const candidateIds = candidates.map(c => c.id)

  const replierCounts = await db
    .select({
      threadId: comments.threadId,
      uniqueRepliers: countDistinct(comments.authorId)
    })
    .from(comments)
    .where(sql`${comments.threadId} = ANY(${candidateIds})`)
    .groupBy(comments.threadId)

  const replierMap = new Map(replierCounts.map(r => [r.threadId, Number(r.uniqueRepliers)]))

  // Step 3: Get author info (role, verified) — batch query
  const authorIds = [...new Set(candidates.map(c => c.authorId))]
  const { users } = await import('../db/index.js')

  const authorInfos = await db
    .select({
      id: users.id,
      role: users.role,
      identityVerified: users.identityVerified
    })
    .from(users)
    .where(sql`${users.id} = ANY(${authorIds})`)

  const authorMap = new Map(authorInfos.map(a => [a.id, a]))

  // Step 4: Compute CVS for each candidate
  const scoredThreads: ScoredThread[] = candidates.map(thread => {
    const author = authorMap.get(thread.authorId) || { role: 'citizen' as const, identityVerified: false }
    const uniqueRepliers = replierMap.get(thread.id) || 0

    const authorRole = author.role || 'citizen'

    const breakdown = computeCivicValueScore({
      score: thread.score || 0,
      replyCount: thread.replyCount || 0,
      viewCount: thread.viewCount || 0,
      uniqueRepliers,
      source: thread.source || 'user',
      authorRole,
      authorVerified: author.identityVerified || false,
      createdAt: thread.createdAt || new Date()
    })

    return {
      id: thread.id,
      title: thread.title,
      score: thread.score || 0,
      replyCount: thread.replyCount || 0,
      viewCount: thread.viewCount || 0,
      source: thread.source || 'user',
      authorRole,
      authorVerified: author.identityVerified || false,
      createdAt: thread.createdAt || new Date(),
      uniqueRepliers,
      cvsScore: breakdown.total,
      scoreBreakdown: breakdown
    }
  })

  // Step 5: Sort by CVS and paginate
  scoredThreads.sort((a, b) => b.cvsScore - a.cvsScore)

  const total = scoredThreads.length
  const paged = scoredThreads.slice(offset, offset + limit)

  return {
    items: paged,
    total,
    page,
    limit,
    hasMore: offset + limit < total
  }
}

// ============================================
// TRENDING COMPUTATION
// ============================================

/**
 * Compute trending threads.
 * Uses chi-squared-like deviation: threads with engagement
 * accelerating faster than expected are trending.
 *
 * trending_score = ((observed_6h - expected)²) / expected × 0.5^(age_h / 12)
 *
 * Minimum threshold: 3 interactions in 6 hours.
 */
export async function computeTrendingThreads(): Promise<{
  entityId: string
  score: number
  metadata: Record<string, unknown>
}[]> {
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)

  // Get threads from last 48h with their total and recent engagement
  const candidates = await db
    .select({
      id: threads.id,
      title: threads.title,
      scope: threads.scope,
      score: threads.score,
      replyCount: threads.replyCount,
      createdAt: threads.createdAt
    })
    .from(threads)
    .where(and(
      eq(threads.isHidden, false),
      gt(threads.createdAt, twoDaysAgo)
    ))

  const results: { entityId: string; score: number; metadata: Record<string, unknown> }[] = []

  for (const thread of candidates) {
    // Count recent interactions (votes + comments in last 6h)
    const [recentVotes] = await db
      .select({ count: count() })
      .from(threadVotes)
      .where(and(
        eq(threadVotes.threadId, thread.id),
        gt(threadVotes.createdAt, sixHoursAgo)
      ))

    const [recentComments] = await db
      .select({ count: count() })
      .from(comments)
      .where(and(
        eq(comments.threadId, thread.id),
        gt(comments.createdAt, sixHoursAgo)
      ))

    const observed = (recentVotes?.count || 0) + (recentComments?.count || 0)

    // Minimum threshold
    if (observed < 3) continue

    // Calculate expected rate
    const totalInteractions = Math.abs(thread.score || 0) + (thread.replyCount || 0)
    const ageHours = (Date.now() - (thread.createdAt?.getTime() || Date.now())) / (1000 * 60 * 60)

    if (ageHours <= 0) continue

    const expectedRate = (totalInteractions * 6) / ageHours
    const expected = Math.max(expectedRate, 1) // Avoid division by zero

    // Chi-squared-like trending score with time decay
    const trendingScore = (Math.pow(observed - expected, 2) / expected) *
      Math.pow(0.5, ageHours / 12) // 12-hour half-life for trending

    if (trendingScore > 0.1) {
      results.push({
        entityId: thread.id,
        score: Math.round(trendingScore * 1000) / 1000,
        metadata: {
          title: thread.title,
          scope: thread.scope,
          observed6h: observed,
          totalInteractions,
          ageHours: Math.round(ageHours * 10) / 10
        }
      })
    }
  }

  // Sort by trending score
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, 20)
}

/**
 * Compute trending tags.
 * Tags with accelerating usage in last 24h vs previous week.
 */
export async function computeTrendingTags(): Promise<{
  entityId: string
  score: number
  metadata: Record<string, unknown>
}[]> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Count tag usage in last 24h
  const recentTags = await db
    .select({
      tag: threadTags.tag,
      count: count()
    })
    .from(threadTags)
    .innerJoin(threads, eq(threadTags.threadId, threads.id))
    .where(and(
      eq(threads.isHidden, false),
      gt(threads.createdAt, oneDayAgo)
    ))
    .groupBy(threadTags.tag)

  // Count tag usage in previous week (for baseline)
  const weeklyTags = await db
    .select({
      tag: threadTags.tag,
      count: count()
    })
    .from(threadTags)
    .innerJoin(threads, eq(threadTags.threadId, threads.id))
    .where(and(
      eq(threads.isHidden, false),
      gt(threads.createdAt, oneWeekAgo)
    ))
    .groupBy(threadTags.tag)

  const weeklyMap = new Map(weeklyTags.map(t => [t.tag, Number(t.count)]))

  const results: { entityId: string; score: number; metadata: Record<string, unknown> }[] = []

  for (const tag of recentTags) {
    const recentCount = Number(tag.count)
    if (recentCount < 2) continue // Min 2 threads in 24h

    const weeklyCount = weeklyMap.get(tag.tag) || 0
    const expectedDaily = weeklyCount / 7
    const expected = Math.max(expectedDaily, 0.5)

    // Deviation from expected
    const trendingScore = Math.pow(recentCount - expected, 2) / expected

    if (trendingScore > 0.5) {
      results.push({
        entityId: tag.tag,
        score: Math.round(trendingScore * 1000) / 1000,
        metadata: {
          tag: tag.tag,
          recentCount,
          weeklyCount,
          expectedDaily: Math.round(expectedDaily * 10) / 10
        }
      })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, 15)
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Refresh the trending cache. Called by the scheduler every 15 minutes.
 * Computes trending threads and tags, writes results to trending_cache table.
 */
export async function refreshTrendingCache(): Promise<void> {
  console.log('📊 Refreshing trending cache...')
  const now = new Date()

  try {
    // Compute trending data
    const [trendingThreads, trendingTagsData] = await Promise.all([
      computeTrendingThreads(),
      computeTrendingTags()
    ])

    // Clear old cache and insert new data
    await db.delete(trendingCache)

    const entries = [
      ...trendingThreads.map(t => ({
        entityType: 'thread' as const,
        entityId: t.entityId,
        score: t.score.toString(),
        metadata: t.metadata,
        computedAt: now
      })),
      ...trendingTagsData.map(t => ({
        entityType: 'tag' as const,
        entityId: t.entityId,
        score: t.score.toString(),
        metadata: t.metadata,
        computedAt: now
      }))
    ]

    if (entries.length > 0) {
      await db.insert(trendingCache).values(entries)
    }

    console.log(`   ✅ Trending cache refreshed: ${trendingThreads.length} threads, ${trendingTagsData.length} tags`)
  } catch (err) {
    console.error('   ❌ Trending cache refresh failed:', err instanceof Error ? err.message : err)
  }
}

// ============================================
// VIEW COUNT BATCH UPDATE
// ============================================

/**
 * Batch update thread view counts from thread_views table.
 * Called by the scheduler every 5 minutes.
 */
export async function batchUpdateViewCounts(): Promise<void> {
  try {
    // Count unique views per thread and update the cached column
    await db.execute(sql`
      UPDATE threads t
      SET view_count = sub.view_count
      FROM (
        SELECT thread_id, COUNT(DISTINCT COALESCE(user_id::text, session_hash)) as view_count
        FROM thread_views
        GROUP BY thread_id
      ) sub
      WHERE t.id = sub.thread_id
        AND t.view_count != sub.view_count
    `)
  } catch (err) {
    console.error('View count batch update failed:', err instanceof Error ? err.message : err)
  }
}

// ============================================
// ALGORITHM DOCUMENTATION
// ============================================

/**
 * Returns the algorithm documentation as structured data.
 * This powers the /discover/algorithm endpoint and the
 * /tutustu/algoritmi transparency page.
 */
export function getAlgorithmDocumentation() {
  return {
    name: 'Civic Value Score (CVS)',
    version: '1.0.0',
    updatedAt: '2026-02-18',
    description: {
      fi: 'Eulesian sisältösuosittelukaava on täysin deterministinen ja julkisesti dokumentoitu. Se ei käytä koneoppimista eikä personointia — samat syötteet tuottavat aina saman tuloksen.',
      en: 'Eulesia\'s content recommendation formula is fully deterministic and publicly documented. It does not use machine learning or personalization — same inputs always produce the same result.'
    },
    formula: 'CVS = engagement × source_quality × freshness',
    components: {
      engagement: {
        formula: '(score × 1.5) + (replies × 2.0) + (unique_repliers × 3.0) + (views × 0.01)',
        description: {
          fi: 'Keskustelun laatu painottuu äänestyskertymää enemmän. Uniikkien osallistujien määrä on arvokkain signaali — laaja keskustelu on arvokkaampaa kuin yksi paljon äänestetty ketju.',
          en: 'Discussion quality is weighted more than vote totals. Unique participant count is the most valuable signal — broad discussion is more valuable than a single highly-voted thread.'
        },
        weights: {
          'score (upvotes − downvotes)': 1.5,
          'reply_count': 2.0,
          'unique_repliers': 3.0,
          'view_count': 0.01
        }
      },
      sourceQuality: {
        description: {
          fi: 'Institutionaalinen ja demokraattinen sisältö saa lievän korotuksen, koska se on kansalaiskeskustelun kannalta erityisen arvokasta.',
          en: 'Institutional and democratic content receives a slight boost as it is particularly valuable for civic discourse.'
        },
        multipliers: {
          'minutes_import (pöytäkirjat / meeting minutes)': 1.5,
          'rss_import (hallitus/EU / government/EU)': 1.3,
          'institution (virallinen toimija / official actor)': 1.2,
          'verified (vahvistettu kansalainen / verified citizen)': 1.1,
          'default': 1.0
        }
      },
      freshness: {
        formula: '1 / (1 + age_hours / halflife)^0.8',
        description: {
          fi: 'Tuoreempi sisältö saa korkeamman pisteen, mutta vanha sisältö ei koskaan katoa kokonaan. Institutionaalinen sisältö (pöytäkirjat, tiedotteet) hiipuu hitaammin koska se on relevanttia pidempään.',
          en: 'Newer content scores higher, but old content never fully disappears. Institutional content (meeting minutes, press releases) decays more slowly as it remains relevant longer.'
        },
        halflife: {
          'user_content': '24 hours',
          'institutional_content': '72 hours'
        }
      }
    },
    whatIsNotUsed: {
      fi: [
        'Emme käytä koneoppimista tai neuroverkoja',
        'Emme profiloi käyttäjiä heidän käyttäytymisensä perusteella',
        'Emme optimoi sitoutumista (engagement) tai ruutuaikaa',
        'Emme käytä dark pattern -suunnittelumalleja',
        'Emme myy dataa tai näytä mainoksia'
      ],
      en: [
        'We do not use machine learning or neural networks',
        'We do not profile users based on their behavior',
        'We do not optimize for engagement or screen time',
        'We do not use dark pattern design',
        'We do not sell data or show advertisements'
      ]
    },
    transparency: {
      fi: 'Jokaisen Tutustu-syötteessä näkyvän ketjun pisteytyksen erittely on nähtävissä "Miksi tämä näkyy?" -painikkeesta. Eulesian lähdekoodi on julkisesti saatavilla GitHubissa.',
      en: 'The score breakdown for every thread shown in the Explore feed is viewable via the "Why am I seeing this?" button. Eulesia\'s source code is publicly available on GitHub.'
    },
    changelog: [
      {
        date: '2026-02-18',
        version: '1.0.0',
        description: {
          fi: 'CVS-pisteytyksen ensimmäinen versio. Engagement × source_quality × freshness.',
          en: 'First version of CVS scoring. Engagement × source_quality × freshness.'
        }
      }
    ]
  }
}
