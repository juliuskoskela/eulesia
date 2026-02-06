import { Router, type Response } from 'express'
import { z } from 'zod'
import { eq, and, gt, or } from 'drizzle-orm'
import * as argon2 from 'argon2'
import { db, users, magicLinks, sessions, inviteCodes } from '../db/index.js'
import { generateMagicLinkToken, generateSessionToken, hashToken } from '../utils/crypto.js'
import { emailService } from '../services/email.js'
import { authMiddleware } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { env } from '../utils/env.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { indexUser } from '../services/search/meilisearch.js'
import type { AuthenticatedRequest } from '../types/index.js'

const router = Router()

// Validation schemas
const magicLinkSchema = z.object({
  email: z.string().email('Invalid email address')
})

const verifySchema = z.object({
  token: z.string().min(1, 'Token is required')
})

const registerSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2).max(255)
})

const loginSchema = z.object({
  username: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required')
})

// POST /auth/magic-link - Request a magic link
router.post('/magic-link', asyncHandler(async (req, res: Response) => {
  const { email } = magicLinkSchema.parse(req.body)

  // Generate token
  const { token, hash } = generateMagicLinkToken()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

  // Store magic link
  await db.insert(magicLinks).values({
    email: email.toLowerCase(),
    tokenHash: hash,
    expiresAt
  })

  // Send email
  await emailService.sendMagicLink(email, token)

  // In development, return the login URL directly for easy testing
  if (env.NODE_ENV === 'development') {
    const loginUrl = `${env.API_URL}/api/v1/auth/verify/${token}`
    res.json({
      success: true,
      message: 'If an account exists, you will receive a login link',
      // DEV ONLY - login URL for testing
      _dev: {
        loginUrl,
        note: 'This field only appears in development mode'
      }
    })
    return
  }

  res.json({
    success: true,
    message: 'If an account exists, you will receive a login link'
  })
}))

// POST /auth/register - Register with invite code, username and password
router.post('/register', asyncHandler(async (req, res: Response) => {
  const { inviteCode, username, password, name } = registerSchema.parse(req.body)

  // Validate invite code
  const [invite] = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.code, inviteCode.toUpperCase()))
    .limit(1)

  if (!invite) {
    throw new AppError(400, 'Invalid invite code')
  }

  if (invite.status !== 'available') {
    throw new AppError(400, 'Invite code has already been used')
  }

  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    throw new AppError(400, 'Invite code has expired')
  }

  // Check if username already exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1)

  if (existing) {
    throw new AppError(400, 'Username already exists')
  }

  // Hash password
  const passwordHash = await argon2.hash(password)

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      username: username.toLowerCase(),
      passwordHash,
      name,
      invitedBy: invite.createdBy,
      inviteCodesRemaining: 5,
      identityProvider: 'invite',
      identityVerified: false,
      identityLevel: 'basic'
    })
    .returning()

  // Mark invite code as used
  await db
    .update(inviteCodes)
    .set({
      usedBy: newUser.id,
      status: 'used',
      usedAt: new Date()
    })
    .where(eq(inviteCodes.id, invite.id))

  // Index new user in Meilisearch so they are immediately discoverable
  try {
    await indexUser({
      id: newUser.id,
      name: newUser.name,
      username: newUser.username,
      role: (newUser.role as 'citizen' | 'institution' | 'admin') || 'citizen',
      institutionType: newUser.institutionType || undefined,
      institutionName: newUser.institutionName || undefined,
      createdAt: newUser.createdAt?.toISOString() || new Date().toISOString()
    })
  } catch (err) {
    console.error('Failed to index new user in Meilisearch:', err)
  }

  // Create session
  const { token: sessionToken, hash: sessionHash } = generateSessionToken()
  const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await db.insert(sessions).values({
    userId: newUser.id,
    tokenHash: sessionHash,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    expiresAt: sessionExpiresAt
  })

  // Set session cookie
  res.cookie('session', sessionToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    expires: sessionExpiresAt
  })

  res.status(201).json({
    success: true,
    data: {
      id: newUser.id,
      username: newUser.username,
      name: newUser.name,
      inviteCodesRemaining: newUser.inviteCodesRemaining
    }
  })
}))

