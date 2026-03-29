import {
  CompactEncrypt,
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  importJWK,
  jwtVerify,
} from "jose";
import { describe, expect, it } from "vitest";
process.env.SESSION_SECRET ??= "test-session-secret-value-with-32-chars";

const {
  createPrivateKeyJwtAssertion,
  createSignedRequestObject,
  getFtnFailureCodeFromError,
  getFtnFailureCodeFromIdura,
  getRequestJwtHeader,
  IduraTokenExchangeError,
  verifyEncryptedIdToken,
} = await import("./iduraFtn.js");

describe("Idura FTN helpers", () => {
  it("creates a signed request object with the expected ES256 claims and kid", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", {
      extractable: true,
    });
    const signingJwk = await exportJWK(privateKey);
    signingJwk.kid = "ftn-signing-key";
    signingJwk.alg = "ES256";

    const signedRequest = await createSignedRequestObject({
      clientId: "urn:test:client",
      issuer: "https://issuer.example",
      nonce: "nonce-123",
      redirectUri: "https://app.example/api/v1/auth/ftn/callback",
      signingKey: await importJWK(signingJwk, "ES256"),
      signingKeyAlg: "ES256",
      signingKeyId: signingJwk.kid,
      state: "state-123",
    });

    const header = getRequestJwtHeader(signedRequest);
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe("ftn-signing-key");

    const verified = await jwtVerify(signedRequest, publicKey, {
      audience: "https://issuer.example",
      issuer: "urn:test:client",
    });

    expect(verified.payload.client_id).toBe("urn:test:client");
    expect(verified.payload.redirect_uri).toBe(
      "https://app.example/api/v1/auth/ftn/callback",
    );
    expect(verified.payload.state).toBe("state-123");
    expect(verified.payload.nonce).toBe("nonce-123");
    expect(verified.payload.acr_values).toBe("urn:grn:authn:fi:all");
  });

  it("creates an ES256 private_key_jwt assertion with kid and jti", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", {
      extractable: true,
    });
    const signingJwk = await exportJWK(privateKey);
    signingJwk.kid = "ftn-client-key";
    signingJwk.alg = "ES256";

    const assertion = await createPrivateKeyJwtAssertion({
      audience: "https://issuer.example/oauth2/token",
      clientId: "urn:test:client",
      signingKey: await importJWK(signingJwk, "ES256"),
      signingKeyAlg: "ES256",
      signingKeyId: signingJwk.kid,
    });

    const header = getRequestJwtHeader(assertion);
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe("ftn-client-key");

    const verified = await jwtVerify(assertion, publicKey, {
      audience: "https://issuer.example/oauth2/token",
      issuer: "urn:test:client",
      subject: "urn:test:client",
    });

    expect(typeof verified.payload.jti).toBe("string");
    expect(verified.payload.jti).toBeTruthy();
  });

  it("decrypts and verifies an encrypted id_token", async () => {
    const { privateKey: issuerPrivateKey, publicKey: issuerPublicKey } =
      await generateKeyPair("RS256", {
        extractable: true,
      });
    const {
      privateKey: clientEncryptionPrivateKey,
      publicKey: clientEncryptionPublicKey,
    } = await generateKeyPair("RSA-OAEP-256", {
      extractable: true,
    });
    const issuerJwk = await exportJWK(issuerPublicKey);
    issuerJwk.kid = "issuer-signing-key";
    const issuerJwks = createLocalJWKSet({
      keys: [{ ...issuerJwk, alg: "RS256", use: "sig" }],
    });
    const signedIdToken = await new SignJWT({
      country: "FI",
      family_name: "Tester",
      given_name: "Testi",
      nonce: "nonce-123",
      sub: "subject-123",
    })
      .setProtectedHeader({
        alg: "RS256",
        kid: issuerJwk.kid,
      })
      .setIssuer("https://issuer.example")
      .setAudience("urn:test:client")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(issuerPrivateKey);
    const encryptedIdToken = await new CompactEncrypt(
      new TextEncoder().encode(signedIdToken),
    )
      .setProtectedHeader({
        alg: "RSA-OAEP-256",
        enc: "A256GCM",
      })
      .encrypt(clientEncryptionPublicKey);
    const clientEncryptionJwk = await exportJWK(clientEncryptionPrivateKey);
    const claims = await verifyEncryptedIdToken({
      audience: "urn:test:client",
      decryptionKey: await importJWK(clientEncryptionJwk, "RSA-OAEP-256"),
      expectedNonce: "nonce-123",
      idToken: encryptedIdToken,
      issuer: "https://issuer.example",
      issuerJwks,
    });

    expect(claims.sub).toBe("subject-123");
    expect(claims.given_name).toBe("Testi");
    expect(claims.family_name).toBe("Tester");
    expect(claims.country).toBe("FI");
  });

  it("rejects an encrypted id_token with a nonce mismatch", async () => {
    const { privateKey: issuerPrivateKey, publicKey: issuerPublicKey } =
      await generateKeyPair("RS256", {
        extractable: true,
      });
    const {
      privateKey: clientEncryptionPrivateKey,
      publicKey: clientEncryptionPublicKey,
    } = await generateKeyPair("RSA-OAEP-256", {
      extractable: true,
    });
    const issuerJwk = await exportJWK(issuerPublicKey);
    issuerJwk.kid = "issuer-signing-key";
    const issuerJwks = createLocalJWKSet({
      keys: [{ ...issuerJwk, alg: "RS256", use: "sig" }],
    });
    const signedIdToken = await new SignJWT({
      family_name: "Tester",
      given_name: "Testi",
      nonce: "wrong-nonce",
      sub: "subject-123",
    })
      .setProtectedHeader({
        alg: "RS256",
        kid: issuerJwk.kid,
      })
      .setIssuer("https://issuer.example")
      .setAudience("urn:test:client")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(issuerPrivateKey);
    const encryptedIdToken = await new CompactEncrypt(
      new TextEncoder().encode(signedIdToken),
    )
      .setProtectedHeader({
        alg: "RSA-OAEP-256",
        enc: "A256GCM",
      })
      .encrypt(clientEncryptionPublicKey);
    const clientEncryptionJwk = await exportJWK(clientEncryptionPrivateKey);

    await expect(
      verifyEncryptedIdToken({
        audience: "urn:test:client",
        decryptionKey: await importJWK(clientEncryptionJwk, "RSA-OAEP-256"),
        expectedNonce: "nonce-123",
        idToken: encryptedIdToken,
        issuer: "https://issuer.example",
        issuerJwks,
      }),
    ).rejects.toThrow("Invalid FTN nonce");
  });

  it("classifies Idura 429 responses as a registration limit failure", () => {
    expect(
      getFtnFailureCodeFromIdura({
        error: "rate_limited",
        errorDescription: "Monthly registration limit reached",
        status: 429,
      }),
    ).toBe("ftn_registration_limit");
  });

  it("classifies Idura token exchange quota errors through the callback helper", () => {
    const error = new IduraTokenExchangeError({
      error: "invalid_request",
      errorDescription: "Monthly registration limit reached",
      status: 400,
    });

    expect(getFtnFailureCodeFromError(error)).toBe("ftn_registration_limit");
  });
});
