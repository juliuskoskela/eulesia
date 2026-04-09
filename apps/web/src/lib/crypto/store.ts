/**
 * @module store
 *
 * IndexedDB-backed key storage for the Eulesia E2EE messaging protocol.
 *
 * browser's native IndexedDB. This module persists the serialised values it is given
 * and does not itself provide encryption at rest. If callers pass exported
 * private keys or other secret key material as base64url strings, that data is
 * stored in IndexedDB in that form. Callers that require at-rest protection
 * must encrypt or wrap sensitive key material before writing it via this
 * module.
 *
 * Uses only the native IndexedDB API with no third-party wrappers.
 */

import type { ExportedKeyPair } from "./keys.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** IndexedDB database name. */
const DB_NAME = "eulesia-e2ee-keystore";

/** Current schema version. Bump when adding/modifying object stores. */
const DB_VERSION = 3;

/** Object store names. */
const STORE_DEVICE_KEYS = "deviceKeys";
const STORE_SESSIONS = "sessions";
const STORE_SENDER_KEYS = "senderKeys";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Device-scoped long-term and pre-key material. */
export interface DeviceKeys {
  /** Unique identifier for this device (UUID). */
  deviceId: string;
  /** Long-term identity key pair (ECDH, X25519 or P-256). */
  identityKeyPair: ExportedKeyPair;
  /** Signing key pair (Ed25519 or ECDSA) used to sign pre-keys. */
  signingKeyPair: ExportedKeyPair;
  /** Current signed pre-key pair. */
  signedPreKeyPair: ExportedKeyPair;
  /** Monotonically increasing ID for the signed pre-key. */
  signedPreKeyId: number;
  /** Pool of unused one-time pre-keys. */
  oneTimePreKeys: OneTimePreKeyEntry[];
}

/** A single one-time pre-key with its ID. */
export interface OneTimePreKeyEntry {
  keyId: number;
  keyPair: ExportedKeyPair;
}

/** Per-conversation, per-remote-device session state. */
export interface SessionState {
  /** The conversation (thread/DM) this session belongs to. */
  conversationId: string;
  /** The remote device that shares this session. */
  deviceId: string;
  /** Base64url-encoded AES-256-GCM send key. */
  sendKey: string;
  /** Base64url-encoded AES-256-GCM receive key. */
  receiveKey: string;
  /** Base64url-encoded ephemeral public key (initiator only, for first message). */
  ephemeralPublicKey?: string;
  /** Key ID of the consumed one-time pre-key (initiator only, for first message). */
  usedOneTimePreKeyId?: number;
  /** Next send-side message counter. */
  sendCounter: number;
  /** Next receive-side message counter. */
  receiveCounter: number;
}

// ---------------------------------------------------------------------------
// Database lifecycle
// ---------------------------------------------------------------------------

/**
 * Open (or create) the IndexedDB key store.
 *
 * On first use the object stores are created. On subsequent calls the
 * existing database is opened.
 */
