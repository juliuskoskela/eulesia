/**
 * EUDI Wallet Integration Service
 *
 * This service handles authentication via European Digital Identity (EUDI) Wallet.
 * Uses OpenID4VP for verifiable presentation requests and verification.
 *
 * Current status: MVP implementation for Launchpad testing
 *
 * Flow:
 * 1. User clicks "Login with EUDI Wallet"
 * 2. Eulesia creates OpenID4VP presentation request
 * 3. User's wallet shows the request and user approves
 * 4. Wallet sends signed presentation to our callback
 * 5. We verify the presentation and PID issuer trust
 * 6. User is logged in with high identity assurance
 */

import crypto from 'crypto'
import { env } from '../../utils/env.js'

// Types
export interface EudiSession {
  id: string
  state: string
  nonce: string
  status: 'pending' | 'completed' | 'failed' | 'expired'
  userId?: string
  verifiedClaims?: VerifiedClaims
  createdAt: Date
  expiresAt: Date
}

export interface VerifiedClaims {
  givenName: string
  familyName: string
  issuerCountry: string
  verifiedAt: Date
}

export interface PresentationRequest {
  client_id: string
  response_uri: string
  response_type: 'vp_token'
  response_mode: 'direct_post'
  nonce: string
  state: string
  presentation_definition: PresentationDefinition
}

export interface PresentationDefinition {
  id: string
  input_descriptors: InputDescriptor[]
}

export interface InputDescriptor {
  id: string
  format: Record<string, unknown>
  constraints: {
    fields: Array<{
      path: string[]
      filter?: Record<string, unknown>
    }>
  }
}

// In-memory session store (use Redis in production)
const sessions = new Map<string, EudiSession>()

class EudiService {
  private readonly clientId: string
  private readonly callbackUrl: string

  constructor() {
    this.clientId = env.API_URL
    this.callbackUrl = `${env.API_URL}/api/v1/auth/eudi/callback`
  }

  /**
   * Create a new EUDI authentication session
   * Returns the presentation request URI for the wallet
   */
  async createAuthSession(): Promise<{
    sessionId: string
    requestUri: string
    presentationRequest: PresentationRequest
  }> {
    const sessionId = crypto.randomUUID()
    const state = crypto.randomUUID()
    const nonce = crypto.randomUUID()

    // Create presentation definition requesting PID claims
    const presentationDefinition: PresentationDefinition = {
      id: `eulesia-pid-${sessionId}`,
      input_descriptors: [{
        id: 'eu.europa.ec.eudi.pid.1',
        format: {
          'mso_mdoc': {
            alg: ['ES256', 'ES384', 'ES512']
          },
          'vc+sd-jwt': {
            alg: ['ES256', 'ES384', 'ES512']
          }
        },
        constraints: {
          fields: [
            // Request only minimal claims for identity verification
            {
              path: ['$.given_name'],
              filter: { type: 'string' }
            },
            {
              path: ['$.family_name'],
              filter: { type: 'string' }
            }
          ]
        }
      }]
    }

    const presentationRequest: PresentationRequest = {
      client_id: this.clientId,
      response_uri: this.callbackUrl,
      response_type: 'vp_token',
      response_mode: 'direct_post',
      nonce,
      state,
      presentation_definition: presentationDefinition
    }

    // Store session
    const session: EudiSession = {
      id: sessionId,
      state,
      nonce,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    }
    sessions.set(sessionId, session)

    // Build request URI
    // In production, this would be a proper OpenID4VP request URI
    const requestParams = new URLSearchParams({
      client_id: presentationRequest.client_id,
      response_uri: presentationRequest.response_uri,
      response_type: presentationRequest.response_type,
      response_mode: presentationRequest.response_mode,
      nonce: presentationRequest.nonce,
      state: presentationRequest.state,
      presentation_definition: JSON.stringify(presentationRequest.presentation_definition)
    })

    const requestUri = `openid4vp://authorize?${requestParams.toString()}`

    return {
      sessionId,
      requestUri,
      presentationRequest
    }
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): EudiSession | undefined {
    const session = sessions.get(sessionId)
    if (session && session.expiresAt < new Date()) {
      session.status = 'expired'
    }
    return session
  }

  /**
   * Process the VP token from wallet callback
   * This is where the actual verification happens
   */
  async processCallback(
    state: string,
    vpToken: string,
    presentationSubmission: string
  ): Promise<EudiSession | null> {
    // Find session by state
    let session: EudiSession | undefined
    for (const [, s] of sessions) {
      if (s.state === state) {
        session = s
        break
      }
    }

    if (!session || session.status !== 'pending') {
      return null
    }

    try {
      // TODO: Implement actual verification
      // 1. Parse VP token (mso_mdoc or sd-jwt format)
      // 2. Verify signature
      // 3. Check issuer against EU Trust List
      // 4. Verify nonce matches
      // 5. Check credential not revoked
      // 6. Extract claims

      // For now, this is a placeholder that will be implemented
      // when we connect to Launchpad testing
      console.log('EUDI callback received:', {
        state,
        vpTokenLength: vpToken.length,
        presentationSubmission: presentationSubmission.substring(0, 100)
      })

      // Mark as failed until proper verification is implemented
      session.status = 'failed'
      sessions.set(session.id, session)

      return session
    } catch (error) {
      console.error('EUDI verification failed:', error)
      session.status = 'failed'
      sessions.set(session.id, session)
      return session
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = new Date()
    for (const [id, session] of sessions) {
      if (session.expiresAt < now) {
        sessions.delete(id)
      }
    }
  }
}

export const eudiService = new EudiService()

// Cleanup expired sessions every minute
setInterval(() => {
  eudiService.cleanupExpiredSessions()
}, 60 * 1000)
