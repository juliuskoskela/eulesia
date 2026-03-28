/**
 * FTN (Finnish Trust Network) OIDC client implementation
 *
 * FTN requires:
 * 1. private_key_jwt client authentication (not client_secret)
 * 2. JAR (JWT-Secured Authorization Requests) - signed authorize requests
 * 3. JWE (JSON Web Encryption) - encrypted id_token/userinfo responses
 * 4. Static JWKS registered on Idura dashboard
 */

import * as jose from 'jose'
import crypto from 'crypto'
import type { Request, Response } from 'express'

interface FtnConfig {
  domain: string
  clientId: string
  callbackUrl: string
  appUrl: string
  jwks: {
    keys: jose.JWK[]
  }
}

interface OidcMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
  jwks_uri: string
}

let cachedMetadata: OidcMetadata | null = null

/**
 * Fetch OIDC discovery metadata
 */
async function getMetadata(domain: string): Promise<OidcMetadata> {
  if (cachedMetadata) return cachedMetadata

  const res = await fetch(`https://${domain}/.well-known/openid-configuration`)
  if (!res.ok) throw new Error(`Failed to fetch OIDC metadata: ${res.status}`)
  cachedMetadata = await res.json() as OidcMetadata
  return cachedMetadata
}

/**
 * Get the signing key from JWKS (use=sig)
 */
function getSigningKey(jwks: { keys: jose.JWK[] }): jose.JWK {
  const key = jwks.keys.find(k => k.use === 'sig')
  if (!key) throw new Error('No signing key (use=sig) found in JWKS')
  return key
}

/**
 * Get the encryption key from JWKS (use=enc)
 */
function getEncryptionKey(jwks: { keys: jose.JWK[] }): jose.JWK {
  const key = jwks.keys.find(k => k.use === 'enc')
  if (!key) throw new Error('No encryption key (use=enc) found in JWKS')
  return key
}

/**
 * Create a private_key_jwt client_assertion for the /token endpoint
 */
async function createClientAssertion(config: FtnConfig, tokenEndpoint: string): Promise<string> {
  const sigKey = getSigningKey(config.jwks)
  const privateKey = await jose.importJWK(sigKey, sigKey.alg!)

  const now = Math.floor(Date.now() / 1000)

  return await new jose.SignJWT({})
    .setProtectedHeader({ alg: sigKey.alg!, kid: sigKey.kid, typ: 'JWT' })
    .setIssuer(config.clientId)
    .setSubject(config.clientId)
    .setAudience(tokenEndpoint)
    .setJti(crypto.randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + 120) // 2 minutes
    .sign(privateKey)
}

/**
 * Create a signed JAR (JWT-Secured Authorization Request)
 */
async function createSignedAuthRequest(
  config: FtnConfig,
  metadata: OidcMetadata,
  state: string,
  nonce: string
): Promise<string> {
  const sigKey = getSigningKey(config.jwks)
  const privateKey = await jose.importJWK(sigKey, sigKey.alg!)

  const now = Math.floor(Date.now() / 1000)

  return await new jose.SignJWT({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: 'openid',
    state,
    nonce,
    acr_values: 'urn:grn:authn:fi:all',
    response_mode: 'query',
  })
    .setProtectedHeader({ alg: sigKey.alg!, kid: sigKey.kid, typ: 'JWT' })
    .setIssuer(config.clientId)
    .setAudience(metadata.issuer)
    .setIssuedAt(now)
    .setExpirationTime(now + 300) // 5 minutes
    .sign(privateKey)
}

/**
 * Decrypt a JWE token using the encryption private key
 */
async function decryptJwe(jwe: string, jwks: { keys: jose.JWK[] }): Promise<string> {
  const encKey = getEncryptionKey(jwks)
  const privateKey = await jose.importJWK(encKey, encKey.alg!)

  const { plaintext } = await jose.compactDecrypt(jwe, privateKey)
  return new TextDecoder().decode(plaintext)
}

/**
 * Verify a signed JWT from Idura using their public JWKS
 */
async function verifyIdToken(jwt: string, domain: string, config: FtnConfig, nonce: string): Promise<jose.JWTPayload> {
  const jwks = jose.createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks`))

  const { payload } = await jose.jwtVerify(jwt, jwks, {
    issuer: `https://${domain}`,
    audience: config.clientId,
  })

  // Verify nonce
  if (payload.nonce !== nonce) {
    throw new Error('Nonce mismatch')
  }

  return payload
}

