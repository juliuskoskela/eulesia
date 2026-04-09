/**
 * @module deviceManager
 *
 * Device lifecycle management for the Eulesia E2EE messaging protocol.
 *
 * On first use, registers the browser as a device and retains only the
 * metadata needed to reconnect the Matrix crypto machine to that device ID.
 * On subsequent uses, verifies the stored device ID against the server.
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
import type { ExportedKeyPair } from "../crypto/index.ts";
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
): Promise<Array<{ keyId: number; keyPair: ExportedKeyPair }>> {
  const entries: Array<{ keyId: number; keyPair: ExportedKeyPair }> = [];
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
 * Initialize the local browser device registration.
 *
 * 1. Try loading the existing local device metadata from IndexedDB.
 * 2. If none exists, generate the compatibility registration payload required
 *    by the current server-side device lifecycle.
 * 3. Register the device with the server (POST /devices).
 * 4. Upload one-time pre-keys required by the current compatibility API.
 * 5. Persist only the local device metadata needed by the Matrix adapter.
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
            identityPublicKey: existing.identityPublicKey ?? "",
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
            identityPublicKey: existing.identityPublicKey ?? "",
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
    identityPublicKey: identityExported.publicKey,
  });

  // Step 6: Return registration info
  return {
    deviceId: device.id,
    identityPublicKey: identityExported.publicKey,
    didCreateDevice: true,
  };
}
