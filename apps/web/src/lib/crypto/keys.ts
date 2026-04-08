/**
 * @module keys
 *
 * Key generation, serialization, signing, and ECDH key agreement for the
 * Eulesia E2EE messaging protocol.
 *
 * Uses X25519 for key agreement and Ed25519 for signatures when browser
 * support is available, falling back to ECDH/ECDSA with NIST P-256.
 *
 * All private keys are generated as non-extractable CryptoKey objects
 * except when explicitly exported for encrypted IndexedDB backup.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A key pair where the public key is raw bytes and the private key is a
 *  non-extractable CryptoKey handle. */
export interface KeyPair {
  /** Raw public key bytes (32 bytes for X25519/Ed25519, 65 bytes for P-256
   *  uncompressed). */
  publicKey: Uint8Array;
  /** Non-extractable CryptoKey held in the Web Crypto key store. */
  privateKey: CryptoKey;
}

/** Serialized form of a KeyPair suitable for encrypted IndexedDB storage. */
export interface ExportedKeyPair {
  /** Base64url-encoded raw public key. */
  publicKey: string;
  /** Base64url-encoded PKCS8 private key (must be encrypted at rest). */
  privateKey: string;
}

/** The algorithm family in use, detected once at module load time. */
export type CurveFamily = "x25519" | "p256";

// ---------------------------------------------------------------------------
// Internal buffer helper
// ---------------------------------------------------------------------------

/**
 * Ensure a Uint8Array is backed by a plain ArrayBuffer (not SharedArrayBuffer).
 * Required for TS 5.9+ compatibility with the Web Crypto API's BufferSource type.
 */
function buf(data: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(data) as Uint8Array<ArrayBuffer>;
}

// ---------------------------------------------------------------------------
// Base64url helpers
// ---------------------------------------------------------------------------

/** Encode a Uint8Array to a base64url string (RFC 4648 section 5). */
export function toBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Decode a base64url string to a Uint8Array. */
export function fromBase64url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

let _detectedCurve: CurveFamily | null = null;

/**
 * Detect whether the browser supports X25519/Ed25519 natively.
 * Result is cached after the first call.
 */
export async function detectCurve(): Promise<CurveFamily> {
  if (_detectedCurve !== null) return _detectedCurve;

  try {
    const testKey = await crypto.subtle.generateKey({ name: "X25519" }, false, [
      "deriveBits",
    ]);
    // Verify we can actually export the public key as raw bytes
    if ("publicKey" in testKey) {
      await crypto.subtle.exportKey(
        "raw",
        (testKey as CryptoKeyPair).publicKey,
      );
    }
    _detectedCurve = "x25519";
  } catch {
    _detectedCurve = "p256";
  }

  return _detectedCurve;
}

// ---------------------------------------------------------------------------
// Key generation — ECDH (key agreement)
// ---------------------------------------------------------------------------

/**
 * Generate a key pair for Elliptic-Curve Diffie-Hellman key agreement.
 *
 * Uses X25519 when available, otherwise ECDH with the NIST P-256 curve.
 * The private key is non-extractable.
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const curve = await detectCurve();

  if (curve === "x25519") {
    const raw = (await crypto.subtle.generateKey({ name: "X25519" }, false, [
      "deriveBits",
    ])) as CryptoKeyPair;

    const pubRaw = await crypto.subtle.exportKey("raw", raw.publicKey);
    return {
      publicKey: new Uint8Array(pubRaw),
      privateKey: raw.privateKey,
    };
  }

  // P-256 fallback
  const raw = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  )) as CryptoKeyPair;

  const pubRaw = await crypto.subtle.exportKey("raw", raw.publicKey);
  return {
    publicKey: new Uint8Array(pubRaw),
    privateKey: raw.privateKey,
  };
}

// ---------------------------------------------------------------------------
// Key generation — Signing
// ---------------------------------------------------------------------------

/**
 * Generate a signing key pair.
 *
 * Uses Ed25519 when the browser supports it, otherwise ECDSA with P-256.
 * The private key is non-extractable.
 */
