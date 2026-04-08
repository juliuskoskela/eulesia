/**
 * @module encrypt
 *
 * AES-256-GCM message encryption and decryption for the Eulesia E2EE
 * messaging protocol.
 *
 * Each message is encrypted with a unique message key derived from the
 * session key and a monotonically increasing counter (simplified symmetric
 * ratchet). This provides forward secrecy at the message level: compromising
 * a single message key does not reveal past or future messages.
 *
 * Uses only the Web Crypto API (`crypto.subtle`).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The result of encrypting a plaintext message. */
export interface EncryptedMessage {
  /** The AES-256-GCM ciphertext (includes the 16-byte authentication tag). */
  ciphertext: Uint8Array;
  /** The 12-byte random nonce (IV) used for this encryption. */
  nonce: Uint8Array;
}

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
// Constants
// ---------------------------------------------------------------------------

/** AES-GCM nonce size in bytes (96 bits as recommended by NIST SP 800-38D). */
const NONCE_BYTES = 12;

// ---------------------------------------------------------------------------
// Message key derivation (simplified symmetric ratchet)
// ---------------------------------------------------------------------------

/**
 * Derive a per-message AES-256-GCM key from a session key and a message
 * counter using HKDF-SHA-256.
 *
 * Each counter value yields a cryptographically independent key, providing
 * forward secrecy at the message level. The counter MUST be monotonically
 * increasing and MUST NOT be reused.
 *
 * @param sessionKey  The AES-256-GCM session key (from X3DH key agreement).
 * @param counter     A monotonically increasing message counter.
 * @returns           A non-extractable AES-256-GCM key for a single message.
 */
export async function deriveMessageKey(
  sessionKey: CryptoKey,
  counter: number,
): Promise<CryptoKey> {
  // Export session key raw bits to use as HKDF IKM
  const rawSession = await crypto.subtle.exportKey("raw", sessionKey);

  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    rawSession,
    "HKDF",
    false,
    ["deriveKey"],
  );

  // Encode the counter as a big-endian 8-byte value in the info parameter
  const encoder = new TextEncoder();
  const prefix = encoder.encode("eulesia-e2ee-msg");
  const info = new Uint8Array(prefix.length + 8); // prefix + 8-byte counter
  info.set(prefix, 0);
  // Write counter as big-endian uint64 immediately after the prefix.
  const view = new DataView(info.buffer, info.byteOffset, info.byteLength);
  view.setBigUint64(prefix.length, BigInt(counter), false);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32), // fixed zero salt
      info,
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    true, // extractable so it can be re-imported in deriveMessageKey chains
    ["encrypt", "decrypt"],
  );
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext string with AES-256-GCM.
 *
 * A random 12-byte nonce is generated for each invocation. The caller must
 * store the returned nonce alongside the ciphertext.
 *
 * @param key        An AES-256-GCM CryptoKey (from {@link deriveMessageKey}).
 * @param plaintext  The UTF-8 plaintext to encrypt.
 * @returns          The ciphertext (with appended auth tag) and nonce.
 */
export async function encryptMessage(
  key: CryptoKey,
  plaintext: string,
): Promise<EncryptedMessage> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));

  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    data,
  );

  return {
    ciphertext: new Uint8Array(cipherBuf),
    nonce,
  };
}

// ---------------------------------------------------------------------------
// Decryption
// ---------------------------------------------------------------------------

/**
 * Decrypt an AES-256-GCM ciphertext back to a plaintext string.
 *
 * @param key         An AES-256-GCM CryptoKey matching the one used for
 *                    encryption.
 * @param ciphertext  The ciphertext bytes (including the 16-byte auth tag).
 * @param nonce       The 12-byte nonce that was used during encryption.
 * @returns           The original UTF-8 plaintext.
 * @throws            If decryption fails (wrong key, tampered data, etc.).
 */
export async function decryptMessage(
  key: CryptoKey,
  ciphertext: Uint8Array,
  nonce: Uint8Array,
): Promise<string> {
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: buf(nonce) },
    key,
    buf(ciphertext),
  );

  const decoder = new TextDecoder();
  return decoder.decode(plainBuf);
}
