import { Router, type Response } from 'express'
import { z } from 'zod'
import { eq, desc, and, or, sql, inArray } from 'drizzle-orm'
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
  category: z.string().max(100).optional(),
  coverImageUrl: z.string().url().max(500).optional(),
  isPublic: z.boolean().default(true),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  address: z.string().max(500).optional(),
  municipalityId: z.string().uuid().optional()
})

const updateClubSchema = z.object({
  name: z.string().min(3).max(255).optional(),
  description: z.string().max(5000).optional(),
  rules: z.array(z.string().max(500)).max(10).optional(),
  category: z.string().max(100).optional(),
  coverImageUrl: z.string().url().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  municipalityId: z.string().uuid().nullable().optional()
})

const createClubThreadSchema = z.object({
  title: z.string().min(5).max(500),
  content: z.string().min(10).max(50000),
  language: z.string().max(10).optional()
})

const createClubCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  parentId: z.string().uuid().optional(),
  language: z.string().max(10).optional()
})

// GET /clubs - List clubs (public + user's closed clubs)
router.get('/', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = '1', limit = '20' } = req.query
  const pageNum = Math.max(1, parseInt(page as string))
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)))
  const offset = (pageNum - 1) * limitNum

  // Get user's club memberships first (if logged in)
  let memberClubIds: string[] = []
  let memberships: Record<string, boolean> = {}
  if (req.user) {
    const userMemberships = await db
      .select({ clubId: clubMembers.clubId })
      .from(clubMembers)
      .where(eq(clubMembers.userId, req.user.id))

    memberClubIds = userMemberships.map(m => m.clubId)
    memberships = userMemberships.reduce((acc, m) => {
      acc[m.clubId] = true
      return acc
    }, {} as Record<string, boolean>)
  }

  // Show public clubs + closed clubs where user is a member
  const whereCondition = memberClubIds.length > 0
    ? or(eq(clubs.isPublic, true), inArray(clubs.id, memberClubIds))
    : eq(clubs.isPublic, true)

  const clubList = await db
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
    .where(whereCondition!)
    .orderBy(desc(clubs.memberCount))
    .limit(limitNum)
    .offset(offset)

  // Get total count with same condition
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clubs)
    .where(whereCondition!)

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

    if (!clubBySlug.isPublic && req.user?.role !== 'admin') {
      if (!req.user) {
        throw new AppError(403, 'This club is private')
      }
      const [membership] = await db
        .select({ userId: clubMembers.userId })
        .from(clubMembers)
        .where(and(
          eq(clubMembers.clubId, clubBySlug.id),
          eq(clubMembers.userId, req.user.id)
        ))
        .limit(1)
      if (!membership) {
        throw new AppError(403, 'This club is private')
      }
    }

    return res.redirect(`/api/v1/clubs/${clubBySlug.id}`)
  }

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

  if (!club.isPublic && !isMember && req.user?.role !== 'admin') {
    throw new AppError(403, 'This club is private')
  }

  // Get moderators and admins
  const staffMembers = await db
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
      or(eq(clubMembers.role, 'moderator'), eq(clubMembers.role, 'admin'))
    ))

  // Get all members for member list
  const allMembers = await db
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
    .where(eq(clubMembers.clubId, club.id))

  // Get threads
  const threadList = await db
    .select({
      thread: clubThreads,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        identityVerified: users.identityVerified
      }
    })
    .from(clubThreads)
    .leftJoin(users, eq(clubThreads.authorId, users.id))
    .where(and(eq(clubThreads.clubId, club.id), eq(clubThreads.isHidden, false)))
    .orderBy(desc(clubThreads.isPinned), desc(clubThreads.updatedAt))
    .limit(50)

  res.json({
    success: true,
    data: {
      ...club,
      moderators: staffMembers.map(m => m.user),
      members: allMembers.map(m => ({ ...m.user, role: m.role })),
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
      name: data.name,
      slug: data.slug,
      description: data.description,
      rules: data.rules,
      category: data.category,
      coverImageUrl: data.coverImageUrl,
      isPublic: data.isPublic,
      latitude: data.latitude?.toString(),
      longitude: data.longitude?.toString(),
      address: data.address,
      municipalityId: data.municipalityId,
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

// PATCH /clubs/:id - Update club (admin/moderator only)
router.patch('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

  // Check admin/moderator role
  const [membership] = await db
    .select()
    .from(clubMembers)
    .where(and(
      eq(clubMembers.clubId, clubId),
      eq(clubMembers.userId, userId)
    ))
    .limit(1)

  if (!membership || (membership.role !== 'admin' && membership.role !== 'moderator')) {
    throw new AppError(403, 'Only admins and moderators can edit club settings')
  }

  const data = updateClubSchema.parse(req.body)

  // Build update object
  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.rules !== undefined) updateData.rules = data.rules
  if (data.category !== undefined) updateData.category = data.category
  if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl
  if (data.isPublic !== undefined) updateData.isPublic = data.isPublic
  if (data.latitude !== undefined) updateData.latitude = data.latitude?.toString() ?? null
  if (data.longitude !== undefined) updateData.longitude = data.longitude?.toString() ?? null
  if (data.address !== undefined) updateData.address = data.address
  if (data.municipalityId !== undefined) updateData.municipalityId = data.municipalityId

  const [updatedClub] = await db
    .update(clubs)
    .set(updateData)
    .where(eq(clubs.id, clubId))
    .returning()

  res.json({
    success: true,
    data: updatedClub
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

  // Private clubs cannot be joined directly — require invitation
  if (!club.isPublic && req.user!.role !== 'admin') {
    throw new AppError(403, 'This club is private — join by invitation only')
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
      contentHtml,
      language: data.language || req.user?.locale || 'fi'
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

  const [club] = await db
    .select({ id: clubs.id, isPublic: clubs.isPublic })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1)

  if (!club) {
    throw new AppError(404, 'Club not found')
  }

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
      memberRole = membership.role
    }
  }

  if (!club.isPublic && !memberRole && req.user?.role !== 'admin') {
    throw new AppError(403, 'This club is private')
  }

  const [threadData] = await db
    .select({
      thread: clubThreads,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: users.role,
        identityVerified: users.identityVerified
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
        role: users.role,
        identityVerified: users.identityVerified
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
      memberRole,
      comments: commentList.map(({ comment, author }) => {
        if (comment.isHidden) {
          return {
            id: comment.id,
            threadId: comment.threadId,
            parentId: comment.parentId,
            authorId: comment.authorId,
            content: '',
            contentHtml: null,
            createdAt: comment.createdAt,
            isHidden: true,
            author: null
          }
        }
        return {
          ...comment,
          author
        }
      })
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
      contentHtml,
      language: data.language || req.user?.locale || 'fi'
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

// ── Moderation endpoints ──

const updateMemberRoleSchema = z.object({
  role: z.enum(['member', 'moderator', 'admin'])
})

const updateThreadModerationSchema = z.object({
  isLocked: z.boolean().optional(),
  isPinned: z.boolean().optional()
})

// PATCH /clubs/:id/members/:userId/role — Change member role
router.patch('/:id/members/:userId/role', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorId = req.user!.id
  const { id: clubId, userId: targetUserId } = req.params
  const { role: newRole } = updateMemberRoleSchema.parse(req.body)

  // Check actor is admin
  const [actorMembership] = await db
    .select()
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, actorId)))
    .limit(1)

  if (!actorMembership || actorMembership.role !== 'admin') {
    throw new AppError(403, 'Only admins can change member roles')
  }

  // Check target is a member
  const [targetMembership] = await db
    .select()
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetUserId)))
    .limit(1)

  if (!targetMembership) {
    throw new AppError(404, 'Member not found')
  }

  // Admin cannot demote themselves if they are the only admin
  if (actorId === targetUserId && targetMembership.role === 'admin' && newRole !== 'admin') {
    const adminCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clubMembers)
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.role, 'admin')))

    if (adminCount[0].count <= 1) {
      throw new AppError(400, 'Cannot demote the only admin')
    }
  }

  await db
    .update(clubMembers)
    .set({ role: newRole })
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetUserId)))

  res.json({ success: true, message: 'Role updated' })
}))

