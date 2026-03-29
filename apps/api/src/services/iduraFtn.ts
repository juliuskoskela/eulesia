import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  SignJWT,
  compactDecrypt,
  createRemoteJWKSet,
  importJWK,
  jwtVerify,
  type JWK,
  type JWSHeaderParameters,
  type JWTPayload,
} from "jose";
import { z } from "zod";
import { env } from "../utils/env.js";

const FTN_ACR_VALUES = "urn:grn:authn:fi:all";
const DEFAULT_ENCRYPTION_ALG = "RSA-OAEP-256";
const CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
const textDecoder = new TextDecoder();

const iduraClaimsSchema = z.object({
  sub: z.string().min(1),
  given_name: z.string().min(1),
  family_name: z.string().min(1),
  country: z.string().nullable().optional(),
});

const iduraDiscoverySchema = z.object({
  issuer: z.string().url(),
  authorization_endpoint: z.string().url(),
  token_endpoint: z.string().url(),
  jwks_uri: z.string().url(),
});

export type IduraIdentityClaims = z.infer<typeof iduraClaimsSchema>;
type VerifyKeyResolver = Parameters<typeof jwtVerify>[1];
type ImportedPrivateKey = Awaited<ReturnType<typeof importJWK>>;
type IduraDiscoveryDocument = z.infer<typeof iduraDiscoverySchema>;
type SupportedSigningAlg = "ES256" | "RS256";

interface LoadedClientKey<Alg extends string = string> {
  importedKey: ImportedPrivateKey;
  jwk: JWK;
  alg: Alg;
  kid: string;
}

interface IduraClientKeys {
  signing: LoadedClientKey<SupportedSigningAlg>;
  encryption: LoadedClientKey<typeof DEFAULT_ENCRYPTION_ALG>;
}

interface RequestObjectOptions {
  clientId: string;
  redirectUri: string;
  signingKey: ImportedPrivateKey;
  signingKeyAlg: SupportedSigningAlg;
  signingKeyId: string;
  issuer: string;
  state: string;
  nonce: string;
  loginHint?: string;
}

interface ClientAssertionOptions {
  clientId: string;
  signingKey: ImportedPrivateKey;
  signingKeyAlg: SupportedSigningAlg;
  signingKeyId: string;
  audience: string;
}

interface VerifyEncryptedIdTokenOptions {
  idToken: string;
  audience: string;
  issuer: string;
  decryptionKey: ImportedPrivateKey;
  issuerJwks: VerifyKeyResolver;
  expectedNonce: string;
}

interface IduraTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  id_token?: string;
}

