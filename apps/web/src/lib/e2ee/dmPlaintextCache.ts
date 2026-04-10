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
  window.localStorage.setItem(
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

  const raw = window.localStorage.getItem(getStorageKey(data.messageId));
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
