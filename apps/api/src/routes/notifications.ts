import { Router, type Response } from 'express'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db, notifications, pushSubscriptions } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getVapidPublicKey, isWebPushEnabled } from '../services/pushNotifications.js'
import type { AuthenticatedRequest } from '../types/index.js'

const router = Router()

// GET /notifications — List user's notifications (newest first)
router.get('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const { limit = '20' } = req.query
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)))

  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limitNum)

  res.json({
    success: true,
    data: items.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt?.toISOString()
    }))
  })
}))

// GET /notifications/unread-count — Count of unread notifications
router.get('/unread-count', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.read, false)
    ))

  res.json({
    success: true,
    data: { count: result?.count ?? 0 }
  })
}))

// POST /notifications/:id/read — Mark single notification as read
router.post('/:id/read', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const { id } = req.params

  const [updated] = await db
    .update(notifications)
    .set({ read: true })
    .where(and(
      eq(notifications.id, id),
      eq(notifications.userId, userId)
    ))
    .returning()

  if (!updated) {
    throw new AppError(404, 'Notification not found')
  }

  res.json({ success: true, data: { read: true } })
}))

// POST /notifications/read-all — Mark all notifications as read
router.post('/read-all', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.read, false)
    ))

  res.json({ success: true, data: { read: true } })
}))

// DELETE /notifications/:id — Delete a notification
router.delete('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const { id } = req.params

  const [deleted] = await db
    .delete(notifications)
    .where(and(
      eq(notifications.id, id),
      eq(notifications.userId, userId)
    ))
    .returning()

  if (!deleted) {
    throw new AppError(404, 'Notification not found')
  }

  res.json({ success: true, data: { deleted: true } })
}))

// GET /notifications/push/vapid-public-key — Get VAPID public key for push subscription
router.get('/push/vapid-public-key', authMiddleware, asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const key = getVapidPublicKey()
  res.json({
    success: true,
    data: {
      enabled: isWebPushEnabled(),
      vapidPublicKey: key || null
    }
  })
}))

// POST /notifications/push/subscribe — Register a push subscription
router.post('/push/subscribe', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const { endpoint, keys } = req.body

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new AppError(400, 'Invalid push subscription: endpoint, keys.p256dh, and keys.auth required')
  }

  if (!isWebPushEnabled()) {
    throw new AppError(503, 'Push notifications are not configured on this server')
  }

  // Upsert: delete existing subscription for this endpoint, then insert
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))

  await db.insert(pushSubscriptions).values({
    userId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    userAgent: req.headers['user-agent'] || null
  })

  res.json({ success: true, data: { subscribed: true } })
}))

// DELETE /notifications/push/subscribe — Unsubscribe from push notifications
router.delete('/push/subscribe', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  const { endpoint } = req.body

  if (!endpoint) {
    throw new AppError(400, 'Endpoint required')
  }

  await db.delete(pushSubscriptions).where(
    and(
      eq(pushSubscriptions.userId, userId),
      eq(pushSubscriptions.endpoint, endpoint)
    )
  )

  res.json({ success: true, data: { unsubscribed: true } })
}))

export default router