export async function generateSigningKeyPair(): Promise<KeyPair> {
  const curve = await detectCurve();

  if (curve === "x25519") {
    // Browsers that support X25519 typically also support Ed25519
    try {
      const raw = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, [
        "sign",
        "verify",
      ])) as CryptoKeyPair;

      const pubRaw = await crypto.subtle.exportKey("raw", raw.publicKey);
      return {
        publicKey: new Uint8Array(pubRaw),
        privateKey: raw.privateKey,
      };
    } catch {
      // Fall through to P-256 ECDSA
    }
  }

  // P-256 ECDSA fallback
  const raw = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  const pubRaw = await crypto.subtle.exportKey("raw", raw.publicKey);
  return {
    publicKey: new Uint8Array(pubRaw),
    privateKey: raw.privateKey,
  };
}

// ---------------------------------------------------------------------------
// Signing / Verification
// ---------------------------------------------------------------------------

/**
 * Sign arbitrary data using the identity signing key.
 *
 * @param privateKey  The signing private CryptoKey (Ed25519 or ECDSA P-256).
 * @param data        The data to sign.
 * @returns           The raw signature bytes.
 */
export async function sign(
  privateKey: CryptoKey,
  data: Uint8Array,
): Promise<Uint8Array> {
  const algo = privateKey.algorithm;

  if (algo.name === "Ed25519") {
    const sig = await crypto.subtle.sign("Ed25519", privateKey, buf(data));
    return new Uint8Array(sig);
  }

  // ECDSA P-256 with SHA-256
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    buf(data),
  );
  return new Uint8Array(sig);
}

/**
 * Verify a signature against a raw public key.
 *
 * @param publicKey   Raw public key bytes.
 * @param signature   The signature bytes to verify.
 * @param data        The original signed data.
 * @returns           `true` if the signature is valid.
 */
export async function verify(
  publicKey: Uint8Array,
  signature: Uint8Array,
  data: Uint8Array,
): Promise<boolean> {
  const curve = await detectCurve();

  if (curve === "x25519") {
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        buf(publicKey),
        { name: "Ed25519" },
        false,
        ["verify"],
      );
      return await crypto.subtle.verify(
        "Ed25519",
        key,
        buf(signature),
        buf(data),
      );
    } catch {
      // Fall through to ECDSA P-256
    }
  }

  const key = await crypto.subtle.importKey(
    "raw",
    buf(publicKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  return await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    buf(signature),
    buf(data),
  );
}

// ---------------------------------------------------------------------------
// ECDH — Shared secret derivation
// ---------------------------------------------------------------------------

/**
 * Perform an Elliptic-Curve Diffie-Hellman key agreement and return the raw
 * shared secret bytes.
 *
 * @param privateKey  Our ECDH private CryptoKey (X25519 or P-256).
 * @param publicKey   Their raw public key bytes.
 * @returns           The raw shared secret (32 bytes for X25519, 32 bytes
 *                    derived from 256-bit P-256 shared point x-coordinate).
 */
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: Uint8Array,
): Promise<Uint8Array> {
  const algo = privateKey.algorithm;

  if (algo.name === "X25519") {
    const theirKey = await crypto.subtle.importKey(
      "raw",
      buf(publicKey),
      { name: "X25519" },
      false,
      [],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "X25519", public: theirKey },
      privateKey,
      256,
    );
    return new Uint8Array(bits);
  }

  // P-256 ECDH
  const theirKey = await crypto.subtle.importKey(
    "raw",
    buf(publicKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: theirKey },
    privateKey,
    256,
  );
  return new Uint8Array(bits);
}

// ---------------------------------------------------------------------------
// Key export / import  (for IndexedDB encrypted backup)
// ---------------------------------------------------------------------------

/**
 * Export a KeyPair to a serializable format.
 *
 * The private key is exported as PKCS8. **Callers must encrypt the result
 * before persisting it to IndexedDB.**
 *
 * This requires regenerating the key pair with `extractable: true` or using
 * a key that was imported as extractable. For initial generation you should
 * use {@link generateExtractableKeyPair} or {@link generateExtractableSigningKeyPair}.
 */
