/**
 * @module deviceManager
 *
 * Device lifecycle management for the Eulesia E2EE messaging protocol.
 *
 * On first use, generates cryptographic identity keys, registers the device
 * with the server, and stores key material locally in IndexedDB.
 * On subsequent uses, loads existing keys from IndexedDB.
 */

import {
  generateExtractableKeyPair,
  generateExtractableSigningKeyPair,
  exportKeyPair,
  toBase64url,
  sign,
  loadDeviceKeys,
  saveDeviceKeys,
  clearKeyStore,
} from "../crypto/index.ts";
import type { ExportedKeyPair, OneTimePreKeyEntry } from "../crypto/index.ts";
import type { ApiClient } from "./apiTypes.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeviceRegistration {
  deviceId: string;
  identityPublicKey: string; // base64url
  didCreateDevice: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of one-time pre-keys to generate on initial registration. */
const INITIAL_OTK_COUNT = 100;

/** Replenish one-time keys when the server count drops below this threshold. */
const OTK_REPLENISH_THRESHOLD = 20;

/** Number of one-time keys to upload per replenishment batch. */
const OTK_REPLENISH_BATCH = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect display name from the user agent string. */
function getDisplayName(): string {
  if (typeof navigator === "undefined") return "Unknown Device";
  const ua = navigator.userAgent;

  // Try to extract a readable browser name
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";

  return "Web Browser";
}

/** Detect platform from user agent. */
function getPlatform(): string {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent;

  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Macintosh/.test(ua)) return "macos";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux/.test(ua)) return "linux";

  return "web";
}

/**
 * Generate a batch of one-time pre-keys starting from the given keyId.
 *
 * Each key pair is extractable so it can be serialized to IndexedDB.
 */
