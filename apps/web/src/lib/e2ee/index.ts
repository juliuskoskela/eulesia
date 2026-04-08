/**
 * @module e2ee
 *
 * Eulesia end-to-end encryption device management and message encryption.
 *
 * Re-exports all public APIs from the individual modules:
 *
 * - **deviceManager** — Device registration, key generation, and lifecycle.
 * - **messageEncryptor** — Per-device message encryption and decryption.
 * - **apiTypes** — Minimal API client interface for E2EE operations.
 */

// deviceManager — Device registration and lifecycle
export {
  initializeDevice,
  replenishPreKeys,
  getDeviceId,
  consumeOneTimePreKey,
} from "./deviceManager.ts";

export type { DeviceRegistration } from "./deviceManager.ts";

// messageEncryptor — Message encryption and decryption
export {
  ensureSession,
  encryptForConversation,
  decryptConversationMessage,
  encryptForGroup,
  decryptGroupMessage,
  ensureLocalSenderKey,
  distributeSenderKey,
  handleSenderKeyDistribution,
} from "./messageEncryptor.ts";

export type {
  EncryptedPayload,
  SenderKeyDistributionPayload,
} from "./messageEncryptor.ts";

// apiTypes — Minimal API client interface
export type { ApiClient } from "./apiTypes.ts";
