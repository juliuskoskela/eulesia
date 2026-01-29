import { Router, type Response } from 'express'
import { z } from 'zod'
import { eq, desc, asc, and, inArray, sql, or, gte } from 'drizzle-orm'
import { db, threads, threadTags, threadVotes, comments, commentVotes, users, municipalities, userSubscriptions } from '../db/index.js'
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
  scope: z.enum(['municipal', 'regional', 'national']),
  municipalityId: z.string().uuid().optional(),
  tags: z.array(z.string().max(100)).max(10).optional(),
  institutionalContext: z.object({
    docs: z.array(z.object({ title: z.string(), url: z.string().url() })).optional(),
    timeline: z.array(z.object({ date: z.string(), event: z.string() })).optional(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
    contact: z.string().optional()
  }).optional()
})

const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  parentId: z.string().uuid().optional()
})

const voteSchema = z.object({
  value: z.number().int().min(-1).max(1) // -1 = downvote, 0 = remove, 1 = upvote
})

const threadVoteSchema = z.object({
  value: z.number().int().min(-1).max(1) // -1 = downvote, 0 = remove, 1 = upvote
})

const commentSortSchema = z.enum(['best', 'new', 'old', 'controversial']).default('best')

const threadFiltersSchema = z.object({
  scope: z.enum(['municipal', 'regional', 'national']).optional(),
  municipalityId: z.string().uuid().optional(),
  tags: z.string().optional(), // Comma-separated
  // feedScope filters WITHIN subscriptions, never shows all content globally
  // 'following' = all subscribed content
  // 'local' = subscribed content with municipal scope
  // 'national' = subscribed content with national/regional scope
  // 'all' = same as 'following'
  feedScope: z.enum(['following', 'local', 'national', 'all']).optional(),
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

  // Handle feedScope filtering (personalized feed)
  // ALL feedScopes filter within subscriptions - never show all content globally
  let followedAuthors: string[] = []
  let followedMunicipalities: string[] = []
  let followedTags: string[] = []
  let hasAnySubscriptions = false

  // Get subscriptions for any feedScope (except when not logged in)
  if (userId && (filters.feedScope === 'following' || filters.feedScope === 'local' ||
      filters.feedScope === 'national' || filters.feedScope === 'all' || !filters.feedScope)) {
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

    hasAnySubscriptions = followedAuthors.length > 0 ||
                          followedMunicipalities.length > 0 ||
                          followedTags.length > 0

    // Build subscription filter - always applied for logged-in users
    const followConditions = []
    if (followedAuthors.length > 0) {
      followConditions.push(inArray(threads.authorId, followedAuthors))
    }
    if (followedMunicipalities.length > 0) {
      followConditions.push(inArray(threads.municipalityId, followedMunicipalities))
    }

    if (followConditions.length > 0) {
      conditions.push(or(...followConditions))
    } else if (followedTags.length === 0) {
      // No subscriptions at all - return empty result with onboarding flag
      res.json({
        success: true,
        data: {
          items: [],
          total: 0,
          page: filters.page,
          limit: filters.limit,
          hasMore: false,
          feedScope: filters.feedScope || 'following',
          hasSubscriptions: false
        }
      })
      return
    }

    // Additional scope filter within subscriptions
    if (filters.feedScope === 'local') {
      // Only municipal-scope content from subscriptions
      conditions.push(eq(threads.scope, 'municipal'))
    } else if (filters.feedScope === 'national') {
      // Only national/regional-scope content from subscriptions
      conditions.push(or(
        eq(threads.scope, 'national'),
        eq(threads.scope, 'regional')
      ))
    }
    // 'following' and 'all' show all scopes from subscriptions
  }

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

  // Group tags by thread
  const tagsByThread = allTags.reduce((acc, tag) => {
    if (!acc[tag.threadId]) acc[tag.threadId] = []
    acc[tag.threadId].push(tag.tag)
    return acc
  }, {} as Record<string, string[]>)

  // Filter by tags if specified (including followed tags)
  let filteredThreads = threadList
  const requestedTags = filters.tags ? filters.tags.split(',').map(t => t.trim().toLowerCase()) : []
  const combinedTags = [...requestedTags, ...followedTags]

  if (combinedTags.length > 0 && filters.feedScope !== 'following') {
    // For non-following feeds, use tag filter as normal
    if (requestedTags.length > 0) {
      filteredThreads = threadList.filter(t => {
        const threadTagList = tagsByThread[t.thread.id] || []
        return requestedTags.some(rt => threadTagList.includes(rt))
      })
    }
  } else if (filters.feedScope === 'following' && followedTags.length > 0) {
    // For following feed, include threads with followed tags
    filteredThreads = threadList.filter(t => {
      const threadTagList = tagsByThread[t.thread.id] || []
      // Include if matches author/municipality OR has followed tag
      const hasFollowedTag = followedTags.some(ft => threadTagList.includes(ft))
      const followsAuthor = followedAuthors.includes(t.thread.authorId)
      const followsMunicipality = t.thread.municipalityId && followedMunicipalities.includes(t.thread.municipalityId)
      return hasFollowedTag || followsAuthor || followsMunicipality
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
        userVote: userVotes[thread.id] || 0
      })),
      total: count,
      page: filters.page,
      limit: filters.limit,
      hasMore: offset + filteredThreads.length < count,
      feedScope: filters.feedScope || 'all',
      hasSubscriptions: filters.feedScope === 'following' ? (followedAuthors.length > 0 || followedMunicipalities.length > 0 || followedTags.length > 0) : undefined
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

  res.json({
    success: true,
    data: {
      ...threadData.thread,
      tags: tags.map(t => t.tag),
      author: threadData.author,
      municipality: threadData.municipality,
      userVote: threadUserVote,
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

  // Validate municipality if scope is municipal
  if (data.scope === 'municipal' && !data.municipalityId) {
    throw new AppError(400, 'Municipality is required for municipal scope')
  }

  // Only institutions can add institutional context
  if (data.institutionalContext && req.user!.role !== 'institution') {
    throw new AppError(403, 'Only institutions can add institutional context')
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
      municipalityId: data.municipalityId,
      institutionalContext: data.institutionalContext
    })
    .returning()

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
      depth
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

// GET /agora/tags - Get all available tags
router.get('/tags', asyncHandler(async (_req, res: Response) => {
  const tags = await db
    .select({ tag: threadTags.tag, count: sql<number>`count(*)::int` })
    .from(threadTags)
    .groupBy(threadTags.tag)
    .orderBy(desc(sql`count(*)`))
    .limit(50)

  res.json({
    success: true,
    data: tags
  })
}))

export default router
