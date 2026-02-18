import webpush from 'web-push'
import { eq } from 'drizzle-orm'
import { db, pushSubscriptions } from '../db/index.js'
import { env } from '../utils/env.js'

let vapidConfigured = false

export function initWebPush() {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT || 'mailto:admin@eulesia.eu',
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    )
    vapidConfigured = true
    console.log('Web Push (VAPID) configured')
  } else {
    console.log('Web Push disabled — no VAPID keys configured')
  }
}

export function isWebPushEnabled(): boolean {
  return vapidConfigured
}

export function getVapidPublicKey(): string | undefined {
  return env.VAPID_PUBLIC_KEY
}

interface PushPayload {
  title: string
  body?: string | null
  link?: string | null
  type: string
}

/**
 * Send push notifications to all of a user's subscribed devices.
 * Silently removes expired/invalid subscriptions (410 Gone).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!vapidConfigured) return

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))

  if (subs.length === 0) return

  const jsonPayload = JSON.stringify({
    title: payload.title,
    body: payload.body || '',
    url: payload.link || '/agora',
    type: payload.type
  })

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        },
        jsonPayload
      )
    )
  )

  // Clean up expired subscriptions (410 Gone or 404)
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'rejected') {
      const statusCode = (result.reason as any)?.statusCode
      if (statusCode === 410 || statusCode === 404) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, subs[i].id))
      }
    }
  }
}
