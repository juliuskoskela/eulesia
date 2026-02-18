import { Router, type Response } from 'express'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db, userSubscriptions, users, municipalities, clubs, places } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { notify as sendNotification } from '../services/notify.js'
import type { AuthenticatedRequest } from '../types/index.js'

const router = Router()

// Validation schemas
const subscribeSchema = z.object({
  entityType: z.enum(['user', 'municipality', 'place', 'club', 'tag']),
  entityId: z.string().min(1).max(255),
  notify: z.enum(['all', 'none', 'highlights']).optional().default('all')
})

const entityTypeSchema = z.enum(['user', 'municipality', 'place', 'club', 'tag'])

// POST /subscriptions - Subscribe to an entity
router.post('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const { entityType, entityId, notify } = subscribeSchema.parse(req.body)

  // Verify the entity exists (except for tags which are just strings)
  if (entityType !== 'tag') {
    let exists = false

    switch (entityType) {
      case 'user':
        const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, entityId)).limit(1)
        exists = !!user
        break
      case 'municipality':
        const [municipality] = await db.select({ id: municipalities.id }).from(municipalities).where(eq(municipalities.id, entityId)).limit(1)
        exists = !!municipality
        break
      case 'club':
        const [club] = await db.select({ id: clubs.id }).from(clubs).where(eq(clubs.id, entityId)).limit(1)
        exists = !!club
        break
      case 'place':
        const [place] = await db.select({ id: places.id }).from(places).where(eq(places.id, entityId)).limit(1)
        exists = !!place
        break
    }

    if (!exists) {
      throw new AppError(404, `${entityType} not found`)
    }
  }

  // Check if already subscribed
  const [existing] = await db
    .select()
    .from(userSubscriptions)
    .where(and(
      eq(userSubscriptions.userId, userId),
      eq(userSubscriptions.entityType, entityType),
      eq(userSubscriptions.entityId, entityId)
    ))
    .limit(1)

  if (existing) {
    // Update notify preference if provided
    if (notify !== existing.notify) {
      await db
        .update(userSubscriptions)
        .set({ notify })
        .where(and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.entityType, entityType),
          eq(userSubscriptions.entityId, entityId)
        ))
    }

    res.json({
      success: true,
      data: { entityType, entityId, notify, createdAt: existing.createdAt }
    })
    return
  }

  // Create subscription
  const [subscription] = await db
    .insert(userSubscriptions)
    .values({
      userId,
      entityType,
      entityId,
      notify
    })
    .returning()

  // Notify the followed user
  if (entityType === 'user' && entityId !== userId) {
    const [follower] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (follower) {
      await sendNotification({
        userId: entityId,
        type: 'new_follower',
        title: follower.name,
        body: 'started following you',
        link: `/user/${userId}`
      })
    }
  }

  res.status(201).json({
    success: true,
    data: subscription
  })
}))

// DELETE /subscriptions/:entityType/:entityId - Unsubscribe from an entity
router.delete('/:entityType/:entityId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const entityType = entityTypeSchema.parse(req.params.entityType)
  const { entityId } = req.params

  const result = await db
    .delete(userSubscriptions)
    .where(and(
      eq(userSubscriptions.userId, userId),
      eq(userSubscriptions.entityType, entityType),
      eq(userSubscriptions.entityId, entityId)
    ))
    .returning()

  if (result.length === 0) {
    throw new AppError(404, 'Subscription not found')
  }

  res.json({
    success: true,
    data: { unsubscribed: true }
  })
}))

// GET /subscriptions - List all user's subscriptions
router.get('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id

  const subscriptions = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .orderBy(userSubscriptions.createdAt)

  // Enrich with entity details
  const enriched = await Promise.all(subscriptions.map(async (sub) => {
    let entity: Record<string, unknown> | null = null

    switch (sub.entityType) {
      case 'user':
        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            username: users.username,
            avatarUrl: users.avatarUrl,
            role: users.role,
            institutionType: users.institutionType,
            institutionName: users.institutionName
          })
          .from(users)
          .where(eq(users.id, sub.entityId))
          .limit(1)
        entity = user || null
        break
      case 'municipality':
        const [municipality] = await db
          .select()
          .from(municipalities)
          .where(eq(municipalities.id, sub.entityId))
          .limit(1)
        entity = municipality || null
        break
      case 'club':
        const [club] = await db
          .select({
            id: clubs.id,
            name: clubs.name,
            slug: clubs.slug,
            description: clubs.description,
            category: clubs.category,
            memberCount: clubs.memberCount
          })
          .from(clubs)
          .where(eq(clubs.id, sub.entityId))
          .limit(1)
        entity = club || null
        break
      case 'place':
        const [place] = await db
          .select({
            id: places.id,
            name: places.name,
            type: places.type,
            category: places.category
          })
          .from(places)
          .where(eq(places.id, sub.entityId))
          .limit(1)
        entity = place || null
        break
      case 'tag':
        // For tags, the entityId is the tag itself
        entity = { tag: sub.entityId }
        break
    }

    return {
      entityType: sub.entityType,
      entityId: sub.entityId,
      notify: sub.notify,
      createdAt: sub.createdAt,
      entity
    }
  }))

  res.json({
    success: true,
    data: enriched
  })
}))

// GET /subscriptions/check/:entityType/:entityId - Check if user is subscribed
router.get('/check/:entityType/:entityId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const entityType = entityTypeSchema.parse(req.params.entityType)
  const { entityId } = req.params

  const [subscription] = await db
    .select()
    .from(userSubscriptions)
    .where(and(
      eq(userSubscriptions.userId, userId),
      eq(userSubscriptions.entityType, entityType),
      eq(userSubscriptions.entityId, entityId)
    ))
    .limit(1)

  res.json({
    success: true,
    data: {
      subscribed: !!subscription,
      notify: subscription?.notify || null
    }
  })
}))

export default router
