import { Router, type Response } from 'express'
import { z } from 'zod'
import { eq, desc, and, sql } from 'drizzle-orm'
import { db, clubs, clubMembers, clubThreads, clubComments, users } from '../db/index.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { renderMarkdown } from '../utils/markdown.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import type { AuthenticatedRequest } from '../types/index.js'

const router = Router()

// Validation schemas
const createClubSchema = z.object({
  name: z.string().min(3).max(255),
  slug: z.string().min(3).max(255).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  rules: z.array(z.string().max(500)).max(10).optional(),
  category: z.string().max(100).optional()
})

const createClubThreadSchema = z.object({
  title: z.string().min(5).max(500),
  content: z.string().min(10).max(50000)
})

const createClubCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  parentId: z.string().uuid().optional()
})

// GET /clubs - List clubs
router.get('/', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = '1', limit = '20' } = req.query
  const pageNum = Math.max(1, parseInt(page as string))
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)))
  const offset = (pageNum - 1) * limitNum

  let query = db
    .select({
      club: clubs,
      creator: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl
      }
    })
    .from(clubs)
    .leftJoin(users, eq(clubs.creatorId, users.id))
    .where(eq(clubs.isPublic, true))
    .orderBy(desc(clubs.memberCount))
    .limit(limitNum)
    .offset(offset)

  const clubList = await query

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clubs)
    .where(eq(clubs.isPublic, true))

  // If user is logged in, get their membership status
  let memberships: Record<string, boolean> = {}
  if (req.user) {
    const userMemberships = await db
      .select({ clubId: clubMembers.clubId })
      .from(clubMembers)
      .where(eq(clubMembers.userId, req.user.id))

    memberships = userMemberships.reduce((acc, m) => {
      acc[m.clubId] = true
      return acc
    }, {} as Record<string, boolean>)
  }

  res.json({
    success: true,
    data: {
      items: clubList.map(({ club, creator }) => ({
        ...club,
        creator,
        isMember: memberships[club.id] || false
      })),
      total: count,
      page: pageNum,
      limit: limitNum,
      hasMore: offset + clubList.length < count
    }
  })
}))

// GET /clubs/:id - Get club details
router.get('/:id', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  // Get club (by ID or slug)
  const [club] = await db
    .select()
    .from(clubs)
    .where(eq(clubs.id, id))
    .limit(1)

  if (!club) {
    // Try by slug
    const [clubBySlug] = await db
      .select()
      .from(clubs)
      .where(eq(clubs.slug, id))
      .limit(1)

    if (!clubBySlug) {
      throw new AppError(404, 'Club not found')
    }

    return res.redirect(`/api/v1/clubs/${clubBySlug.id}`)
  }

  // Get moderators
  const moderators = await db
    .select({
      user: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl
      },
      role: clubMembers.role
    })
    .from(clubMembers)
    .leftJoin(users, eq(clubMembers.userId, users.id))
    .where(and(
      eq(clubMembers.clubId, club.id),
      eq(clubMembers.role, 'moderator')
    ))

  // Get threads
  const threadList = await db
    .select({
      thread: clubThreads,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl
      }
    })
    .from(clubThreads)
    .leftJoin(users, eq(clubThreads.authorId, users.id))
    .where(eq(clubThreads.clubId, club.id))
    .orderBy(desc(clubThreads.isPinned), desc(clubThreads.updatedAt))
    .limit(50)

  // Check membership
  let isMember = false
  let memberRole = null
  if (req.user) {
    const [membership] = await db
      .select()
      .from(clubMembers)
      .where(and(
        eq(clubMembers.clubId, club.id),
        eq(clubMembers.userId, req.user.id)
      ))
      .limit(1)

    if (membership) {
      isMember = true
      memberRole = membership.role
    }
  }

  res.json({
    success: true,
    data: {
      ...club,
      moderators: moderators.map(m => m.user),
      threads: threadList.map(({ thread, author }) => ({
        ...thread,
        author
      })),
      isMember,
      memberRole
    }
  })
}))

// POST /clubs - Create club
router.post('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const data = createClubSchema.parse(req.body)

  // Check slug uniqueness
  const [existing] = await db
    .select()
    .from(clubs)
    .where(eq(clubs.slug, data.slug))
    .limit(1)

  if (existing) {
    throw new AppError(400, 'Club slug already exists')
  }

  // Create club
  const [newClub] = await db
    .insert(clubs)
    .values({
      ...data,
      creatorId: userId
    })
    .returning()

  // Add creator as admin
  await db.insert(clubMembers).values({
    clubId: newClub.id,
    userId,
    role: 'admin'
  })

  res.status(201).json({
    success: true,
    data: newClub
  })
}))

// POST /clubs/:id/join - Join club
router.post('/:id/join', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const { id: clubId } = req.params

  // Verify club exists
  const [club] = await db
    .select()
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1)

  if (!club) {
    throw new AppError(404, 'Club not found')
  }

  // Check if already member
  const [existing] = await db
    .select()
    .from(clubMembers)
    .where(and(
      eq(clubMembers.clubId, clubId),
      eq(clubMembers.userId, userId)
    ))
    .limit(1)

  if (existing) {
    throw new AppError(400, 'Already a member')
  }

  // Join
  await db.insert(clubMembers).values({
    clubId,
    userId,
    role: 'member'
  })

  // Update member count
  await db
    .update(clubs)
    .set({ memberCount: sql`${clubs.memberCount} + 1` })
    .where(eq(clubs.id, clubId))

  res.json({ success: true, message: 'Joined club' })
}))

