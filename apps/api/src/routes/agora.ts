import { Router, type Response } from 'express'
import { z } from 'zod'
import { eq, desc, asc, and, inArray, sql, or, gte } from 'drizzle-orm'
import { db, threads, threadTags, threadVotes, comments, commentVotes, users, municipalities, userSubscriptions, tagCategories, institutionTopics } from '../db/index.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { renderMarkdown } from '../utils/markdown.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import type { AuthenticatedRequest } from '../types/index.js'

const router = Router()

// Validation schemas
const createThreadSchema = z.object({
  title: z.string().min(5).max(500),
  content: z.string().min(10).max(50000),
  scope: z.enum(['local', 'national', 'european']),
  country: z.string().length(2).optional().default('FI'),
  municipalityId: z.string().uuid().optional(),
  // Location support: either locationId (existing) or locationOsmId (to be activated)
  locationId: z.string().uuid().optional(),
  locationOsmId: z.number().int().positive().optional(),
  locationOsmType: z.enum(['node', 'way', 'relation']).optional(),
  tags: z.array(z.string().max(100)).max(10).optional(),
  language: z.string().max(10).optional(),
  institutionalContext: z.object({
    docs: z.array(z.object({ title: z.string(), url: z.string().url() })).optional(),
    timeline: z.array(z.object({ date: z.string(), event: z.string() })).optional(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
    contact: z.string().optional()
  }).optional()
})

const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  parentId: z.string().uuid().optional(),
  language: z.string().max(10).optional()
})

const voteSchema = z.object({
  value: z.number().int().min(-1).max(1) // -1 = downvote, 0 = remove, 1 = upvote
})

const threadVoteSchema = z.object({
  value: z.number().int().min(-1).max(1) // -1 = downvote, 0 = remove, 1 = upvote
})

const commentSortSchema = z.enum(['best', 'new', 'old', 'controversial']).default('best')

const threadFiltersSchema = z.object({
  scope: z.enum(['local', 'national', 'european']).optional(),
  country: z.string().length(2).optional(),
  municipalityId: z.string().uuid().optional(),
  tags: z.string().optional(), // Comma-separated
  // feedScope filters WITHIN subscriptions, never shows all content globally
  // 'following' = all subscribed content across all scopes
  // 'local' = subscribed content with local scope
  // 'national' = subscribed content with national scope
  // 'european' = subscribed content with european scope
  // 'all' = discovery feed (no subscription filter)
  feedScope: z.enum(['following', 'local', 'national', 'european', 'all']).optional(),
  sortBy: z.enum(['recent', 'new', 'top']).default('recent'),
  topPeriod: z.enum(['day', 'week', 'month', 'year']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20)
})