/**
 * Process an id_token that may be JWE-encrypted containing a signed JWT
 */
async function processIdToken(token: string, domain: string, config: FtnConfig, nonce: string): Promise<jose.JWTPayload> {
  // Check if token is JWE (5 parts) or JWT (3 parts)
  const parts = token.split('.')

  if (parts.length === 5) {
    // JWE: decrypt first to get the inner signed JWT
    const innerJwt = await decryptJwe(token, config.jwks)
    return await verifyIdToken(innerJwt, domain, config, nonce)
  } else if (parts.length === 3) {
    // Plain signed JWT
    return await verifyIdToken(token, domain, config, nonce)
  } else {
    throw new Error(`Invalid token format: ${parts.length} parts`)
  }
}

/**
 * Exchange authorization code for tokens using private_key_jwt
 */
async function exchangeCode(
  code: string,
  config: FtnConfig,
  metadata: OidcMetadata
): Promise<{ id_token: string; access_token?: string }> {
  const clientAssertion = await createClientAssertion(config, metadata.token_endpoint)

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.callbackUrl,
    client_id: config.clientId,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion,
  })

  const res = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${error}`)
  }

  return await res.json() as { id_token: string; access_token?: string }
}

// ============================================
// Express route handlers
// ============================================

export function createFtnRoutes(config: FtnConfig) {

  /**
   * GET /ftn/start — Begin FTN authentication
   * Builds a signed authorize request (JAR) and redirects to Idura
   */
  async function handleStart(req: Request, res: Response) {
    try {
      const metadata = await getMetadata(config.domain)

      const state = crypto.randomUUID()
      const nonce = crypto.randomUUID()

      // Store state, nonce, and invite code in session
      const session = req.session as any
      session.ftnState = state
      session.ftnNonce = nonce

      const invite = req.query.invite || req.query.inviteCode
      if (invite) {
        session.inviteCode = invite
      }

      // Create signed authorization request (JAR)
      const requestJwt = await createSignedAuthRequest(config, metadata, state, nonce)

      // Build authorize URL with request parameter
      const authorizeUrl = new URL(metadata.authorization_endpoint)
      authorizeUrl.searchParams.set('client_id', config.clientId)
      authorizeUrl.searchParams.set('request', requestJwt)

      res.redirect(authorizeUrl.toString())
    } catch (error) {
      console.error('FTN start error:', error)
      res.redirect(`${config.appUrl}/?ftn_error=start_failed`)
    }
  }

  /**
   * GET /ftn/callback — Handle Idura callback with authorization code
   * Exchanges code for tokens, decrypts JWE, verifies claims
   */
  async function handleCallback(req: Request, res: Response) {
    try {
      const { code, state, error, error_description } = req.query as Record<string, string>

      if (error) {
        console.error('FTN callback error:', error, error_description)
        res.redirect(`${config.appUrl}/?ftn_error=${encodeURIComponent(error)}`)
        return
      }

      if (!code || !state) {
        res.redirect(`${config.appUrl}/?ftn_error=missing_params`)
        return
      }

      const session = req.session as any

      // Verify state
      if (state !== session.ftnState) {
        console.error('FTN state mismatch:', state, '!==', session.ftnState)
        res.redirect(`${config.appUrl}/?ftn_error=state_mismatch`)
        return
      }

      const nonce = session.ftnNonce
      const inviteCode = session.inviteCode

      // Clean up session
      delete session.ftnState
      delete session.ftnNonce
      delete session.inviteCode

      // Exchange code for tokens
      const metadata = await getMetadata(config.domain)
      const tokens = await exchangeCode(code, config, metadata)

      // Process id_token (decrypt JWE if needed, then verify JWT)
      const claims = await processIdToken(tokens.id_token, config.domain, config, nonce)

      if (!claims.sub || !claims.given_name || !claims.family_name) {
        console.error('FTN missing claims:', Object.keys(claims))
        res.redirect(`${config.appUrl}/?ftn_error=missing_claims`)
        return
      }

      return {
        claims: {
          sub: claims.sub as string,
          given_name: claims.given_name as string,
          family_name: claims.family_name as string,
          country: (claims.country as string) || 'FI',
        },
        inviteCode,
      }
    } catch (error) {
      console.error('FTN callback error:', error)
      res.redirect(`${config.appUrl}/?ftn_error=callback_failed`)
      return null
    }
  }

  return { handleStart, handleCallback }
}
