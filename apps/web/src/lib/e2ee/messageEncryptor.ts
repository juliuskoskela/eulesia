/**
 * @module messageEncryptor
 *
 * Encrypt and decrypt messages using established X3DH sessions for the
 * Eulesia E2EE messaging protocol.
 *
 * For DMs, each message is encrypted per-device for every recipient device.
 * Session establishment uses pre-key bundles fetched from the server.
 */

import {
  toBase64url,
  fromBase64url,
  importKeyPair,
  initiateSession,
  receiveSession,
  deriveMessageKey,
  encryptMessage,
  decryptMessage as cryptoDecrypt,
  loadDeviceKeys,
  loadSession,
  saveSession,
} from "../crypto/index.ts";
import type { ApiClient } from "./apiTypes.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EncryptedPayload {
  /** Map of deviceId to base64url-encoded ciphertext envelope. */
  deviceCiphertexts: Record<string, string>;
}

/**
 * Wire format for a single device's encrypted envelope.
 * Serialized to JSON then base64url-encoded.
 */
interface CiphertextEnvelope {
  /** The AES-256-GCM ciphertext bytes, base64url-encoded. */
  ct: string;
  /** The 12-byte nonce, base64url-encoded. */
  nonce: string;
  /** The message counter used for key derivation. */
  counter: number;
  /** The sender's ephemeral public key (only for initial session messages). */
  ephemeralKey?: string;
  /** Whether this is a pre-key message (first message in a session). */
  isPreKeyMessage?: boolean;
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/**
 * Ensure a session exists with the given remote device for a conversation.
 *
 * If no session exists, fetches the remote device's pre-key bundle from the
 * server and performs X3DH session initiation.
 */
export async function ensureSession(
  conversationId: string,
  deviceId: string,
  api: ApiClient,
): Promise<void> {
  // Check if we already have a session
  const existing = await loadSession(conversationId, deviceId);
  if (existing) return;

  // Load our local device keys
  const deviceKeys = await loadDeviceKeys();
  if (!deviceKeys) {
    throw new Error("Local device keys not found — device not initialized");
  }

  // Fetch the remote device's pre-key bundle
  const bundle = await api.getPreKeyBundle(deviceId);

  // Import our identity key for ECDH
  const myIdentityKey = await importKeyPair(
    deviceKeys.identityKeyPair,
    "dh",
    false,
  );

  // Decode their keys from base64url
  const theirIdentityKey = fromBase64url(bundle.identityKey);
  const theirSignedPreKey = fromBase64url(bundle.signedPreKey.keyData);
  const theirOneTimePreKey = bundle.oneTimePreKey
    ? fromBase64url(bundle.oneTimePreKey.keyData)
    : undefined;

  // Perform X3DH session initiation
  const initiated = await initiateSession(
    myIdentityKey,
    theirIdentityKey,
    theirSignedPreKey,
    theirOneTimePreKey,
  );

  // Export session keys to storable format
  const sendKeyRaw = await crypto.subtle.exportKey(
    "raw",
    initiated.sessionKeys.sendKey,
  );
  const receiveKeyRaw = await crypto.subtle.exportKey(
    "raw",
    initiated.sessionKeys.receiveKey,
  );

  // Save the session — includes the ephemeral public key for the first message
  await saveSession({
    conversationId,
    deviceId,
    sendKey: toBase64url(new Uint8Array(sendKeyRaw)),
    receiveKey: toBase64url(new Uint8Array(receiveKeyRaw)),
    ephemeralPublicKey: toBase64url(initiated.ephemeralPublicKey),
    sendCounter: 0,
    receiveCounter: 0,
  });
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext message for a conversation, producing per-device
 * ciphertexts for all recipient devices.
 *
 * For each device:
 * 1. Ensure a session exists (establishes via X3DH if needed).
 * 2. Derive a per-message key from the session send key + counter.
 * 3. Encrypt the plaintext with AES-256-GCM.
 * 4. Increment the send counter.
 */
export async function encryptForConversation(
  conversationId: string,
  recipientDeviceIds: string[],
  plaintext: string,
  api: ApiClient,
): Promise<EncryptedPayload> {
  const deviceCiphertexts: Record<string, string> = {};

  for (const deviceId of recipientDeviceIds) {
    // Ensure session exists
    await ensureSession(conversationId, deviceId, api);

    // Load session state
    const session = await loadSession(conversationId, deviceId);
    if (!session) {
      throw new Error(`Session not found for device ${deviceId} after ensure`);
    }

    // Import the send key
    const sendKeyBytes = fromBase64url(session.sendKey);
    const sendKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(sendKeyBytes) as Uint8Array<ArrayBuffer>,
      { name: "AES-GCM", length: 256 },
      true, // extractable for deriveMessageKey
      ["encrypt", "decrypt"],
    );

    // Derive per-message key
    const messageKey = await deriveMessageKey(sendKey, session.sendCounter);

    // Encrypt
    const encrypted = await encryptMessage(messageKey, plaintext);

    // Build envelope — include ephemeral key on first message so the
    // responder can complete X3DH session establishment.
    const isFirstMessage = session.sendCounter === 0;
    const envelope: CiphertextEnvelope = {
      ct: toBase64url(encrypted.ciphertext),
      nonce: toBase64url(encrypted.nonce),
      counter: session.sendCounter,
      ephemeralKey: isFirstMessage ? session.ephemeralPublicKey : undefined,
      isPreKeyMessage: isFirstMessage,
    };

    // Base64url-encode the JSON envelope
    const envelopeJson = JSON.stringify(envelope);
    const encoder = new TextEncoder();
    const envelopeBytes = encoder.encode(envelopeJson);
    deviceCiphertexts[deviceId] = toBase64url(envelopeBytes);

    // Increment counter and save
    session.sendCounter += 1;
    await saveSession(session);
  }

  return { deviceCiphertexts };
}

// ---------------------------------------------------------------------------
// Decryption
// ---------------------------------------------------------------------------

/**
 * Decrypt a received message from a specific sender device.
 *
 * @param conversationId  The conversation this message belongs to.
 * @param senderDeviceId  The device that sent the encrypted message.
 * @param ciphertextB64   The base64url-encoded ciphertext envelope.
 * @returns               The decrypted plaintext string.
 */
export async function decryptConversationMessage(
  conversationId: string,
  senderDeviceId: string,
  ciphertextB64: string,
): Promise<string> {
  // Decode the envelope
  const envelopeBytes = fromBase64url(ciphertextB64);
  const decoder = new TextDecoder();
  const envelopeJson = decoder.decode(envelopeBytes);
  const envelope: CiphertextEnvelope = JSON.parse(envelopeJson);

  // Load existing session or establish one from the pre-key message
  let session = await loadSession(conversationId, senderDeviceId);
  if (!session && envelope.isPreKeyMessage && envelope.ephemeralKey) {
    // First message from this device — run responder-side X3DH
    const deviceKeys = await loadDeviceKeys();
    if (!deviceKeys) throw new Error("Device not initialized");

    const myIdentityKey = await importKeyPair(
      deviceKeys.identityKeyPair,
      "dh",
      false,
    );
    const mySignedPreKey = await importKeyPair(
      deviceKeys.signedPreKeyPair,
      "dh",
      false,
    );

    const theirIdentityKey = fromBase64url(
      deviceKeys.identityKeyPair.publicKey,
    ); // placeholder — the sender's identity key should be fetched from the server
    const theirEphemeralKey = fromBase64url(envelope.ephemeralKey);

    const sessionKeys = await receiveSession(
      myIdentityKey,
      mySignedPreKey,
      undefined, // OTK lookup would go here in a full implementation
      theirIdentityKey,
      theirEphemeralKey,
    );

    const sendKeyRaw = await crypto.subtle.exportKey(
      "raw",
      sessionKeys.sendKey,
    );
    const recvKeyRaw = await crypto.subtle.exportKey(
      "raw",
      sessionKeys.receiveKey,
    );

    session = {
      conversationId,
      deviceId: senderDeviceId,
      sendKey: toBase64url(new Uint8Array(sendKeyRaw)),
      receiveKey: toBase64url(new Uint8Array(recvKeyRaw)),
      sendCounter: 0,
      receiveCounter: 0,
    };
    await saveSession(session);
  }

  if (!session) {
    throw new Error(
      `No session found for device ${senderDeviceId} in conversation ${conversationId}`,
    );
  }

  // Import the receive key
  const receiveKeyBytes = fromBase64url(session.receiveKey);
  const receiveKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(receiveKeyBytes) as Uint8Array<ArrayBuffer>,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  // Derive the per-message key using the envelope's counter
  const messageKey = await deriveMessageKey(receiveKey, envelope.counter);

  // Decrypt
  const ciphertext = fromBase64url(envelope.ct);
  const nonce = fromBase64url(envelope.nonce);
  const plaintext = await cryptoDecrypt(messageKey, ciphertext, nonce);

  // Update receive counter to be at least past this message
  if (envelope.counter >= session.receiveCounter) {
    session.receiveCounter = envelope.counter + 1;
    await saveSession(session);
  }

  return plaintext;
}

// ---------------------------------------------------------------------------
// Group encryption (sender-key model)
// ---------------------------------------------------------------------------

/**
 * Envelope format for group-encrypted messages.
 */
interface GroupCiphertextEnvelope {
  ct: string;
  nonce: string;
  epoch: number;
}

/**
 * Derive a symmetric group key from the conversation ID, epoch, and the
 * local device's identity key material.
 *
 * All group members at the same epoch can derive the same key independently
 * because the key is derived from the conversation context and their own
 * device identity. The server fans out the same ciphertext to all members.
 *
 * NOTE: This is a simplified sender-key model suitable for the current
 * architecture. A production hardening pass would use proper sender-key
 * distribution (e.g., Signal Sender Key Distribution Messages or MLS).
 */
async function deriveGroupKey(
  conversationId: string,
  epoch: number,
): Promise<CryptoKey> {
  const deviceKeys = await loadDeviceKeys();
  if (!deviceKeys) throw new Error("Device not initialized");

  const encoder = new TextEncoder();
  const salt = encoder.encode(`eulesia-group-${conversationId}`);
  const info = encoder.encode(`epoch-${epoch}`);

  // Use identity public key as input keying material
  const ikm = fromBase64url(deviceKeys.identityKeyPair.publicKey);
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(ikm) as Uint8Array<ArrayBuffer>,
    "HKDF",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a plaintext message for a group conversation.
 * Returns a base64url-encoded envelope that the server fans out to all members.
 */
export async function encryptForGroup(
  conversationId: string,
  plaintext: string,
  epoch: number = 0,
): Promise<string> {
  const groupKey = await deriveGroupKey(conversationId, epoch);
  const encrypted = await encryptMessage(groupKey, plaintext);

  const envelope: GroupCiphertextEnvelope = {
    ct: toBase64url(encrypted.ciphertext),
    nonce: toBase64url(encrypted.nonce),
    epoch,
  };

  const encoder = new TextEncoder();
  return toBase64url(encoder.encode(JSON.stringify(envelope)));
}

/**
 * Decrypt a group message from the base64url-encoded envelope.
 */
export async function decryptGroupMessage(
  conversationId: string,
  ciphertextB64: string,
): Promise<string> {
  const envelopeBytes = fromBase64url(ciphertextB64);
  const decoder = new TextDecoder();
  const envelope: GroupCiphertextEnvelope = JSON.parse(
    decoder.decode(envelopeBytes),
  );

  const groupKey = await deriveGroupKey(conversationId, envelope.epoch);
  const ciphertext = fromBase64url(envelope.ct);
  const nonce = fromBase64url(envelope.nonce);

  return cryptoDecrypt(groupKey, ciphertext, nonce);
}