// DELETE /clubs/:id/members/:userId — Remove member from club
router.delete('/:id/members/:userId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorId = req.user!.id
  const { id: clubId, userId: targetUserId } = req.params

  if (actorId === targetUserId) {
    throw new AppError(400, 'Cannot remove yourself — use leave instead')
  }

  // Check actor membership
  const [actorMembership] = await db
    .select()
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, actorId)))
    .limit(1)

  if (!actorMembership || (actorMembership.role !== 'admin' && actorMembership.role !== 'moderator')) {
    throw new AppError(403, 'Only admins and moderators can remove members')
  }

  // Check target membership
  const [targetMembership] = await db
    .select()
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetUserId)))
    .limit(1)

  if (!targetMembership) {
    throw new AppError(404, 'Member not found')
  }

  // Moderator cannot remove admin or other moderators
  if (actorMembership.role === 'moderator' && (targetMembership.role === 'admin' || targetMembership.role === 'moderator')) {
    throw new AppError(403, 'Moderators cannot remove admins or other moderators')
  }

  await db
    .delete(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetUserId)))

  // Update member count
  await db
    .update(clubs)
    .set({ memberCount: sql`${clubs.memberCount} - 1` })
    .where(eq(clubs.id, clubId))

  res.json({ success: true, message: 'Member removed' })
}))

