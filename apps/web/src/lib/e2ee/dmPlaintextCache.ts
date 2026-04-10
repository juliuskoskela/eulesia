// Session-scoped plaintext cache for sender-side readback of own DMs.
// Uses sessionStorage (not localStorage) so plaintext is never persisted
// beyond the current browser tab, avoiding cleartext-at-rest exposure.
const DM_PLAINTEXT_CACHE_PREFIX = "eulesia.dm-plaintext.v1";

type CachedPlaintextEntry = {
  content: string;
  deviceId: string;
  senderId: string;
};

function getStorageKey(messageId: string): string {
  return `${DM_PLAINTEXT_CACHE_PREFIX}:${messageId}`;
}

export function cacheSentDmPlaintext(data: {
  messageId: string;
  content: string;
  deviceId: string;
  senderId: string;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  const entry: CachedPlaintextEntry = {
    content: data.content,
    deviceId: data.deviceId,
    senderId: data.senderId,
  };
  window.sessionStorage.setItem(
    getStorageKey(data.messageId),
    JSON.stringify(entry),
  );
}

export function loadCachedDmPlaintext(data: {
  messageId: string;
  deviceId: string;
  senderId: string;
}): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(getStorageKey(data.messageId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedPlaintextEntry;
    if (
      parsed.deviceId !== data.deviceId ||
      parsed.senderId !== data.senderId ||
      typeof parsed.content !== "string"
    ) {
      return null;
    }

    return parsed.content;
  } catch {
    return null;
  }
}

/** Best-effort cleanup of any legacy localStorage entries from v1. */
export function clearLegacyDmPlaintextCache(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(DM_PLAINTEXT_CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
}