// POST /auth/login - Login with username/email and password
router.post('/login', asyncHandler(async (req, res: Response) => {
  const { username, password } = loginSchema.parse(req.body)

  // Find user by username or email
  const [user] = await db
    .select()
    .from(users)
    .where(or(
      eq(users.username, username.toLowerCase()),
      eq(users.email, username.toLowerCase())
    ))
    .limit(1)

  if (!user || !user.passwordHash) {
    res.status(401).json({ success: false, error: 'Invalid credentials' })
    return
  }

  // Verify password
  const validPassword = await argon2.verify(user.passwordHash, password)

  if (!validPassword) {
    res.status(401).json({ success: false, error: 'Invalid credentials' })
    return
  }

  // Create session
  const { token: sessionToken, hash: sessionHash } = generateSessionToken()
  const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: sessionHash,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    expiresAt: sessionExpiresAt
  })

  // Set session cookie
  res.cookie('session', sessionToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    expires: sessionExpiresAt
  })

  res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role
    }
  })
}))

// GET /auth/verify/:token - Verify magic link and create session
router.get('/verify/:token', asyncHandler(async (req, res: Response) => {
  const { token } = verifySchema.parse(req.params)
  const tokenHash = hashToken(token)

  // Find valid magic link
  const [magicLink] = await db
    .select()
    .from(magicLinks)
    .where(
      and(
        eq(magicLinks.tokenHash, tokenHash),
        eq(magicLinks.used, false),
        gt(magicLinks.expiresAt, new Date())
      )
    )
    .limit(1)

  if (!magicLink) {
    res.status(400).json({ success: false, error: 'Invalid or expired link' })
    return
  }

  // Mark as used
  await db
    .update(magicLinks)
    .set({ used: true })
    .where(eq(magicLinks.id, magicLink.id))

  // Find or create user
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, magicLink.email))
    .limit(1)

  if (!user) {
    // Create new user with generated username from email
    const baseUsername = magicLink.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
    const uniqueSuffix = Date.now().toString(36).slice(-4)
    const [newUser] = await db
      .insert(users)
      .values({
        email: magicLink.email,
        username: `${baseUsername}_${uniqueSuffix}`,
        name: magicLink.email.split('@')[0], // Temporary name
        identityProvider: 'magic_link',
        identityVerified: false,
        identityLevel: 'basic'
      })
      .returning()

    user = newUser
  }

  // Create session
  const { token: sessionToken, hash: sessionHash } = generateSessionToken()
  const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: sessionHash,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    expiresAt: sessionExpiresAt
  })

  // Set session cookie
  res.cookie('session', sessionToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    expires: sessionExpiresAt
  })

  // Redirect to app
  res.redirect(`${env.APP_URL}/auth/callback?success=true`)
}))

// POST /auth/logout - End session
router.post('/logout', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (req.sessionId) {
    await db.delete(sessions).where(eq(sessions.id, req.sessionId))
  }

  res.clearCookie('session')
  res.json({ success: true })
}))

// GET /auth/me - Get current user
router.get('/me', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!

  // Get municipality if set
  let municipality = null
  if (user.municipalityId) {
    const { municipalities } = await import('../db/index.js')
    const [muni] = await db
      .select()
      .from(municipalities)
      .where(eq(municipalities.id, user.municipalityId))
      .limit(1)
    municipality = muni
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      institutionType: user.institutionType,
      institutionName: user.institutionName,
      municipality,
      identityVerified: user.identityVerified,
      identityLevel: user.identityLevel,
      settings: {
        notificationReplies: user.notificationReplies,
        notificationMentions: user.notificationMentions,
        notificationOfficial: user.notificationOfficial,
        locale: user.locale
      },
      createdAt: user.createdAt
    }
  })
}))

export default router
