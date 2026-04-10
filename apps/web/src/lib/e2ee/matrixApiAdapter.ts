import type {
  ApiClient,
  MatrixKeysClaimPayload,
  MatrixKeysQueryPayload,
  MatrixKeysUploadPayload,
} from "./apiTypes.ts";
import {
  asMatrixDeviceId,
  asMatrixUserId,
  getMatrixCryptoMachine,
  getMatrixCryptoModule,
} from "./matrixCrypto.ts";

async function requireMatrixMachine() {
  const machine = await getMatrixCryptoMachine();
  if (!machine) {
    throw new Error("Matrix crypto machine is not initialized");
  }
  return machine;
}

async function markRequestAsSent(
  requestId: string,
  requestType: import("@matrix-org/matrix-sdk-crypto-wasm").RequestType,
  response: unknown,
): Promise<void> {
  const machine = await requireMatrixMachine();
  await machine.markRequestAsSent(
    requestId,
    requestType,
    JSON.stringify(response),
  );
}

export async function syncMatrixMachine(
  api: ApiClient,
  deviceId: string,
): Promise<void> {
  const matrix = await getMatrixCryptoModule();
  const machine = await requireMatrixMachine();

  for (;;) {
    const requests = await machine.outgoingRequests();
    let handledRequest = false;

    for (const request of requests) {
      if (request instanceof matrix.KeysUploadRequest) {
        handledRequest = true;
        const response = await api.uploadMatrixKeys(
          deviceId,
          JSON.parse(request.body) as MatrixKeysUploadPayload,
        );
        await markRequestAsSent(request.id, request.type, response);
        continue;
      }

      if (request instanceof matrix.KeysQueryRequest) {
        handledRequest = true;
        const response = await api.queryMatrixKeys(
          JSON.parse(request.body) as MatrixKeysQueryPayload,
        );
        await markRequestAsSent(request.id, request.type, response);
        continue;
      }

      if (request instanceof matrix.KeysClaimRequest) {
        handledRequest = true;
        const response = await api.claimMatrixKeys(
          JSON.parse(request.body) as MatrixKeysClaimPayload,
        );
        await markRequestAsSent(request.id, request.type, response);
      }
    }

    if (!handledRequest) {
      return;
    }
  }
}

export async function ensureMatrixSessions(
  api: ApiClient,
  deviceId: string,
  userIds: string[],
): Promise<void> {
  const matrix = await getMatrixCryptoModule();
  const machine = await requireMatrixMachine();
  const uniqueUserIds = [...new Set(userIds)].map((userId) =>
    asMatrixUserId(userId),
  );

  await machine.updateTrackedUsers(
    uniqueUserIds.map((userId) => new matrix.UserId(userId)),
  );
  await syncMatrixMachine(api, deviceId);

  for (;;) {
    const claimRequest = await machine.getMissingSessions(
      uniqueUserIds.map((userId) => new matrix.UserId(userId)),
    );
    if (!claimRequest) {
      return;
    }

    const response = await api.claimMatrixKeys(
      JSON.parse(claimRequest.body) as MatrixKeysClaimPayload,
    );
    await markRequestAsSent(claimRequest.id, claimRequest.type, response);
    await syncMatrixMachine(api, deviceId);
  }
}

export async function getMatrixDevice(userId: string, deviceId: string) {
  const matrix = await getMatrixCryptoModule();
  const machine = await requireMatrixMachine();

  return machine.getDevice(
    new matrix.UserId(asMatrixUserId(userId)),
    new matrix.DeviceId(asMatrixDeviceId(deviceId)),
  );
}

type MatrixToDeviceEvent = {
  type: string;
  sender: string;
  content: Record<string, unknown>;
};

function isDecryptedToDeviceEvent(
  matrix: typeof import("@matrix-org/matrix-sdk-crypto-wasm"),
  event: unknown,
): event is import("@matrix-org/matrix-sdk-crypto-wasm").DecryptedToDeviceEvent {
  return event instanceof matrix.DecryptedToDeviceEvent;
}

export async function decryptMatrixToDeviceEvent(
  event: MatrixToDeviceEvent,
): Promise<Record<string, unknown>> {
  const matrix = await getMatrixCryptoModule();
  const machine = await requireMatrixMachine();
  const processedEvents = await machine.receiveSyncChanges(
    JSON.stringify([event]),
    new matrix.DeviceLists(),
    new Map<string, number>(),
  );

  const decrypted = processedEvents.find((processedEvent) =>
    isDecryptedToDeviceEvent(matrix, processedEvent),
  );
  if (!decrypted) {
    throw new Error("Unable to decrypt Matrix to-device event");
  }

  return JSON.parse(decrypted.rawEvent) as Record<string, unknown>;
}
