import { Router, type Response } from 'express'
import { z } from 'zod'
import { eq, desc, inArray, and } from 'drizzle-orm'
import { db, users, municipalities, threads, threadTags, institutionTopics } from '../db/index.js'
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

// GET /users/:id - Get user public profile with their public threads
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

  // Get user's public Agora threads (not club threads or private content)
  const userThreads = await db
    .select({
      id: threads.id,
      title: threads.title,
      content: threads.content,
      scope: threads.scope,
      replyCount: threads.replyCount,
      score: threads.score,
      createdAt: threads.createdAt,
      updatedAt: threads.updatedAt,
      municipalityId: threads.municipalityId,
      municipalityName: municipalities.name
    })
    .from(threads)
    .leftJoin(municipalities, eq(threads.municipalityId, municipalities.id))
    .where(eq(threads.authorId, id))
    .orderBy(desc(threads.createdAt))
    .limit(20)

  // Get tags for threads
  const threadIds = userThreads.map(t => t.id)
  const allTags = threadIds.length > 0
    ? await db
        .select()
        .from(threadTags)
        .where(inArray(threadTags.threadId, threadIds))
    : []

  // Build tags map
  const tagsByThread: Record<string, string[]> = {}
  for (const tag of allTags) {
    if (!tagsByThread[tag.threadId]) tagsByThread[tag.threadId] = []
    tagsByThread[tag.threadId].push(tag.tag)
  }

  // For institutions, fetch topic info and separate threads by type
  let institutionTopic = null
  let botSummaries: typeof userThreads = []
  let citizenDiscussions: typeof userThreads = []

  if (user.role === 'institution') {
    // Get institution topic
    const [topic] = await db
      .select()
      .from(institutionTopics)
      .where(eq(institutionTopics.institutionId, id))
      .limit(1)

    if (topic) {
      institutionTopic = topic
    }

    // Get bot summaries (threads where this institution is the source)
    const botThreads = await db
      .select({
        id: threads.id,
        title: threads.title,
        content: threads.content,
        scope: threads.scope,
        replyCount: threads.replyCount,
        score: threads.score,
        createdAt: threads.createdAt,
        updatedAt: threads.updatedAt,
        municipalityId: threads.municipalityId,
        municipalityName: municipalities.name
      })
      .from(threads)
      .leftJoin(municipalities, eq(threads.municipalityId, municipalities.id))
      .where(eq(threads.sourceInstitutionId, id))
      .orderBy(desc(threads.createdAt))
      .limit(20)

    botSummaries = botThreads

    // Get citizen discussions (threads tagged with topic tag, NOT authored by bot)
    if (topic) {
      const taggedThreadIds = await db
        .select({ threadId: threadTags.threadId })
        .from(threadTags)
        .where(eq(threadTags.tag, topic.topicTag))

      const taggedIds = taggedThreadIds.map(t => t.threadId)
      if (taggedIds.length > 0) {
        const citizenThreads = await db
          .select({
            id: threads.id,
            title: threads.title,
            content: threads.content,
            scope: threads.scope,
            replyCount: threads.replyCount,
            score: threads.score,
            createdAt: threads.createdAt,
            updatedAt: threads.updatedAt,
            municipalityId: threads.municipalityId,
            municipalityName: municipalities.name
          })
          .from(threads)
          .leftJoin(municipalities, eq(threads.municipalityId, municipalities.id))
          .where(and(
            inArray(threads.id, taggedIds),
            eq(threads.source, 'user')
          ))
          .orderBy(desc(threads.createdAt))
          .limit(20)

        citizenDiscussions = citizenThreads
      }
    }

    // Get tags for bot summaries and citizen discussions
    const allExtraIds = [...botSummaries, ...citizenDiscussions].map(t => t.id)
    if (allExtraIds.length > 0) {
      const extraTags = await db.select().from(threadTags).where(inArray(threadTags.threadId, allExtraIds))
      for (const tag of extraTags) {
        if (!tagsByThread[tag.threadId]) tagsByThread[tag.threadId] = []
        tagsByThread[tag.threadId].push(tag.tag)
      }
    }
  }

  res.json({
    success: true,
    data: {
      ...user,
      threads: userThreads.map(t => ({
        ...t,
        tags: tagsByThread[t.id] || []
      })),
      // Institution-specific fields
      ...(user.role === 'institution' ? {
        institutionTopic,
        botSummaries: botSummaries.map(t => ({ ...t, tags: tagsByThread[t.id] || [] })),
        citizenDiscussions: citizenDiscussions.map(t => ({ ...t, tags: tagsByThread[t.id] || [] }))
      } : {})
    }
  })
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

// POST /users/me/onboarding-complete - Mark onboarding as completed
router.post('/me/onboarding-complete', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id

  await db
    .update(users)
    .set({ onboardingCompletedAt: new Date() })
    .where(eq(users.id, userId))

  res.json({ success: true })
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

// DELETE /users/me - GDPR account deletion ("right to be forgotten")
// Soft-deletes: anonymizes user data, removes personal info, keeps public content
router.delete('/me', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id

  const { notifications, userSubscriptions, directMessages, conversationParticipants, threadVotes, commentVotes, roomMessages, clubMembers, editHistory } = await import('../db/index.js')

  // 1. Delete user's votes
  await db.delete(threadVotes).where(eq(threadVotes.userId, userId))
  await db.delete(commentVotes).where(eq(commentVotes.userId, userId))

  // 2. Delete notifications
  await db.delete(notifications).where(eq(notifications.userId, userId))

  // 3. Delete subscriptions (both directions)
  await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, userId))

  // 4. Delete DMs and conversation participation
  await db.delete(directMessages).where(eq(directMessages.authorId, userId))
  await db.delete(conversationParticipants).where(eq(conversationParticipants.userId, userId))

  // 5. Delete room messages
  await db.delete(roomMessages).where(eq(roomMessages.authorId, userId))

  // 6. Delete club memberships
  await db.delete(clubMembers).where(eq(clubMembers.userId, userId))

  // 7. Delete edit history
  await db.delete(editHistory).where(eq(editHistory.editedBy, userId))

  // 8. Anonymize the user account (keep row for FK integrity, remove all personal data)
  // Public threads and comments keep their authorId but the user is now "[Poistettu käyttäjä]"
  await db
    .update(users)
    .set({
      name: '[Poistettu käyttäjä]',
      email: `deleted_${userId}@deleted.eulesia.eu`,
      username: `deleted_${userId.slice(0, 8)}`,
      passwordHash: '',
      avatarUrl: null,
      municipalityId: null,
      role: 'citizen',
      institutionType: null,
      institutionName: null,
      notificationReplies: false,
      notificationMentions: false,
      notificationOfficial: false,
      deletedAt: new Date()
    })
    .where(eq(users.id, userId))

  // 9. Clear session cookie
  res.clearCookie('connect.sid')

  res.json({
    success: true,
    data: { deleted: true }
  })
}))

export default router
