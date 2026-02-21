import admin from "firebase-admin";
import { eq } from "drizzle-orm";
import { db, deviceTokens } from "../db/index.js";
import { env } from "../utils/env.js";

let fcmInitialized = false;

export function initFCM() {
  const keyConfig = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!keyConfig) {
    console.log("FCM disabled — no FIREBASE_SERVICE_ACCOUNT_KEY configured");
    return;
  }

  try {
    const credential = keyConfig.startsWith("{")
      ? admin.credential.cert(JSON.parse(keyConfig))
      : admin.credential.cert(keyConfig);

    admin.initializeApp({ credential });
    fcmInitialized = true;
    console.log("Firebase Cloud Messaging configured");
  } catch (err) {
    console.error("Failed to initialize FCM:", err);
  }
}

export function isFCMEnabled(): boolean {
  return fcmInitialized;
}

interface FCMPayload {
  title: string;
  body?: string | null;
  link?: string | null;
  type: string;
}

/**
 * Send FCM push notifications to all of a user's registered devices.
 * Removes tokens that are no longer valid.
 */
export async function sendFCMToUser(
  userId: string,
  payload: FCMPayload,
): Promise<void> {
  if (!fcmInitialized) return;

  const tokens = await db
    .select()
    .from(deviceTokens)
    .where(eq(deviceTokens.userId, userId));

  if (tokens.length === 0) return;

  const message = {
    notification: {
      title: payload.title,
      body: payload.body || "",
    },
    data: {
      type: payload.type,
      link: payload.link || "/agora",
      title: payload.title,
      body: payload.body || "",
    },
    android: {
      priority: "high" as const,
      notification: {
        channelId: "default",
        clickAction: "FCM_PLUGIN_ACTIVITY",
      },
    },
    apns: {
      payload: {
        aps: {
          badge: 1,
          sound: "default",
          "content-available": 1,
        },
      },
    },
  };

  const results = await Promise.allSettled(
    tokens.map((t) =>
      admin.messaging().send({
        ...message,
        token: t.token,
      }),
    ),
  );

  // Clean up invalid tokens
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const errorCode = (result.reason as any)?.code;
      if (
        errorCode === "messaging/registration-token-not-registered" ||
        errorCode === "messaging/invalid-registration-token"
      ) {
        await db.delete(deviceTokens).where(eq(deviceTokens.id, tokens[i].id));
      }
    }
  }
}
