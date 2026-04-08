/**
 * @module apiTypes
 *
 * Minimal interface for the API client methods used by the E2EE module.
 * This avoids a direct dependency on the full ApiClient class and prevents
 * circular imports.
 */

import type { Device, PreKeyBundle } from "../api.ts";

export interface ApiClient {
  registerDevice(data: {
    displayName: string;
    platform: string;
    identityKey: string;
    signedPreKey: { keyId: number; keyData: string; signature: string };
  }): Promise<Device>;

  uploadPreKeys(
    deviceId: string,
    data: {
      signedPreKey?: { keyId: number; keyData: string; signature: string };
      oneTimeKeys: { keyId: number; keyData: string }[];
    },
  ): Promise<void>;

  getPreKeyBundle(deviceId: string): Promise<PreKeyBundle>;

  listDevices(): Promise<Device[]>;

  revokeDevice(deviceId: string): Promise<void>;

  getUserDevices(userId: string): Promise<Device[]>;
}
