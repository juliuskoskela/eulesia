import { Router, type Response } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, users, municipalities } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import type { AuthenticatedRequest } from '../types/index.js'

const router = Router()

// Validation schemas
const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
  municipalityId: z.string().uuid().optional().nullable(),
  locale: z.enum(['en', 'fi', 'sv']).optional(),
  notificationReplies: z.boolean().optional(),
  notificationMentions: z.boolean().optional(),
  notificationOfficial: z.boolean().optional()
})

// GET /users/:id - Get user profile
router.get('/:id', asyncHandler(async (req, res: Response) => {
  const { id } = req.params

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      role: users.role,
      institutionType: users.institutionType,
      institutionName: users.institutionName,
      identityVerified: users.identityVerified,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)

  if (!user) {
    throw new AppError(404, 'User not found')
  }

  res.json({ success: true, data: user })
}))

// PATCH /users/me - Update own profile
router.patch('/me', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const updates = updateUserSchema.parse(req.body)

  // Validate municipality if provided
  if (updates.municipalityId) {
    const [muni] = await db
      .select()
      .from(municipalities)
      .where(eq(municipalities.id, updates.municipalityId))
      .limit(1)

    if (!muni) {
      throw new AppError(400, 'Invalid municipality')
    }
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      ...updates,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId))
    .returning()

  res.json({ success: true, data: updatedUser })
}))

// GET /users/me/data - GDPR data export
router.get('/me/data', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id

  // Get all user data
  const { threads, comments, clubMembers, rooms, roomMessages, notifications, userSubscriptions } = await import('../db/index.js')

  const [userData] = await db.select().from(users).where(eq(users.id, userId))
  const userThreads = await db.select().from(threads).where(eq(threads.authorId, userId))
  const userComments = await db.select().from(comments).where(eq(comments.authorId, userId))
  const userClubMemberships = await db.select().from(clubMembers).where(eq(clubMembers.userId, userId))
  const userRooms = await db.select().from(rooms).where(eq(rooms.ownerId, userId))
  const userRoomMessages = await db.select().from(roomMessages).where(eq(roomMessages.authorId, userId))
  const userNotifications = await db.select().from(notifications).where(eq(notifications.userId, userId))
  const userSubs = await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId))

  res.json({
    success: true,
    data: {
      exportedAt: new Date().toISOString(),
      user: {
        ...userData,
        email: userData?.email
      },
      threads: userThreads,
      comments: userComments,
      clubMemberships: userClubMemberships,
      rooms: userRooms,
      roomMessages: userRoomMessages,
      notifications: userNotifications,
      subscriptions: userSubs
    }
  })
}))

export default router
