import { Router, type Response } from 'express'
import { z } from 'zod'
import { eq, desc, asc, and, inArray, sql } from 'drizzle-orm'
import { db, threads, threadTags, comments, commentVotes, users, municipalities } from '../db/index.js'
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

const commentSortSchema = z.enum(['best', 'new', 'old', 'controversial']).default('best')

const threadFiltersSchema = z.object({
  scope: z.enum(['municipal', 'regional', 'national']).optional(),
  municipalityId: z.string().uuid().optional(),
  tags: z.string().optional(), // Comma-separated
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20)
})

// GET /agora/threads - List threads with filters
router.get('/threads', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filters = threadFiltersSchema.parse(req.query)
  const offset = (filters.page - 1) * filters.limit

  // Build where conditions
  const conditions = []

  if (filters.scope) {
    conditions.push(eq(threads.scope, filters.scope))
  }

  if (filters.municipalityId) {
    conditions.push(eq(threads.municipalityId, filters.municipalityId))
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
    .orderBy(desc(threads.updatedAt))
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

  // Filter by tags if specified
  let filteredThreads = threadList
  if (filters.tags) {
    const requestedTags = filters.tags.split(',').map(t => t.trim().toLowerCase())
    filteredThreads = threadList.filter(t => {
      const threadTagList = tagsByThread[t.thread.id] || []
      return requestedTags.some(rt => threadTagList.includes(rt))
    })
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
        municipality
      })),
      total: count,
      page: filters.page,
      limit: filters.limit,
      hasMore: offset + filteredThreads.length < count
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

  res.json({
    success: true,
    data: {
      ...threadData.thread,
      tags: tags.map(t => t.tag),
      author: threadData.author,
      municipality: threadData.municipality,
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
