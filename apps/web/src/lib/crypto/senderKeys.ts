/**
 * @module senderKeys
 *
 * Sender Key cryptographic primitives for group E2EE.
 *
 * Each group member maintains a sender key — a symmetric chain key that
 * ratchets forward with each message. The chain ratchet uses HMAC-SHA256
 * to derive per-message encryption keys while providing forward secrecy.
 *
 * Protocol:
 *   messageKey  = HMAC-SHA256(chainKey, 0x01)
 *   nextChain   = HMAC-SHA256(chainKey, 0x02)
 *
 * The message key is fed into HKDF-SHA256 to produce the final AES-256-GCM key.
 */

import { toBase64url, fromBase64url } from "./keys.ts";

// ---------------------------------------------------------------------------
// Sender key generation
// ---------------------------------------------------------------------------

/**
 * Generate a fresh 256-bit sender key chain key.
 */
export function generateSenderKeyMaterial(): string {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return toBase64url(raw);
}

// ---------------------------------------------------------------------------
// Chain ratchet
// ---------------------------------------------------------------------------

/**
 * Derive a per-message encryption key from the current chain key.
 * Returns the AES-256-GCM key and the next chain key (ratcheted forward).
 */
export async function ratchetSenderKey(chainKeyB64: string): Promise<{
  messageKey: CryptoKey;
  nextChainKey: string;
}> {
  const chainKeyBytes = fromBase64url(chainKeyB64) as Uint8Array<ArrayBuffer>;

  const hmacKey = await crypto.subtle.importKey(
    "raw",
    chainKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // Derive message key material: HMAC(chainKey, 0x01)
  const messageKeyBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", hmacKey, new Uint8Array([0x01])),
  );

  // Ratchet chain forward: HMAC(chainKey, 0x02)
  const nextChainBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", hmacKey, new Uint8Array([0x02])),
  );

  // Derive AES-256-GCM key from message key material via HKDF
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    messageKeyBytes,
    "HKDF",
    false,
    ["deriveKey"],
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("eulesia-group-msg"),
      info: new Uint8Array(0),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  return {
    messageKey: aesKey,
    nextChainKey: toBase64url(nextChainBytes),
  };
}

/**
 * Fast-forward the chain by N steps, returning the message key at the
 * target index. Used by recipients who may be behind the sender's counter.
 */
export async function fastForwardChain(
  chainKeyB64: string,
  steps: number,
): Promise<{ messageKey: CryptoKey; nextChainKey: string }> {
  let currentChain = chainKeyB64;

  // Skip `steps` positions (discard intermediate keys)
  for (let i = 0; i < steps; i++) {
    const { nextChainKey } = await ratchetSenderKey(currentChain);
    currentChain = nextChainKey;
  }

  // Derive the key at the target position
  return ratchetSenderKey(currentChain);
}

// ---------------------------------------------------------------------------
// Envelope encrypt/decrypt for group messages
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext message using the sender's current chain key.
 */
export async function senderKeyEncrypt(
  messageKey: CryptoKey,
  plaintext: string,
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      messageKey,
      encoded,
    ),
  );

  return { ciphertext: ct, nonce };
}

/**
 * Decrypt a ciphertext using a derived message key.
 */
export async function senderKeyDecrypt(
  messageKey: CryptoKey,
  ciphertext: Uint8Array<ArrayBuffer>,
  nonce: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    messageKey,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}