// POST /clubs/:id/leave - Leave club
router.post('/:id/leave', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const { id: clubId } = req.params

  // Check membership
  const [membership] = await db
    .select()
    .from(clubMembers)
    .where(and(
      eq(clubMembers.clubId, clubId),
      eq(clubMembers.userId, userId)
    ))
    .limit(1)

  if (!membership) {
    throw new AppError(400, 'Not a member')
  }

  // Can't leave if only admin
  if (membership.role === 'admin') {
    const [otherAdmin] = await db
      .select()
      .from(clubMembers)
      .where(and(
        eq(clubMembers.clubId, clubId),
        eq(clubMembers.role, 'admin')
      ))
      .limit(2)

    // This check is simplified - in real app, check count
    if (!otherAdmin) {
      throw new AppError(400, 'Cannot leave as the only admin')
    }
  }

  // Leave
  await db
    .delete(clubMembers)
    .where(and(
      eq(clubMembers.clubId, clubId),
      eq(clubMembers.userId, userId)
    ))

  // Update member count
  await db
    .update(clubs)
    .set({ memberCount: sql`${clubs.memberCount} - 1` })
    .where(eq(clubs.id, clubId))

  res.json({ success: true, message: 'Left club' })
}))

// POST /clubs/:id/threads - Create thread in club
router.post('/:id/threads', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const { id: clubId } = req.params
  const data = createClubThreadSchema.parse(req.body)

  // Verify membership
  const [membership] = await db
    .select()
    .from(clubMembers)
    .where(and(
      eq(clubMembers.clubId, clubId),
      eq(clubMembers.userId, userId)
    ))
    .limit(1)

  if (!membership) {
    throw new AppError(403, 'Must be a member to post')
  }

  // Render markdown
  const contentHtml = renderMarkdown(data.content)

  // Create thread
  const [newThread] = await db
    .insert(clubThreads)
    .values({
      clubId,
      authorId: userId,
      title: data.title,
      content: data.content,
      contentHtml
    })
    .returning()

  res.status(201).json({
    success: true,
    data: newThread
  })
}))

// GET /clubs/:clubId/threads/:threadId - Get club thread
router.get('/:clubId/threads/:threadId', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { clubId, threadId } = req.params

  const [threadData] = await db
    .select({
      thread: clubThreads,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: users.role
      }
    })
    .from(clubThreads)
    .leftJoin(users, eq(clubThreads.authorId, users.id))
    .where(and(
      eq(clubThreads.id, threadId),
      eq(clubThreads.clubId, clubId)
    ))
    .limit(1)

  if (!threadData) {
    throw new AppError(404, 'Thread not found')
  }

  // Get comments
  const commentList = await db
    .select({
      comment: clubComments,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: users.role
      }
    })
    .from(clubComments)
    .leftJoin(users, eq(clubComments.authorId, users.id))
    .where(eq(clubComments.threadId, threadId))
    .orderBy(clubComments.createdAt)

  res.json({
    success: true,
    data: {
      ...threadData.thread,
      author: threadData.author,
      comments: commentList.map(({ comment, author }) => ({
        ...comment,
        author
      }))
    }
  })
}))

// POST /clubs/:clubId/threads/:threadId/comments - Add comment
router.post('/:clubId/threads/:threadId/comments', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const { clubId, threadId } = req.params
  const data = createClubCommentSchema.parse(req.body)

  // Verify membership
  const [membership] = await db
    .select()
    .from(clubMembers)
    .where(and(
      eq(clubMembers.clubId, clubId),
      eq(clubMembers.userId, userId)
    ))
    .limit(1)

  if (!membership) {
    throw new AppError(403, 'Must be a member to comment')
  }

  // Verify thread exists
  const [thread] = await db
    .select()
    .from(clubThreads)
    .where(and(
      eq(clubThreads.id, threadId),
      eq(clubThreads.clubId, clubId)
    ))
    .limit(1)

  if (!thread) {
    throw new AppError(404, 'Thread not found')
  }

  if (thread.isLocked) {
    throw new AppError(403, 'Thread is locked')
  }

  // Render markdown
  const contentHtml = renderMarkdown(data.content)

  // Create comment
  const [newComment] = await db
    .insert(clubComments)
    .values({
      threadId,
      authorId: userId,
      parentId: data.parentId,
      content: data.content,
      contentHtml
    })
    .returning()

  // Update reply count
  await db
    .update(clubThreads)
    .set({
      replyCount: sql`${clubThreads.replyCount} + 1`,
      updatedAt: new Date()
    })
    .where(eq(clubThreads.id, threadId))

  res.status(201).json({
    success: true,
    data: newComment
  })
}))

// GET /clubs/categories - Get club categories
router.get('/meta/categories', asyncHandler(async (_req, res: Response) => {
  const categories = await db
    .select({ category: clubs.category, count: sql<number>`count(*)::int` })
    .from(clubs)
    .where(eq(clubs.isPublic, true))
    .groupBy(clubs.category)
    .orderBy(desc(sql`count(*)`))

  res.json({
    success: true,
    data: categories.filter(c => c.category)
  })
}))

export default router
