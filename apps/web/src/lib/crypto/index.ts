/**
 * @module crypto
 *
 * Eulesia end-to-end encryption (E2EE) cryptographic library.
 *
 * Re-exports all public APIs from the individual modules:
 *
 * - **keys** — Key generation, serialization, signing, and ECDH key agreement.
 * - **session** — X3DH session establishment (initiator and responder).
 * - **encrypt** — AES-256-GCM message encryption/decryption with per-message
 *   key derivation.
 * - **store** — IndexedDB-backed key and session state persistence.
 *
 * @example
 * ```ts
 * import {
 *   generateExtractableKeyPair,
 *   initiateSession,
 *   deriveMessageKey,
 *   encryptMessage,
 *   decryptMessage,
 *   saveDeviceKeys,
 * } from "@/lib/crypto";
 * ```
 */

// keys — Key generation, serialization, signing, ECDH
export {
  toBase64url,
  fromBase64url,
  detectCurve,
  generateKeyPair,
  generateSigningKeyPair,
  sign,
  verify,
  deriveSharedSecret,
  exportKeyPair,
  importKeyPair,
  generateExtractableKeyPair,
  generateExtractableSigningKeyPair,
} from "./keys.ts";

export type { KeyPair, ExportedKeyPair, CurveFamily } from "./keys.ts";

// session — X3DH session establishment
export { initiateSession, receiveSession } from "./session.ts";

export type { SessionKeys, InitiatedSession } from "./session.ts";

// encrypt — AES-256-GCM message encryption/decryption
export { deriveMessageKey, encryptMessage, decryptMessage } from "./encrypt.ts";

export type { EncryptedMessage } from "./encrypt.ts";

// store — IndexedDB key and session persistence
export {
  openKeyStore,
  saveDeviceKeys,
  loadDeviceKeys,
  loadDeviceKeysById,
  saveSession,
  loadSession,
  saveSenderKey,
  loadSenderKey,
  clearSenderKeysForConversation,
  clearKeyStore,
} from "./store.ts";

export type {
  DeviceKeys,
  OneTimePreKeyEntry,
  SessionState,
  SenderKeyState,
} from "./store.ts";

// senderKeys — Sender Key group E2EE primitives
export {
  generateSenderKeyMaterial,
  ratchetSenderKey,
  fastForwardChain,
  senderKeyEncrypt,
  senderKeyDecrypt,
} from "./senderKeys.ts";
