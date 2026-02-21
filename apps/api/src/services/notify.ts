import { db, notifications } from "../db/index.js";
import { sendPushToUser } from "./pushNotifications.js";
import { sendFCMToUser } from "./fcmNotifications.js";
import type { Server } from "socket.io";

let ioInstance: Server | null = null;

export function setNotifyIO(io: Server) {
  ioInstance = io;
}

interface NotifyParams {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * Create a notification: DB insert + Socket.IO real-time + Web Push.
 * Use this instead of manually inserting into notifications table.
 */
export async function notify({
  userId,
  type,
  title,
  body,
  link,
}: NotifyParams): Promise<void> {
  // 1. Insert into DB
  await db.insert(notifications).values({
    userId,
    type,
    title,
    body: body || undefined,
    link: link || undefined,
  });

  // 2. Real-time via Socket.IO
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit("new_notification", {
      type,
      title,
      body,
      link,
    });
  }

  // 3. Web Push (async, fire-and-forget)
  sendPushToUser(userId, { title, body, link, type }).catch((err) => {
    console.error("Push notification failed for user", userId, err);
  });

  // 4. FCM native push (async, fire-and-forget)
  sendFCMToUser(userId, { title, body, link, type }).catch((err) => {
    console.error("FCM notification failed for user", userId, err);
  });
}
