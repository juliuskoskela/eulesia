/**
 * @module crypto
 *
 * Eulesia end-to-end encryption (E2EE) cryptographic library.
 *
 * Re-exports all public APIs from the individual modules:
 *
 * - **keys** — Key generation, serialization, signing, and ECDH key agreement.
 * - **store** — IndexedDB-backed device state persistence.
 *
 * @example
 * ```ts
 * import {
 *   generateExtractableKeyPair,
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

// store — IndexedDB key and session persistence
export {
  openKeyStore,
  saveDeviceKeys,
  loadDeviceKeys,
  loadDeviceKeysById,
  clearKeyStore,
} from "./store.ts";

export type { DeviceKeys } from "./store.ts";
