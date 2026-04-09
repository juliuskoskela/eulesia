const MATRIX_SERVER_NAME = "eulesia.invalid";

function normalizeOpaqueId(id: string): string {
  return id.trim().toLowerCase();
}

export function toMatrixUserId(userId: string): string {
  return `@${normalizeOpaqueId(userId)}:${MATRIX_SERVER_NAME}`;
}

export function toMatrixDeviceId(deviceId: string): string {
  return normalizeOpaqueId(deviceId).replace(/-/g, "").toUpperCase();
}

export function toMatrixRoomId(conversationId: string): string {
  return `!${normalizeOpaqueId(conversationId)}:${MATRIX_SERVER_NAME}`;
}

export function getMatrixStoreName(userId: string, deviceId: string): string {
  return `eulesia-matrix-crypto:${normalizeOpaqueId(userId)}:${normalizeOpaqueId(deviceId)}`;
}
