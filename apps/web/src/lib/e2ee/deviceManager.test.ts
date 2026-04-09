import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./apiTypes.ts";
import { initializeDevice } from "./deviceManager.ts";

const {
  mockLoadDeviceKeys,
  mockSaveDeviceKeys,
  mockClearKeyStore,
  mockGenerateExtractableKeyPair,
  mockGenerateExtractableSigningKeyPair,
  mockExportKeyPair,
  mockToBase64url,
  mockSign,
} = vi.hoisted(() => ({
  mockLoadDeviceKeys: vi.fn(),
  mockSaveDeviceKeys: vi.fn(),
  mockClearKeyStore: vi.fn(),
  mockGenerateExtractableKeyPair: vi.fn(),
  mockGenerateExtractableSigningKeyPair: vi.fn(),
  mockExportKeyPair: vi.fn(),
  mockToBase64url: vi.fn(),
  mockSign: vi.fn(),
}));

vi.mock("../crypto/index.ts", () => ({
  loadDeviceKeys: mockLoadDeviceKeys,
  saveDeviceKeys: mockSaveDeviceKeys,
  clearKeyStore: mockClearKeyStore,
  generateExtractableKeyPair: mockGenerateExtractableKeyPair,
  generateExtractableSigningKeyPair: mockGenerateExtractableSigningKeyPair,
  exportKeyPair: mockExportKeyPair,
  toBase64url: mockToBase64url,
  sign: mockSign,
}));

const existingKeys = {
  userId: "user-1",
  deviceId: "device-existing",
  identityPublicKey: "identity-public-existing",
};

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    registerDevice: vi.fn(),
    uploadPreKeys: vi.fn(),
    getPreKeyBundle: vi.fn(),
    listDevices: vi.fn(),
    revokeDevice: vi.fn(),
    getUserDevices: vi.fn(),
    ...overrides,
  } as ApiClient;
}

describe("initializeDevice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadDeviceKeys.mockResolvedValue(null);
    mockSaveDeviceKeys.mockResolvedValue(undefined);
    mockClearKeyStore.mockResolvedValue(undefined);
    mockGenerateExtractableKeyPair.mockResolvedValue({
      publicKey: "public-key",
      privateKey: "private-key",
    });
    mockGenerateExtractableSigningKeyPair.mockResolvedValue({
      publicKey: "signing-public-key",
      privateKey: "signing-private-key",
    });
    mockExportKeyPair.mockImplementation(async (keyPair) => ({
      publicKey: `${keyPair.publicKey}-exported`,
      privateKey: `${keyPair.privateKey}-exported`,
    }));
    mockToBase64url.mockReturnValue("signature-base64url");
    mockSign.mockResolvedValue(new Uint8Array([1, 2, 3]));
  });

  it("keeps the existing device identity when device listing fails", async () => {
    mockLoadDeviceKeys.mockResolvedValue(existingKeys);
    const api = makeApiClient({
      listDevices: vi.fn().mockRejectedValue(new Error("temporary outage")),
    });

    const registration = await initializeDevice(api, "user-1");

    expect(registration).toEqual({
      deviceId: existingKeys.deviceId,
      identityPublicKey: existingKeys.identityPublicKey,
      didCreateDevice: false,
    });
    expect(api.listDevices).toHaveBeenCalledTimes(1);
    expect(mockClearKeyStore).not.toHaveBeenCalled();
    expect(api.registerDevice).not.toHaveBeenCalled();
    expect(api.uploadPreKeys).not.toHaveBeenCalled();
    expect(mockSaveDeviceKeys).not.toHaveBeenCalled();
  });

  it("re-registers only after the server confirms the device is missing", async () => {
    mockLoadDeviceKeys.mockResolvedValue(existingKeys);
    const api = makeApiClient({
      listDevices: vi.fn().mockResolvedValue([{ id: "some-other-device" }]),
      registerDevice: vi.fn().mockResolvedValue({ id: "device-new" }),
      uploadPreKeys: vi.fn().mockResolvedValue(undefined),
    });

    const registration = await initializeDevice(api, "user-1");

    expect(mockClearKeyStore).toHaveBeenCalledTimes(1);
    expect(api.registerDevice).toHaveBeenCalledTimes(1);
    expect(api.uploadPreKeys).toHaveBeenCalledTimes(1);
    expect(mockSaveDeviceKeys).toHaveBeenCalledTimes(1);
    expect(registration).toEqual({
      deviceId: "device-new",
      identityPublicKey: "public-key-exported",
      didCreateDevice: true,
    });
  });

  it("clears the key store before reuse when a different user logs in", async () => {
    mockLoadDeviceKeys.mockResolvedValue(existingKeys);
    const api = makeApiClient({
      registerDevice: vi.fn().mockResolvedValue({ id: "device-user-2" }),
      uploadPreKeys: vi.fn().mockResolvedValue(undefined),
    });

    const registration = await initializeDevice(api, "user-2");

    expect(mockClearKeyStore).toHaveBeenCalledTimes(1);
    expect(api.listDevices).not.toHaveBeenCalled();
    expect(api.registerDevice).toHaveBeenCalledTimes(1);
    expect(mockSaveDeviceKeys).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-2",
        deviceId: "device-user-2",
      }),
    );
    expect(registration).toEqual({
      deviceId: "device-user-2",
      identityPublicKey: "public-key-exported",
      didCreateDevice: true,
    });
  });
});
