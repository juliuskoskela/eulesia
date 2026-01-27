/**
 * EUDI Wallet Authentication Routes
 *
 * These routes handle the OpenID4VP flow for EUDI Wallet authentication.
 * Currently in MVP/testing phase for EU Launchpad integration.
 */

import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { eudiService } from '../services/eudi/index.js'
import { AppError } from '../middleware/errorHandler.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

/**
 * POST /auth/eudi/start
 * Initiate EUDI Wallet authentication
 *
 * Returns:
 * - sessionId: To poll for status
 * - requestUri: openid4vp:// URI for wallet
 * - qrCode: Base64 QR code (for desktop users)
 */
router.post('/start', asyncHandler(async (_req: Request, res: Response) => {
  const { sessionId, requestUri, presentationRequest } = await eudiService.createAuthSession()

  // Generate QR code for the request URI
  // In production, use a proper QR library
  const qrCode = null // TODO: Generate QR code

  res.json({
    success: true,
    data: {
      sessionId,
      requestUri,
      qrCode,
      // Include presentation request for debugging
      ...(process.env.NODE_ENV === 'development' && { presentationRequest })
    }
  })
}))

/**
 * GET /auth/eudi/status/:sessionId
 * Poll for authentication status
 */
router.get('/status/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params

  const session = eudiService.getSession(sessionId)
  if (!session) {
    throw new AppError(404, 'Session not found')
  }

  res.json({
    success: true,
    data: {
      status: session.status,
      ...(session.status === 'completed' && {
        verifiedClaims: session.verifiedClaims
      })
    }
  })
}))

/**
 * POST /auth/eudi/callback
 * Handle wallet response (direct_post from wallet)
 *
 * The wallet sends:
 * - vp_token: The verifiable presentation
 * - presentation_submission: Mapping of credentials to request
 * - state: Our session state
 */
const callbackSchema = z.object({
  vp_token: z.string(),
  presentation_submission: z.string(),
  state: z.string()
})

router.post('/callback', asyncHandler(async (req: Request, res: Response) => {
  const { vp_token, presentation_submission, state } = callbackSchema.parse(req.body)

  const session = await eudiService.processCallback(state, vp_token, presentation_submission)

  if (!session) {
    throw new AppError(400, 'Invalid or expired session')
  }

  if (session.status === 'completed') {
    // TODO: Create user session like we do for magic link
    res.json({
      success: true,
      data: {
        status: 'completed',
        message: 'Authentication successful'
      }
    })
  } else {
    res.json({
      success: false,
      data: {
        status: session.status,
        message: 'Verification failed'
      }
    })
  }
}))

/**
 * GET /auth/eudi/info
 * Information about EUDI Wallet support
 */
router.get('/info', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: true,
      status: 'testing',
      description: 'EUDI Wallet authentication is in testing phase',
      supportedCredentials: ['eu.europa.ec.eudi.pid.1'],
      requestedClaims: ['given_name', 'family_name'],
      identityLevel: 'high',
      documentation: 'https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework'
    }
  })
})

export default router
