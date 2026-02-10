import { Router, type Response } from 'express'
import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { db, contentReports, moderationAppeals, userSanctions } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import type { AuthenticatedRequest } from '../types/index.js'

const router = Router()

// POST /reports — Submit a content report (authenticated user)
const createReportSchema = z.object({
  contentType: z.enum(['thread', 'comment', 'club_thread', 'club_comment', 'club', 'user', 'room_message', 'dm']),
  contentId: z.string().uuid(),
  reason: z.enum(['illegal', 'harassment', 'spam', 'misinformation', 'other']),
  description: z.string().max(5000).optional()
})

router.post('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = createReportSchema.parse(req.body)

  const [report] = await db.insert(contentReports).values({
    reporterUserId: req.user!.id,
    contentType: data.contentType,
    contentId: data.contentId,
    reason: data.reason,
    description: data.description
  }).returning()

  res.status(201).json({ success: true, data: report })
}))

// POST /reports/appeal — Submit an appeal (authenticated user)
const createAppealSchema = z.object({
  sanctionId: z.string().uuid().optional(),
  reportId: z.string().uuid().optional(),
  actionId: z.string().uuid().optional(),
  reason: z.string().min(10).max(5000)
})

router.post('/appeal', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = createAppealSchema.parse(req.body)

  if (!data.sanctionId && !data.reportId && !data.actionId) {
    res.status(400).json({ success: false, error: 'Must specify sanctionId, reportId, or actionId' })
    return
  }

  const [appeal] = await db.insert(moderationAppeals).values({
    sanctionId: data.sanctionId,
    reportId: data.reportId,
    actionId: data.actionId,
    userId: req.user!.id,
    reason: data.reason
  }).returning()

  res.status(201).json({ success: true, data: appeal })
}))

// GET /reports/my-sanctions — Get current user's active sanctions
router.get('/my-sanctions', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const sanctions = await db.select()
    .from(userSanctions)
    .where(and(
      eq(userSanctions.userId, req.user!.id),
      isNull(userSanctions.revokedAt)
    ))

  res.json({ success: true, data: sanctions })
}))

export default router