// GET /agora/threads - List threads with filters
router.get('/threads', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filters = threadFiltersSchema.parse(req.query)
  const offset = (filters.page - 1) * filters.limit
  const userId = req.user?.id

  // Build where conditions
  const conditions = []

  if (filters.scope) {
    conditions.push(eq(threads.scope, filters.scope))
  }

  if (filters.municipalityId) {
    conditions.push(eq(threads.municipalityId, filters.municipalityId))
  }

  // Handle feedScope filtering — all personalized scopes require subscriptions
  // - 'following' = content from all subscriptions across all scopes
  // - 'local' = subscribed content with local scope
  // - 'national' = subscribed content with national scope
  // - 'european' = subscribed content with european scope
  // - 'all' = discovery feed, no subscription filter
  const isViewingSpecificMunicipality = !!filters.municipalityId

  // Declare subscription arrays at outer scope for later use in tag filtering
  let followedAuthors: string[] = []
  let followedMunicipalities: string[] = []
  let followedTags: string[] = []

  // Load subscriptions for personalized scopes
  if (['local', 'national', 'european', 'following'].includes(filters.feedScope || '') && userId && !isViewingSpecificMunicipality) {
    const subscriptions = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))

    followedAuthors = subscriptions
      .filter(s => s.entityType === 'user')
      .map(s => s.entityId)
    followedMunicipalities = subscriptions
      .filter(s => s.entityType === 'municipality')
      .map(s => s.entityId)
    followedTags = subscriptions
      .filter(s => s.entityType === 'tag')
      .map(s => s.entityId)
  }

  // Helper: build subscription-based OR conditions
  // Matches threads by followed authors, institutions, municipalities, OR tags (via subquery)
  function buildSubscriptionFilter() {
    const subConditions = []

    if (followedAuthors.length > 0) {
      subConditions.push(inArray(threads.authorId, followedAuthors))
      subConditions.push(inArray(threads.sourceInstitutionId, followedAuthors))
    }
    if (followedMunicipalities.length > 0) {
      subConditions.push(inArray(threads.municipalityId, followedMunicipalities))
    }
    if (followedTags.length > 0) {
      // Match threads that have any of the followed tags
      subConditions.push(
        sql`${threads.id} IN (SELECT ${threadTags.threadId} FROM ${threadTags} WHERE ${inArray(threadTags.tag, followedTags)})`
      )
    }

    return subConditions
  }

  const hasAnySubscriptions = followedAuthors.length > 0 || followedMunicipalities.length > 0 || followedTags.length > 0

  if (filters.feedScope === 'local' || filters.feedScope === 'national' || filters.feedScope === 'european') {
    // Scope filter: restrict to this scope
    conditions.push(eq(threads.scope, filters.feedScope))

    if (!userId || !hasAnySubscriptions) {
      // Not logged in or no subscriptions — empty with onboarding
      res.json({
        success: true,
        data: {
          items: [],
          total: 0,
          page: filters.page,
          limit: filters.limit,
          hasMore: false,
          feedScope: filters.feedScope,
          hasSubscriptions: false
        }
      })
      return
    }

    // Add subscription filter
    const subFilter = buildSubscriptionFilter()
    if (subFilter.length > 0) {
      conditions.push(or(...subFilter))
    }
  } else if (filters.feedScope === 'following' && userId && !isViewingSpecificMunicipality) {
    // 'following' shows subscribed content across all scopes
    if (!hasAnySubscriptions) {
      res.json({
        success: true,
        data: {
          items: [],
          total: 0,
          page: filters.page,
          limit: filters.limit,
          hasMore: false,
          feedScope: filters.feedScope,
          hasSubscriptions: false
        }
      })
      return
    }

    const subFilter = buildSubscriptionFilter()
    if (subFilter.length > 0) {
      conditions.push(or(...subFilter))
    }
  }
  // 'all' shows everything (no additional filter)

  // Time filter for 'top' sorting
  if (filters.sortBy === 'top' && filters.topPeriod) {
    const now = new Date()
    let startDate: Date
    switch (filters.topPeriod) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
    }
    conditions.push(gte(threads.createdAt, startDate))
  }

  // Determine sort order
  let orderBy
  switch (filters.sortBy) {
    case 'new':
      orderBy = desc(threads.createdAt)
      break
    case 'top':
      orderBy = desc(threads.score)
      break
    case 'recent':
    default:
      orderBy = desc(threads.updatedAt)
      break
  }

  // Get threads
  const threadList = await db
    .select({
      thread: threads,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: users.role,
        institutionType: users.institutionType,
        institutionName: users.institutionName
      },
      municipality: municipalities
    })
    .from(threads)
    .leftJoin(users, eq(threads.authorId, users.id))
    .leftJoin(municipalities, eq(threads.municipalityId, municipalities.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy)
    .limit(filters.limit)
    .offset(offset)

  // Get tags for each thread
  const threadIds = threadList.map(t => t.thread.id)
  const allTags = threadIds.length > 0
    ? await db
        .select()
        .from(threadTags)
        .where(inArray(threadTags.threadId, threadIds))
    : []

  // Resolve source institution names for bot-imported threads
  const sourceInstitutionIds = [...new Set(
    threadList
      .map(t => t.thread.sourceInstitutionId)
      .filter((id): id is string => !!id)
  )]
  let sourceInstitutionNames: Record<string, string> = {}
  if (sourceInstitutionIds.length > 0) {
    const institutions = await db
      .select({ id: users.id, name: users.institutionName })
      .from(users)
      .where(inArray(users.id, sourceInstitutionIds))
    sourceInstitutionNames = institutions.reduce((acc, inst) => {
      if (inst.name) acc[inst.id] = inst.name
      return acc
    }, {} as Record<string, string>)
  }

  // Group tags by thread
  const tagsByThread = allTags.reduce((acc, tag) => {
    if (!acc[tag.threadId]) acc[tag.threadId] = []
    acc[tag.threadId].push(tag.tag)
    return acc
  }, {} as Record<string, string[]>)

  // Post-query tag filtering: only for explicit URL ?tags= parameter
  // (Followed tags are already handled at SQL level via buildSubscriptionFilter)
  let filteredThreads = threadList
  const requestedTags = filters.tags ? filters.tags.split(',').map(t => t.trim().toLowerCase()) : []

  if (requestedTags.length > 0) {
    filteredThreads = threadList.filter(t => {
      const threadTagList = tagsByThread[t.thread.id] || []
      return requestedTags.some(rt => threadTagList.includes(rt))
    })
  }

  // Get user's votes on these threads
  let userVotes: Record<string, number> = {}
  if (userId && threadIds.length > 0) {
    const votes = await db
      .select()
      .from(threadVotes)
      .where(and(
        inArray(threadVotes.threadId, threadIds),
        eq(threadVotes.userId, userId)
      ))

    userVotes = votes.reduce((acc, v) => {
      acc[v.threadId] = v.value
      return acc
    }, {} as Record<string, number>)
  }

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(threads)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  res.json({
    success: true,
    data: {
      items: filteredThreads.map(({ thread, author, municipality }) => ({
        ...thread,
        tags: tagsByThread[thread.id] || [],
        author,
        municipality,
        userVote: userVotes[thread.id] || 0,
        sourceInstitutionName: thread.sourceInstitutionId
          ? sourceInstitutionNames[thread.sourceInstitutionId] || null
          : null
      })),
      total: count,
      page: filters.page,
      limit: filters.limit,
      hasMore: offset + filteredThreads.length < count,
      feedScope: filters.feedScope || 'all',
      hasSubscriptions: ['following', 'local', 'national', 'european'].includes(filters.feedScope || '')
        ? hasAnySubscriptions
        : undefined
    }
  })
}))