export async function exportKeyPair(kp: KeyPair): Promise<ExportedKeyPair> {
  const privRaw = await crypto.subtle.exportKey("pkcs8", kp.privateKey);
  return {
    publicKey: toBase64url(kp.publicKey),
    privateKey: toBase64url(new Uint8Array(privRaw)),
  };
}

/**
 * Import a serialized KeyPair back into CryptoKey form.
 *
 * @param exported  The base64url-encoded key pair.
 * @param usage     Either "dh" (for ECDH/X25519) or "sign" (for Ed25519/ECDSA).
 * @param extractable Whether the imported private key should be extractable.
 */
export async function importKeyPair(
  exported: ExportedKeyPair,
  usage: "dh" | "sign",
  extractable = false,
): Promise<KeyPair> {
  const pubBytes = fromBase64url(exported.publicKey);
  const privBytes = fromBase64url(exported.privateKey);
  const curve = await detectCurve();

  let privateKey: CryptoKey;

  const privBuf = buf(privBytes);

  if (usage === "dh") {
    if (curve === "x25519") {
      privateKey = await crypto.subtle.importKey(
        "pkcs8",
        privBuf,
        { name: "X25519" },
        extractable,
        ["deriveBits"],
      );
    } else {
      privateKey = await crypto.subtle.importKey(
        "pkcs8",
        privBuf,
        { name: "ECDH", namedCurve: "P-256" },
        extractable,
        ["deriveBits"],
      );
    }
  } else {
    // signing
    if (curve === "x25519") {
      try {
        privateKey = await crypto.subtle.importKey(
          "pkcs8",
          privBuf,
          { name: "Ed25519" },
          extractable,
          ["sign"],
        );
      } catch {
        privateKey = await crypto.subtle.importKey(
          "pkcs8",
          privBuf,
          { name: "ECDSA", namedCurve: "P-256" },
          extractable,
          ["sign"],
        );
      }
    } else {
      privateKey = await crypto.subtle.importKey(
        "pkcs8",
        privBuf,
        { name: "ECDSA", namedCurve: "P-256" },
        extractable,
        ["sign"],
      );
    }
  }

  return { publicKey: pubBytes, privateKey };
}

/**
 * Generate an ECDH key pair whose private key IS extractable, so it can be
 * serialized with {@link exportKeyPair} for encrypted IndexedDB storage.
 */
export async function generateExtractableKeyPair(): Promise<KeyPair> {
  const curve = await detectCurve();

  if (curve === "x25519") {
    const raw = (await crypto.subtle.generateKey({ name: "X25519" }, true, [
      "deriveBits",
    ])) as CryptoKeyPair;
    const pubRaw = await crypto.subtle.exportKey("raw", raw.publicKey);
    return { publicKey: new Uint8Array(pubRaw), privateKey: raw.privateKey };
  }

  const raw = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const pubRaw = await crypto.subtle.exportKey("raw", raw.publicKey);
  return { publicKey: new Uint8Array(pubRaw), privateKey: raw.privateKey };
}

/**
 * Generate a signing key pair whose private key IS extractable, so it can be
 * serialized with {@link exportKeyPair} for encrypted IndexedDB storage.
 */
export async function generateExtractableSigningKeyPair(): Promise<KeyPair> {
  const curve = await detectCurve();

  if (curve === "x25519") {
    try {
      const raw = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
        "sign",
        "verify",
      ])) as CryptoKeyPair;
      const pubRaw = await crypto.subtle.exportKey("raw", raw.publicKey);
      return { publicKey: new Uint8Array(pubRaw), privateKey: raw.privateKey };
    } catch {
      // Fall through to ECDSA P-256
    }
  }

  const raw = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const pubRaw = await crypto.subtle.exportKey("raw", raw.publicKey);
  return { publicKey: new Uint8Array(pubRaw), privateKey: raw.privateKey };
}