export async function openKeyStore(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // Device keys — single record keyed by deviceId
      if (!db.objectStoreNames.contains(STORE_DEVICE_KEYS)) {
        db.createObjectStore(STORE_DEVICE_KEYS, { keyPath: "deviceId" });
      }

      // Sessions — compound key [conversationId, deviceId]
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, {
          keyPath: ["conversationId", "deviceId"],
        });
      }

      // Sender keys — compound key [conversationId, userId, epoch]
      if (db.objectStoreNames.contains(STORE_SENDER_KEYS)) {
        db.deleteObjectStore(STORE_SENDER_KEYS);
      }
      db.createObjectStore(STORE_SENDER_KEYS, {
        keyPath: ["conversationId", "userId", "epoch"],
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run a single IndexedDB transaction that writes or reads a value.
 * Wraps the callback-based API in a Promise.
 */
function tx<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const req = operation(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

// ---------------------------------------------------------------------------
// Device keys
// ---------------------------------------------------------------------------

/**
 * Persist device key material to IndexedDB.
 *
 * Clears any stale device key records first so that exactly one record
 * exists after the write. This prevents `loadDeviceKeys` from
 * non-deterministically picking an arbitrary device when multiple
 * records have accumulated.
 */
export async function saveDeviceKeys(keys: DeviceKeys): Promise<void> {
  const db = await openKeyStore();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_DEVICE_KEYS, "readwrite");
      const store = transaction.objectStore(STORE_DEVICE_KEYS);
      store.clear();
      store.put(keys);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Load device key material from IndexedDB.
 *
 * Returns the first (and typically only) device key record, or `null` if
 * none exists.
 */
export async function loadDeviceKeys(): Promise<DeviceKeys | null> {
  const db = await openKeyStore();
  try {
    const result = await tx(
      db,
      STORE_DEVICE_KEYS,
      "readonly",
      (store) => store.getAll() as IDBRequest<DeviceKeys[]>,
    );
    return result.length > 0 ? result[0]! : null;
  } finally {
    db.close();
  }
}

/**
 * Load device key material for a specific device ID.
 */
export async function loadDeviceKeysById(
  deviceId: string,
): Promise<DeviceKeys | null> {
  const db = await openKeyStore();
  try {
    const result = await tx(
      db,
      STORE_DEVICE_KEYS,
      "readonly",
      (store) => store.get(deviceId) as IDBRequest<DeviceKeys | undefined>,
    );
    return result ?? null;
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Persist session state for a specific conversation and remote device.
 *
 * Overwrites any existing session with the same compound key.
 */
export async function saveSession(session: SessionState): Promise<void> {
  const db = await openKeyStore();
  try {
    await tx(db, STORE_SESSIONS, "readwrite", (store) => store.put(session));
  } finally {
    db.close();
  }
}

/**
 * Load session state for a specific conversation and remote device.
 *
 * @returns The session record, or `null` if no session exists yet.
 */
export async function loadSession(
  conversationId: string,
  deviceId: string,
): Promise<SessionState | null> {
  const db = await openKeyStore();
  try {
    const result = await tx(
      db,
      STORE_SESSIONS,
      "readonly",
      (store) =>
        store.get([conversationId, deviceId]) as IDBRequest<
          SessionState | undefined
        >,
    );
    return result ?? null;
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Sender Keys
// ---------------------------------------------------------------------------

/**
 * Sender key state for a group member. Stored per [conversationId, userId, epoch].
 * Each member has one sender key per epoch.
 */
export interface SenderKeyState {
  conversationId: string;
  userId: string;
  /** HMAC-SHA256 chain key — base64url-encoded 32 bytes. */
  chainKey: string;
  /** Epoch when this sender key was created. */
  epoch: number;
  /** Monotonic message counter (ratchets forward on each send/receive). */
  messageIndex: number;
}

/**
 * Save (or overwrite) a sender key for a specific group member.
 */
export async function saveSenderKey(state: SenderKeyState): Promise<void> {
  const db = await openKeyStore();
  try {
    await tx(db, STORE_SENDER_KEYS, "readwrite", (store) => store.put(state));
  } finally {
    db.close();
  }
}

/**
 * Load a sender key for a specific group member and epoch.
 */
export async function loadSenderKey(
  conversationId: string,
  userId: string,
  epoch: number,
): Promise<SenderKeyState | null> {
  const db = await openKeyStore();
  try {
    const result = await tx(
      db,
      STORE_SENDER_KEYS,
      "readonly",
      (store) =>
        store.get([conversationId, userId, epoch]) as IDBRequest<
          SenderKeyState | undefined
        >,
    );
    return result ?? null;
  } finally {
    db.close();
  }
}

/**
 * Delete all sender keys for a conversation (used on epoch rotation).
 */
export async function clearSenderKeysForConversation(
  conversationId: string,
): Promise<void> {
  const db = await openKeyStore();
  try {
    const transaction = db.transaction(STORE_SENDER_KEYS, "readwrite");
    const store = transaction.objectStore(STORE_SENDER_KEYS);
    const request = store.openCursor();
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const value = cursor.value as SenderKeyState;
          if (value.conversationId === conversationId) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Delete the entire key store database.
 *
 * This is a destructive operation intended for logout / account deletion.
 * All device keys and session state will be permanently lost.
 */
export async function clearKeyStore(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