// GET /agora/threads/:id - Get thread with comments
router.get('/threads/:id', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const sort = commentSortSchema.parse(req.query.sort)
  const userId = req.user?.id

  // Get thread with author
  const [threadData] = await db
    .select({
      thread: threads,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: users.role,
        institutionType: users.institutionType,
        institutionName: users.institutionName
      },
      municipality: municipalities
    })
    .from(threads)
    .leftJoin(users, eq(threads.authorId, users.id))
    .leftJoin(municipalities, eq(threads.municipalityId, municipalities.id))
    .where(eq(threads.id, id))
    .limit(1)

  if (!threadData) {
    throw new AppError(404, 'Thread not found')
  }

  // Get tags
  const tags = await db
    .select({ tag: threadTags.tag })
    .from(threadTags)
    .where(eq(threadTags.threadId, id))

  // Determine sort order
  let orderBy
  switch (sort) {
    case 'new':
      orderBy = desc(comments.createdAt)
      break
    case 'old':
      orderBy = asc(comments.createdAt)
      break
    case 'controversial':
      // Controversial = high activity but close to 0 score
      orderBy = desc(sql`ABS(${comments.score})`)
      break
    case 'best':
    default:
      orderBy = desc(comments.score)
      break
  }

  // Get comments with authors
  const commentList = await db
    .select({
      comment: comments,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: users.role,
        institutionType: users.institutionType,
        institutionName: users.institutionName
      }
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.threadId, id))
    .orderBy(orderBy)

  // Get user's votes if logged in
  let userVotes: Record<string, number> = {}
  if (userId) {
    const commentIds = commentList.map(c => c.comment.id)
    if (commentIds.length > 0) {
      const votes = await db
        .select()
        .from(commentVotes)
        .where(and(
          inArray(commentVotes.commentId, commentIds),
          eq(commentVotes.userId, userId)
        ))

      userVotes = votes.reduce((acc, v) => {
        acc[v.commentId] = v.value
        return acc
      }, {} as Record<string, number>)
    }
  }

  // Get user's vote on the thread
  let threadUserVote = 0
  if (userId) {
    const [vote] = await db
      .select()
      .from(threadVotes)
      .where(and(
        eq(threadVotes.threadId, id),
        eq(threadVotes.userId, userId)
      ))
      .limit(1)
    threadUserVote = vote?.value || 0
  }

  // Resolve source institution name
  let sourceInstitutionName: string | null = null
  if (threadData.thread.sourceInstitutionId) {
    const [srcInst] = await db
      .select({ name: users.institutionName })
      .from(users)
      .where(eq(users.id, threadData.thread.sourceInstitutionId))
      .limit(1)
    sourceInstitutionName = srcInst?.name || null
  }

  res.json({
    success: true,
    data: {
      ...threadData.thread,
      tags: tags.map(t => t.tag),
      author: threadData.author,
      municipality: threadData.municipality,
      userVote: threadUserVote,
      sourceInstitutionName,
      comments: commentList.map(({ comment, author }) => ({
        ...comment,
        author,
        userVote: userVotes[comment.id] || 0
      }))
    }
  })
}))