let discoveryPromise: Promise<IduraDiscoveryDocument> | null = null;
let clientKeysPromise: Promise<IduraClientKeys> | null = null;
let issuerJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function parseJsonFile(raw: string, fieldName: string): JWK {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${fieldName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return parsed as JWK;
}

function requireIduraValue(
  value: string | undefined,
  fieldName: string,
): string {
  if (!value) {
    throw new Error(`Missing required Idura configuration: ${fieldName}`);
  }

  return value;
}

function resolveSigningAlg(jwk: JWK, fieldName: string): SupportedSigningAlg {
  if (jwk.use && jwk.use !== "sig") {
    throw new Error(`${fieldName} must be a signing JWK`);
  }

  if (jwk.alg === "ES256" || jwk.alg === "RS256") {
    return jwk.alg;
  }

  if (jwk.kty === "EC" && jwk.crv === "P-256") {
    return "ES256";
  }

  if (jwk.kty === "RSA") {
    return "RS256";
  }

  throw new Error(
    `${fieldName} must declare a supported signing algorithm (ES256 or RS256)`,
  );
}

async function loadSigningPrivateJwk(
  filePath: string,
  fieldName: string,
): Promise<LoadedClientKey<SupportedSigningAlg>> {
  const raw = await readFile(filePath, "utf8");
  const jwk = parseJsonFile(raw, fieldName);
  const alg = resolveSigningAlg(jwk, fieldName);

  if (typeof jwk.kid !== "string" || jwk.kid.length === 0) {
    throw new Error(`${fieldName} must include a JWK kid`);
  }

  return {
    importedKey: await importJWK(jwk, alg),
    alg,
    jwk,
    kid: jwk.kid,
  };
}

async function loadEncryptionPrivateJwk(
  filePath: string,
  fieldName: string,
): Promise<LoadedClientKey<typeof DEFAULT_ENCRYPTION_ALG>> {
  const raw = await readFile(filePath, "utf8");
  const jwk = parseJsonFile(raw, fieldName);
  const alg = jwk.alg ?? DEFAULT_ENCRYPTION_ALG;

  if (jwk.use && jwk.use !== "enc") {
    throw new Error(`${fieldName} must be an encryption JWK`);
  }

  if (jwk.kty !== "RSA" || alg !== DEFAULT_ENCRYPTION_ALG) {
    throw new Error(`${fieldName} must be an RSA-OAEP-256 encryption JWK`);
  }

  if (typeof jwk.kid !== "string" || jwk.kid.length === 0) {
    throw new Error(`${fieldName} must include a JWK kid`);
  }

  return {
    importedKey: await importJWK(jwk, alg),
    alg,
    jwk,
    kid: jwk.kid,
  };
}

async function getDiscoveryDocument(): Promise<IduraDiscoveryDocument> {
  if (!discoveryPromise) {
    const iduraDomain = requireIduraValue(env.IDURA_DOMAIN, "IDURA_DOMAIN");

    discoveryPromise = fetch(
      `https://${iduraDomain}/.well-known/openid-configuration`,
    ).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Failed to fetch Idura discovery document: ${response.status} ${response.statusText}`,
        );
      }

      return iduraDiscoverySchema.parse(await response.json());
    });
  }

  return discoveryPromise;
}

async function getClientKeys(): Promise<IduraClientKeys> {
  if (!clientKeysPromise) {
    const signingKeyFile = requireIduraValue(
      env.IDURA_SIGNING_KEY_FILE,
      "IDURA_SIGNING_KEY_FILE",
    );
    const encryptionKeyFile = requireIduraValue(
      env.IDURA_ENCRYPTION_KEY_FILE,
      "IDURA_ENCRYPTION_KEY_FILE",
    );

    clientKeysPromise = Promise.all([
      loadSigningPrivateJwk(signingKeyFile, "IDURA_SIGNING_KEY_FILE"),
      loadEncryptionPrivateJwk(encryptionKeyFile, "IDURA_ENCRYPTION_KEY_FILE"),
    ]).then(([signing, encryption]) => ({
      signing,
      encryption,
    }));
  }

  return clientKeysPromise;
}

function getIssuerJwks(jwksUrl: string) {
  if (!issuerJwks) {
    issuerJwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  return issuerJwks;
}

export function isIduraFtnEnabled(): boolean {
  return Boolean(
    env.IDURA_DOMAIN &&
      env.IDURA_CLIENT_ID &&
      env.IDURA_CALLBACK_URL &&
      env.IDURA_SIGNING_KEY_FILE &&
      env.IDURA_ENCRYPTION_KEY_FILE,
  );
}

export async function createSignedRequestObject({
  clientId,
  redirectUri,
  signingKey,
  signingKeyAlg,
  signingKeyId,
  issuer,
  state,
  nonce,
  loginHint,
}: RequestObjectOptions): Promise<string> {
  const requestObjectPayload: JWTPayload = {
    acr_values: FTN_ACR_VALUES,
    client_id: clientId,
    nonce,
    redirect_uri: redirectUri,
    response_mode: "query",
    response_type: "code",
    scope: "openid",
    state,
    ...(loginHint ? { login_hint: loginHint } : {}),
  };

  return new SignJWT(requestObjectPayload)
    .setProtectedHeader({
      alg: signingKeyAlg,
      kid: signingKeyId,
    })
    .setIssuer(clientId)
    .setAudience(issuer)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setJti(randomUUID())
    .sign(signingKey);
}

export async function createPrivateKeyJwtAssertion({
  clientId,
  signingKey,
  signingKeyAlg,
  signingKeyId,
  audience,
}: ClientAssertionOptions): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({
      alg: signingKeyAlg,
      kid: signingKeyId,
    })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setJti(randomUUID())
    .sign(signingKey);
}

export async function verifyEncryptedIdToken({
  idToken,
  audience,
  issuer,
  decryptionKey,
  issuerJwks,
  expectedNonce,
}: VerifyEncryptedIdTokenOptions): Promise<IduraIdentityClaims> {
  const { plaintext } = await compactDecrypt(idToken, decryptionKey);
  const signedJwt = textDecoder.decode(plaintext);
  const { payload } = await jwtVerify(signedJwt, issuerJwks, {
    audience,
    issuer,
  });

  if (payload.nonce !== expectedNonce) {
    throw new Error("Invalid FTN nonce");
  }

  return iduraClaimsSchema.parse(payload);
}

export async function buildIduraAuthorizeUrl({
  loginHint,
  nonce,
  state,
}: {
  loginHint?: string;
  nonce: string;
  state: string;
}): Promise<URL> {
  const discovery = await getDiscoveryDocument();
  const { signing } = await getClientKeys();
  const clientId = requireIduraValue(env.IDURA_CLIENT_ID, "IDURA_CLIENT_ID");
  const callbackUrl = requireIduraValue(
    env.IDURA_CALLBACK_URL,
    "IDURA_CALLBACK_URL",
  );
  const requestObject = await createSignedRequestObject({
    clientId,
    issuer: discovery.issuer,
    loginHint,
    nonce,
    redirectUri: callbackUrl,
    signingKey: signing.importedKey,
    signingKeyAlg: signing.alg,
    signingKeyId: signing.kid,
    state,
  });

  const authorizeUrl = new URL(discovery.authorization_endpoint);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("request", requestObject);

  return authorizeUrl;
}

export async function exchangeIduraAuthorizationCode(
  code: string,
): Promise<IduraTokenResponse> {
  const discovery = await getDiscoveryDocument();
  const { signing } = await getClientKeys();
  const clientId = requireIduraValue(env.IDURA_CLIENT_ID, "IDURA_CLIENT_ID");
  const callbackUrl = requireIduraValue(
    env.IDURA_CALLBACK_URL,
    "IDURA_CALLBACK_URL",
  );
  const clientAssertion = await createPrivateKeyJwtAssertion({
    audience: discovery.token_endpoint,
    clientId,
    signingKey: signing.importedKey,
    signingKeyAlg: signing.alg,
    signingKeyId: signing.kid,
  });
  const body = new URLSearchParams({
    client_assertion: clientAssertion,
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    client_id: clientId,
    code,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl,
  });
  const response = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "cache-control": "no-cache, no-store, must-revalidate",
    },
    body: body.toString(),
  });

  let payload: IduraTokenResponse;

  try {
    payload = (await response.json()) as IduraTokenResponse;
  } catch (error) {
    throw new Error(
      `Failed to parse Idura token response: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok || payload.error) {
    throw new Error(
      payload.error_description ||
        payload.error ||
        `Idura token exchange failed with ${response.status}`,
    );
  }

  return payload;
}

export async function completeIduraAuthentication({
  code,
  expectedNonce,
}: {
  code: string;
  expectedNonce: string;
}): Promise<IduraIdentityClaims> {
  const discovery = await getDiscoveryDocument();
  const { encryption } = await getClientKeys();
  const tokenResponse = await exchangeIduraAuthorizationCode(code);

  if (!tokenResponse.id_token) {
    throw new Error("No id_token returned from Idura");
  }

  return verifyEncryptedIdToken({
    audience: requireIduraValue(env.IDURA_CLIENT_ID, "IDURA_CLIENT_ID"),
    decryptionKey: encryption.importedKey,
    expectedNonce,
    idToken: tokenResponse.id_token,
    issuer: discovery.issuer,
    issuerJwks: getIssuerJwks(discovery.jwks_uri),
  });
}

export function getFtnFailureRedirect(errorCode: string): string {
  return `${env.APP_URL}/register?ftn_error=${encodeURIComponent(errorCode)}`;
}

export function getRequestJwtHeader(token: string): JWSHeaderParameters {
  const [protectedHeader] = token.split(".", 1);

  if (!protectedHeader) {
    throw new Error("Invalid JWT");
  }

  return JSON.parse(
    textDecoder.decode(Buffer.from(protectedHeader, "base64url")),
  );
}
