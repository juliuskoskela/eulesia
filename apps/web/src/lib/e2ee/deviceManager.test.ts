import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./apiTypes.ts";
import { initializeDevice } from "./deviceManager.ts";

const { mockLoadDeviceKeys, mockSaveDeviceKeys, mockClearKeyStore } =
  vi.hoisted(() => ({
    mockLoadDeviceKeys: vi.fn(),
    mockSaveDeviceKeys: vi.fn(),
    mockClearKeyStore: vi.fn(),
  }));

vi.mock("../crypto/index.ts", () => ({
  loadDeviceKeys: mockLoadDeviceKeys,
  saveDeviceKeys: mockSaveDeviceKeys,
  clearKeyStore: mockClearKeyStore,
}));

const existingKeys = {
  userId: "user-1",
  deviceId: "device-existing",
};

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    registerDevice: vi.fn(),
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
  });

  it("keeps the existing device identity when device listing fails", async () => {
    mockLoadDeviceKeys.mockResolvedValue(existingKeys);
    const api = makeApiClient({
      listDevices: vi.fn().mockRejectedValue(new Error("temporary outage")),
    });

    const registration = await initializeDevice(api, "user-1");

    expect(registration).toEqual({
      deviceId: existingKeys.deviceId,
      didCreateDevice: false,
    });
    expect(api.listDevices).toHaveBeenCalledTimes(1);
    expect(mockClearKeyStore).not.toHaveBeenCalled();
    expect(api.registerDevice).not.toHaveBeenCalled();
    expect(mockSaveDeviceKeys).not.toHaveBeenCalled();
  });

  it("re-registers only after the server confirms the device is missing", async () => {
    mockLoadDeviceKeys.mockResolvedValue(existingKeys);
    const api = makeApiClient({
      listDevices: vi.fn().mockResolvedValue([{ id: "some-other-device" }]),
      registerDevice: vi.fn().mockResolvedValue({ id: "device-new" }),
    });

    const registration = await initializeDevice(api, "user-1");

    expect(mockClearKeyStore).toHaveBeenCalledTimes(1);
    expect(api.registerDevice).toHaveBeenCalledTimes(1);
    expect(mockSaveDeviceKeys).toHaveBeenCalledTimes(1);
    expect(registration).toEqual({
      deviceId: "device-new",
      didCreateDevice: true,
    });
  });

  it("clears the key store before reuse when a different user logs in", async () => {
    mockLoadDeviceKeys.mockResolvedValue(existingKeys);
    const api = makeApiClient({
      registerDevice: vi.fn().mockResolvedValue({ id: "device-user-2" }),
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
      didCreateDevice: true,
    });
  });
});