// POST /agora/threads - Create new thread
router.post('/threads', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const data = createThreadSchema.parse(req.body)

  // Validate: local scope should have municipality or location
  // European scope doesn't require location
  if (data.scope === 'local' && !data.municipalityId && !data.locationId && !data.locationOsmId) {
    // Local scope without any location - allowed, user's default will be used
  }

  // Only institutions can add institutional context
  if (data.institutionalContext && req.user!.role !== 'institution') {
    throw new AppError(403, 'Only institutions can add institutional context')
  }

  // Resolve location if OSM ID is provided (activates location if needed)
  let resolvedLocationId: string | null = data.locationId || null
  if (!resolvedLocationId && data.locationOsmId && data.locationOsmType) {
    const { resolveLocation } = await import('../services/locations.js')
    resolvedLocationId = await resolveLocation({
      locationOsmId: data.locationOsmId,
      locationOsmType: data.locationOsmType
    })
  }

  // Render markdown
  const contentHtml = renderMarkdown(data.content)

  // Create thread
  const [newThread] = await db
    .insert(threads)
    .values({
      title: data.title,
      content: data.content,
      contentHtml,
      authorId: userId,
      scope: data.scope,
      country: data.country || 'FI',
      municipalityId: data.municipalityId,
      locationId: resolvedLocationId,
      institutionalContext: data.institutionalContext,
      language: data.language || req.user?.locale || 'fi'
    })
    .returning()

  // Increment content count for location if one was resolved
  if (resolvedLocationId) {
    const { incrementContentCount } = await import('../services/locations.js')
    await incrementContentCount(resolvedLocationId)
  }

  // Add tags
  if (data.tags && data.tags.length > 0) {
    await db.insert(threadTags).values(
      data.tags.map(tag => ({
        threadId: newThread.id,
        tag: tag.toLowerCase()
      }))
    )
  }

  res.status(201).json({
    success: true,
    data: {
      ...newThread,
      tags: data.tags || []
    }
  })
}))

// POST /agora/threads/:id/comments - Add comment
router.post('/threads/:id/comments', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const { id: threadId } = req.params
  const data = createCommentSchema.parse(req.body)

  // Verify thread exists and is not locked
  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1)

  if (!thread) {
    throw new AppError(404, 'Thread not found')
  }

  if (thread.isLocked) {
    throw new AppError(403, 'Thread is locked')
  }

  // Verify parent comment if specified and calculate depth
  let depth = 0
  if (data.parentId) {
    const [parent] = await db
      .select()
      .from(comments)
      .where(and(eq(comments.id, data.parentId), eq(comments.threadId, threadId)))
      .limit(1)

    if (!parent) {
      throw new AppError(400, 'Parent comment not found')
    }
    depth = (parent.depth || 0) + 1
  }

  // Render markdown
  const contentHtml = renderMarkdown(data.content)

  // Create comment
  const [newComment] = await db
    .insert(comments)
    .values({
      threadId,
      authorId: userId,
      parentId: data.parentId,
      content: data.content,
      contentHtml,
      depth,
      language: data.language || req.user?.locale || 'fi'
    })
    .returning()

  // Update reply count
  await db
    .update(threads)
    .set({
      replyCount: sql`${threads.replyCount} + 1`,
      updatedAt: new Date()
    })
    .where(eq(threads.id, threadId))

  res.status(201).json({
    success: true,
    data: newComment
  })
}))