async function generateOneTimePreKeys(
  startKeyId: number,
  count: number,
): Promise<OneTimePreKeyEntry[]> {
  const entries: OneTimePreKeyEntry[] = [];
  for (let i = 0; i < count; i++) {
    const keyPair = await generateExtractableKeyPair();
    const exported = await exportKeyPair(keyPair);
    entries.push({ keyId: startKeyId + i, keyPair: exported });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the local device's cryptographic identity.
 *
 * 1. Try loading keys from IndexedDB.
 * 2. If none exist, generate new identity + signed pre-key + 100 OTKs.
 * 3. Register the device with the server (POST /devices).
 * 4. Upload pre-keys (POST /devices/{id}/pre-keys).
 * 5. Persist keys to IndexedDB.
 * 6. Return the device registration info.
 */
export async function initializeDevice(
  api: ApiClient,
  userId: string,
  pairingCode?: string,
): Promise<DeviceRegistration> {
  // Step 1: Try loading existing keys — but verify the device still exists
  // on the server (migrations may have truncated the devices table).
  const existing = await loadDeviceKeys();
  if (existing) {
    if (existing.userId && existing.userId !== userId) {
      await clearKeyStore();
    } else {
      try {
        const serverDevices = await api.listDevices();
        const stillExists = serverDevices.some(
          (d) => d.id === existing.deviceId,
        );
        if (stillExists) {
          if (existing.userId !== userId) {
            await saveDeviceKeys({ ...existing, userId });
          }

          return {
            deviceId: existing.deviceId,
            identityPublicKey: existing.identityKeyPair.publicKey,
            didCreateDevice: false,
          };
        }
      } catch {
        // Preserve the local identity until the server authoritatively confirms
        // that the device is missing. Transient startup failures must not force
        // a new device registration once the device has been bound to a user.
        if (existing.userId === userId) {
          return {
            deviceId: existing.deviceId,
            identityPublicKey: existing.identityKeyPair.publicKey,
            didCreateDevice: false,
          };
        }

        throw new Error("Unable to verify the existing device identity");
      }

      // The server confirmed that this device no longer exists — clear the
      // stale local identity before registering a replacement.
      await clearKeyStore();
    }
  }

  // Step 2: Generate new key material
  const identityKeyPair = await generateExtractableKeyPair();
  const identityExported = await exportKeyPair(identityKeyPair);

  const signingKeyPair = await generateExtractableSigningKeyPair();
  const signingExported = await exportKeyPair(signingKeyPair);

  const signedPreKeyPair = await generateExtractableKeyPair();
  const signedPreKeyExported = await exportKeyPair(signedPreKeyPair);
  const signedPreKeyId = 1;

  // Sign the signed pre-key's public key with the signing key
  const signedPreKeySignature = await sign(
    signingKeyPair.privateKey,
    signedPreKeyPair.publicKey,
  );

  const oneTimePreKeys = await generateOneTimePreKeys(1, INITIAL_OTK_COUNT);

  // Step 3: Register device with server
  const device = await api.registerDevice({
    displayName: getDisplayName(),
    platform: getPlatform(),
    identityKey: identityExported.publicKey,
    signedPreKey: {
      keyId: signedPreKeyId,
      keyData: signedPreKeyExported.publicKey,
      signature: toBase64url(signedPreKeySignature),
    },
    pairingCode,
  });

  // Step 4: Upload one-time pre-keys
  await api.uploadPreKeys(device.id, {
    oneTimeKeys: oneTimePreKeys.map((otk) => ({
      keyId: otk.keyId,
      keyData: otk.keyPair.publicKey,
    })),
  });

  // Step 5: Persist to IndexedDB
  await saveDeviceKeys({
    userId,
    deviceId: device.id,
    identityKeyPair: identityExported,
    signingKeyPair: signingExported,
    signedPreKeyPair: signedPreKeyExported,
    signedPreKeyId,
    oneTimePreKeys,
  });

  // Step 6: Return registration info
  return {
    deviceId: device.id,
    identityPublicKey: identityExported.publicKey,
    didCreateDevice: true,
  };
}

/**
 * Re-upload one-time pre-keys if the server-side count is running low.
 *
 * Called periodically (e.g. on app startup). Checks the server for the
 * available OTK count and uploads a new batch if below the threshold.
 */
export async function replenishPreKeys(
  api: ApiClient,
  deviceId: string,
): Promise<void> {
  const deviceKeys = await loadDeviceKeys();
  if (!deviceKeys || deviceKeys.deviceId !== deviceId) return;

  // Check current OTK count on the device store.
  // If we have fewer than the threshold locally, generate and upload more.
  const localOtkCount = deviceKeys.oneTimePreKeys.length;
  if (localOtkCount >= OTK_REPLENISH_THRESHOLD) return;

  // Determine the next keyId (continue from the highest existing)
  const maxKeyId = deviceKeys.oneTimePreKeys.reduce(
    (max, otk) => Math.max(max, otk.keyId),
    0,
  );

  const newKeys = await generateOneTimePreKeys(
    maxKeyId + 1,
    OTK_REPLENISH_BATCH,
  );

  await api.uploadPreKeys(deviceId, {
    oneTimeKeys: newKeys.map((otk) => ({
      keyId: otk.keyId,
      keyData: otk.keyPair.publicKey,
    })),
  });

  // Update local store with the new keys
  deviceKeys.oneTimePreKeys = [...deviceKeys.oneTimePreKeys, ...newKeys];
  await saveDeviceKeys(deviceKeys);
}

/**
 * Get the current device ID from IndexedDB, or null if no device is
 * registered on this browser.
 */
export async function getDeviceId(): Promise<string | null> {
  const keys = await loadDeviceKeys();
  return keys?.deviceId ?? null;
}

/**
 * Remove a consumed one-time pre-key from the local store.
 * Called after the key has been used in a session establishment.
 */
export async function consumeOneTimePreKey(
  keyId: number,
): Promise<ExportedKeyPair | null> {
  const deviceKeys = await loadDeviceKeys();
  if (!deviceKeys) return null;

  const index = deviceKeys.oneTimePreKeys.findIndex(
    (otk) => otk.keyId === keyId,
  );
  if (index === -1) return null;

  const consumed = deviceKeys.oneTimePreKeys[index]!;
  deviceKeys.oneTimePreKeys.splice(index, 1);
  await saveDeviceKeys(deviceKeys);

  return consumed.keyPair;
}
