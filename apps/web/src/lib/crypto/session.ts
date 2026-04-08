/**
 * @module session
 *
 * Simplified X3DH (Extended Triple Diffie-Hellman) session establishment for
 * the Eulesia E2EE messaging protocol.
 *
 * X3DH establishes a shared secret between two parties who may be offline.
 * It requires the following DH operations:
 *
 *   DH1 = DH(myIdentity, theirSignedPreKey)
 *   DH2 = DH(myEphemeral, theirIdentity)
 *   DH3 = DH(myEphemeral, theirSignedPreKey)
 *   DH4 = DH(myEphemeral, theirOneTimePreKey)  [optional]
 *
 * The concatenation DH1 || DH2 || DH3 [|| DH4] is fed into HKDF-SHA-256 to
 * derive a pair of symmetric AES-256-GCM keys: one for sending, one for
 * receiving.
 *
 * Uses only the Web Crypto API (`crypto.subtle`).
 */

import type { KeyPair } from "./keys.ts";
import { deriveSharedSecret, generateKeyPair } from "./keys.ts";

/**
 * Ensure a Uint8Array is backed by a plain ArrayBuffer (not SharedArrayBuffer).
 * Required for TS 5.9+ compatibility with the Web Crypto API's BufferSource type.
 */
function buf(data: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(data) as Uint8Array<ArrayBuffer>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A pair of AES-256-GCM keys for bidirectional message encryption. */
export interface SessionKeys {
  /** AES-256-GCM key used by the session initiator to encrypt (and the
   *  responder to decrypt). */
  sendKey: CryptoKey;
  /** AES-256-GCM key used by the session initiator to decrypt (and the
   *  responder to encrypt). */
  receiveKey: CryptoKey;
}

/** The result of initiating an X3DH session. */
export interface InitiatedSession {
  /** The derived symmetric session keys. */
  sessionKeys: SessionKeys;
  /** The ephemeral public key that must be sent to the responder so they can
   *  complete their side of the key agreement. */
  ephemeralPublicKey: Uint8Array;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Concatenate an arbitrary number of Uint8Arrays into a single buffer.
 */
function concat(...arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of arrays) totalLength += arr.length;

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Derive two AES-256-GCM CryptoKeys from concatenated DH shared secrets
 * using HKDF-SHA-256.
 *
 * The info string differentiates the two derived keys:
 * - "eulesia-e2ee-send" for the send key
 * - "eulesia-e2ee-recv" for the receive key
 *
 * @param ikm  Input keying material (concatenated DH outputs).
 * @returns    A pair of extractable AES-256-GCM keys (extractable so they
 *             can be persisted to IndexedDB for session continuity).
 */
async function deriveSessionKeys(ikm: Uint8Array): Promise<SessionKeys> {
  // Import the IKM as an HKDF key
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    buf(ikm),
    "HKDF",
    false,
    ["deriveKey"],
  );

  // Fixed 32-byte salt of zeros (as per Signal X3DH spec when no salt is
  // provided)
  const salt = new Uint8Array(32);

  const encoder = new TextEncoder();

  const sendKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: encoder.encode("eulesia-e2ee-send"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  const receiveKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: encoder.encode("eulesia-e2ee-recv"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  return { sendKey, receiveKey };
}

// ---------------------------------------------------------------------------
// X3DH — Initiator side
// ---------------------------------------------------------------------------

/**
 * Initiate an X3DH session with a remote party.
 *
 * The caller must have obtained the recipient's pre-key bundle from the
 * server (identity key, signed pre-key, and optionally a one-time pre-key).
 *
 * @param myIdentityKey       Our long-term ECDH identity key pair.
 * @param theirIdentityKey    Their raw identity public key bytes.
 * @param theirSignedPreKey   Their raw signed pre-key public key bytes.
 * @param theirOneTimePreKey  Their raw one-time pre-key public key bytes
 *                            (optional; omitted when all OTPs are exhausted).
 * @returns  The session keys and the ephemeral public key that must be
 *           transmitted to the responder.
 */
export async function initiateSession(
  myIdentityKey: KeyPair,
  theirIdentityKey: Uint8Array,
  theirSignedPreKey: Uint8Array,
  theirOneTimePreKey?: Uint8Array,
): Promise<InitiatedSession> {
  // Generate a fresh ephemeral key pair for this session
  const ephemeral = await generateKeyPair();

  // DH1: myIdentity x theirSignedPreKey
  const dh1 = await deriveSharedSecret(
    myIdentityKey.privateKey,
    theirSignedPreKey,
  );

  // DH2: myEphemeral x theirIdentity
  const dh2 = await deriveSharedSecret(ephemeral.privateKey, theirIdentityKey);

  // DH3: myEphemeral x theirSignedPreKey
  const dh3 = await deriveSharedSecret(ephemeral.privateKey, theirSignedPreKey);

  // DH4: myEphemeral x theirOneTimePreKey (optional)
  let ikm: Uint8Array;
  if (theirOneTimePreKey) {
    const dh4 = await deriveSharedSecret(
      ephemeral.privateKey,
      theirOneTimePreKey,
    );
    ikm = concat(dh1, dh2, dh3, dh4);
  } else {
    ikm = concat(dh1, dh2, dh3);
  }

  const sessionKeys = await deriveSessionKeys(ikm);

  return {
    sessionKeys,
    ephemeralPublicKey: ephemeral.publicKey,
  };
}

// ---------------------------------------------------------------------------
// X3DH — Responder side
// ---------------------------------------------------------------------------

/**
 * Complete an X3DH session as the responder.
 *
 * The initiator has already performed their DH operations and sent their
 * ephemeral public key. The responder mirrors the same DH computations with
 * the roles swapped to arrive at the same shared secret.
 *
 * @param myIdentityKey     Our long-term ECDH identity key pair.
 * @param mySignedPreKey    Our signed pre-key pair used by the initiator.
 * @param myOneTimePreKey   Our one-time pre-key pair (optional; must match
 *                          the key the initiator selected).
 * @param theirIdentityKey  The initiator's raw identity public key bytes.
 * @param theirEphemeralKey The initiator's raw ephemeral public key bytes.
 * @returns  The same session keys the initiator derived.
 */
export async function receiveSession(
  myIdentityKey: KeyPair,
  mySignedPreKey: KeyPair,
  myOneTimePreKey: KeyPair | undefined,
  theirIdentityKey: Uint8Array,
  theirEphemeralKey: Uint8Array,
): Promise<SessionKeys> {
  // Mirror the initiator's DH operations:
  // DH1: theirIdentity x mySignedPreKey  (same shared secret as initiator's DH1)
  const dh1 = await deriveSharedSecret(
    mySignedPreKey.privateKey,
    theirIdentityKey,
  );

  // DH2: theirEphemeral x myIdentity  (same shared secret as initiator's DH2)
  const dh2 = await deriveSharedSecret(
    myIdentityKey.privateKey,
    theirEphemeralKey,
  );

  // DH3: theirEphemeral x mySignedPreKey  (same shared secret as initiator's DH3)
  const dh3 = await deriveSharedSecret(
    mySignedPreKey.privateKey,
    theirEphemeralKey,
  );

  // DH4: theirEphemeral x myOneTimePreKey  (optional)
  let ikm: Uint8Array;
  if (myOneTimePreKey) {
    const dh4 = await deriveSharedSecret(
      myOneTimePreKey.privateKey,
      theirEphemeralKey,
    );
    ikm = concat(dh1, dh2, dh3, dh4);
  } else {
    ikm = concat(dh1, dh2, dh3);
  }

  // Note: The responder swaps send/receive keys relative to the initiator,
  // so the initiator's "send" key becomes the responder's "receive" key.
  const derived = await deriveSessionKeys(ikm);
  return {
    sendKey: derived.receiveKey,
    receiveKey: derived.sendKey,
  };
}