// POST /agora/comments/:commentId/vote - Vote on a comment
router.post('/comments/:commentId/vote', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const { commentId } = req.params
  const { value } = voteSchema.parse(req.body)

  // Verify comment exists
  const [comment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1)

  if (!comment) {
    throw new AppError(404, 'Comment not found')
  }

  // Get existing vote
  const [existingVote] = await db
    .select()
    .from(commentVotes)
    .where(and(
      eq(commentVotes.commentId, commentId),
      eq(commentVotes.userId, userId)
    ))
    .limit(1)

  const oldValue = existingVote?.value || 0
  const scoreDelta = value - oldValue

  if (value === 0) {
    // Remove vote
    if (existingVote) {
      await db
        .delete(commentVotes)
        .where(and(
          eq(commentVotes.commentId, commentId),
          eq(commentVotes.userId, userId)
        ))
    }
  } else {
    // Upsert vote
    if (existingVote) {
      await db
        .update(commentVotes)
        .set({ value })
        .where(and(
          eq(commentVotes.commentId, commentId),
          eq(commentVotes.userId, userId)
        ))
    } else {
      await db
        .insert(commentVotes)
        .values({
          commentId,
          userId,
          value
        })
    }
  }

  // Update comment score
  if (scoreDelta !== 0) {
    await db
      .update(comments)
      .set({
        score: sql`${comments.score} + ${scoreDelta}`
      })
      .where(eq(comments.id, commentId))
  }

  // Get updated comment
  const [updatedComment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1)

  res.json({
    success: true,
    data: {
      commentId,
      score: updatedComment.score,
      userVote: value
    }
  })
}))

// POST /agora/threads/:threadId/vote - Vote on a thread
router.post('/threads/:threadId/vote', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const { threadId } = req.params
  const { value } = threadVoteSchema.parse(req.body)

  // Verify thread exists
  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1)

  if (!thread) {
    throw new AppError(404, 'Thread not found')
  }

  // Get existing vote
  const [existingVote] = await db
    .select()
    .from(threadVotes)
    .where(and(
      eq(threadVotes.threadId, threadId),
      eq(threadVotes.userId, userId)
    ))
    .limit(1)

  const oldValue = existingVote?.value || 0
  const scoreDelta = value - oldValue

  if (value === 0) {
    // Remove vote
    if (existingVote) {
      await db
        .delete(threadVotes)
        .where(and(
          eq(threadVotes.threadId, threadId),
          eq(threadVotes.userId, userId)
        ))
    }
  } else {
    // Upsert vote
    if (existingVote) {
      await db
        .update(threadVotes)
        .set({ value })
        .where(and(
          eq(threadVotes.threadId, threadId),
          eq(threadVotes.userId, userId)
        ))
    } else {
      await db
        .insert(threadVotes)
        .values({
          threadId,
          userId,
          value
        })
    }
  }

  // Update thread score
  if (scoreDelta !== 0) {
    await db
      .update(threads)
      .set({
        score: sql`${threads.score} + ${scoreDelta}`
      })
      .where(eq(threads.id, threadId))
  }

  // Get updated thread score
  const [updatedThread] = await db
    .select({ score: threads.score })
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1)

  res.json({
    success: true,
    data: {
      threadId,
      score: updatedThread.score,
      userVote: value
    }
  })
}))

// GET /agora/tags - Get all available tags with category metadata
router.get('/tags', asyncHandler(async (_req, res: Response) => {
  // Get tag usage counts
  const tagCounts = await db
    .select({ tag: threadTags.tag, count: sql<number>`count(*)::int` })
    .from(threadTags)
    .groupBy(threadTags.tag)
    .orderBy(desc(sql`count(*)`))
    .limit(100)

  // Get tag category metadata
  const tagNames = tagCounts.map(t => t.tag)
  const categories = tagNames.length > 0
    ? await db
        .select()
        .from(tagCategories)
        .where(inArray(tagCategories.tag, tagNames))
    : []

  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.tag] = cat
    return acc
  }, {} as Record<string, typeof categories[number]>)

  // Also include curated tags that have no threads yet
  const allCurated = await db
    .select()
    .from(tagCategories)
    .orderBy(tagCategories.category, tagCategories.sortOrder)

  // Merge: used tags with metadata + unused curated tags
  const usedTagSet = new Set(tagNames)
  const mergedTags = [
    ...tagCounts.map(t => ({
      tag: t.tag,
      count: t.count,
      category: categoryMap[t.tag]?.category || null,
      displayName: categoryMap[t.tag]?.displayName || null,
      description: categoryMap[t.tag]?.description || null,
      scope: categoryMap[t.tag]?.scope || null
    })),
    ...allCurated
      .filter(c => !usedTagSet.has(c.tag))
      .map(c => ({
        tag: c.tag,
        count: 0,
        category: c.category,
        displayName: c.displayName,
        description: c.description,
        scope: c.scope
      }))
  ]

  res.json({
    success: true,
    data: mergedTags
  })
}))