// DELETE /clubs/:clubId/threads/:threadId — Delete thread
router.delete('/:clubId/threads/:threadId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorId = req.user!.id
  const { clubId, threadId } = req.params

  // Get the thread
  const [thread] = await db
    .select()
    .from(clubThreads)
    .where(and(eq(clubThreads.id, threadId), eq(clubThreads.clubId, clubId)))
    .limit(1)

  if (!thread) {
    throw new AppError(404, 'Thread not found')
  }

  // Check permissions: author, admin, or moderator
  const isAuthor = thread.authorId === actorId
  if (!isAuthor) {
    const [membership] = await db
      .select()
      .from(clubMembers)
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, actorId)))
      .limit(1)

    if (!membership || (membership.role !== 'admin' && membership.role !== 'moderator')) {
      throw new AppError(403, 'Not authorized to delete this thread')
    }
  }

  // Delete thread (comments cascade via DB)
  await db
    .delete(clubThreads)
    .where(eq(clubThreads.id, threadId))

  res.json({ success: true, message: 'Thread deleted' })
}))

// PATCH /clubs/:clubId/threads/:threadId — Lock/pin thread
router.patch('/:clubId/threads/:threadId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorId = req.user!.id
  const { clubId, threadId } = req.params
  const data = updateThreadModerationSchema.parse(req.body)

  // Check actor is admin or moderator
  const [membership] = await db
    .select()
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, actorId)))
    .limit(1)

  if (!membership || (membership.role !== 'admin' && membership.role !== 'moderator')) {
    throw new AppError(403, 'Only admins and moderators can lock/pin threads')
  }

  // Verify thread exists in this club
  const [thread] = await db
    .select()
    .from(clubThreads)
    .where(and(eq(clubThreads.id, threadId), eq(clubThreads.clubId, clubId)))
    .limit(1)

  if (!thread) {
    throw new AppError(404, 'Thread not found')
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (data.isLocked !== undefined) updateData.isLocked = data.isLocked
  if (data.isPinned !== undefined) updateData.isPinned = data.isPinned

  const [updatedThread] = await db
    .update(clubThreads)
    .set(updateData)
    .where(eq(clubThreads.id, threadId))
    .returning()

  res.json({ success: true, data: updatedThread })
}))

// DELETE /clubs/:clubId/threads/:threadId/comments/:commentId — Delete comment
router.delete('/:clubId/threads/:threadId/comments/:commentId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorId = req.user!.id
  const { clubId, threadId, commentId } = req.params

  // Verify thread exists in this club
  const [thread] = await db
    .select()
    .from(clubThreads)
    .where(and(eq(clubThreads.id, threadId), eq(clubThreads.clubId, clubId)))
    .limit(1)

  if (!thread) {
    throw new AppError(404, 'Thread not found')
  }

  // Get the comment
  const [comment] = await db
    .select()
    .from(clubComments)
    .where(and(eq(clubComments.id, commentId), eq(clubComments.threadId, threadId)))
    .limit(1)

  if (!comment) {
    throw new AppError(404, 'Comment not found')
  }

  // Check permissions: author, admin, or moderator
  const isAuthor = comment.authorId === actorId
  if (!isAuthor) {
    const [membership] = await db
      .select()
      .from(clubMembers)
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, actorId)))
      .limit(1)

    if (!membership || (membership.role !== 'admin' && membership.role !== 'moderator')) {
      throw new AppError(403, 'Not authorized to delete this comment')
    }
  }

  await db
    .delete(clubComments)
    .where(eq(clubComments.id, commentId))

  // Update reply count
  await db
    .update(clubThreads)
    .set({
      replyCount: sql`GREATEST(${clubThreads.replyCount} - 1, 0)`,
      updatedAt: new Date()
    })
    .where(eq(clubThreads.id, threadId))

  res.json({ success: true, message: 'Comment deleted' })
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