// GET /agora/tags/:tag - Get threads for a specific tag + tag metadata
router.get('/tags/:tag', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tag } = req.params
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))
  const offset = (page - 1) * limit
  const userId = req.user?.id

  // Get tag metadata
  const [tagMeta] = await db
    .select()
    .from(tagCategories)
    .where(eq(tagCategories.tag, tag))
    .limit(1)

  // Check if this is an institution topic tag
  const [topicInfo] = await db
    .select({
      institutionId: institutionTopics.institutionId,
      topicTag: institutionTopics.topicTag,
      relatedTags: institutionTopics.relatedTags,
      description: institutionTopics.description,
      institutionName: users.institutionName,
      institutionType: users.institutionType
    })
    .from(institutionTopics)
    .leftJoin(users, eq(institutionTopics.institutionId, users.id))
    .where(eq(institutionTopics.topicTag, tag))
    .limit(1)

  // Get thread IDs matching this tag
  const taggedThreadIds = await db
    .select({ threadId: threadTags.threadId })
    .from(threadTags)
    .where(eq(threadTags.tag, tag))

  const threadIdList = taggedThreadIds.map(t => t.threadId)

  if (threadIdList.length === 0) {
    res.json({
      success: true,
      data: {
        tag,
        tagMeta: tagMeta || null,
        institution: topicInfo || null,
        items: [],
        total: 0,
        page,
        limit,
        hasMore: false
      }
    })
    return
  }

  // Get threads
  const threadList = await db
    .select({
      thread: threads,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: users.role,
        institutionType: users.institutionType,
        institutionName: users.institutionName
      },
      municipality: municipalities
    })
    .from(threads)
    .leftJoin(users, eq(threads.authorId, users.id))
    .leftJoin(municipalities, eq(threads.municipalityId, municipalities.id))
    .where(inArray(threads.id, threadIdList))
    .orderBy(desc(threads.updatedAt))
    .limit(limit)
    .offset(offset)

  // Get all tags for these threads
  const resultThreadIds = threadList.map(t => t.thread.id)
  const allTags = resultThreadIds.length > 0
    ? await db.select().from(threadTags).where(inArray(threadTags.threadId, resultThreadIds))
    : []

  const tagsByThread = allTags.reduce((acc, t) => {
    if (!acc[t.threadId]) acc[t.threadId] = []
    acc[t.threadId].push(t.tag)
    return acc
  }, {} as Record<string, string[]>)

  // Resolve source institution names
  const sourceInstIds = [...new Set(
    threadList.map(t => t.thread.sourceInstitutionId).filter((id): id is string => !!id)
  )]
  let srcInstNames: Record<string, string> = {}
  if (sourceInstIds.length > 0) {
    const insts = await db.select({ id: users.id, name: users.institutionName }).from(users).where(inArray(users.id, sourceInstIds))
    srcInstNames = insts.reduce((acc, i) => { if (i.name) acc[i.id] = i.name; return acc }, {} as Record<string, string>)
  }

  // User votes
  let userVotes: Record<string, number> = {}
  if (userId && resultThreadIds.length > 0) {
    const votes = await db.select().from(threadVotes).where(and(
      inArray(threadVotes.threadId, resultThreadIds),
      eq(threadVotes.userId, userId)
    ))
    userVotes = votes.reduce((acc, v) => { acc[v.threadId] = v.value; return acc }, {} as Record<string, number>)
  }

  res.json({
    success: true,
    data: {
      tag,
      tagMeta: tagMeta || null,
      institution: topicInfo || null,
      items: threadList.map(({ thread, author, municipality }) => ({
        ...thread,
        tags: tagsByThread[thread.id] || [],
        author,
        municipality,
        userVote: userVotes[thread.id] || 0,
        sourceInstitutionName: thread.sourceInstitutionId ? srcInstNames[thread.sourceInstitutionId] || null : null
      })),
      total: threadIdList.length,
      page,
      limit,
      hasMore: offset + threadList.length < threadIdList.length
    }
  })
}))

export default router
