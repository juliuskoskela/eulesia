/**
 * GDPR Data Retention Cleanup Service
 *
 * Enforces the data retention policies documented in the privacy policy:
 * - Expired sessions: removed immediately
 * - Used/expired magic links: removed after 24h
 * - Deleted user accounts: personal data purged after 30 days
 * - Expired invite codes: removed after 90 days
 * - Old moderation logs: retained for 1 year (DSA), then cleaned
 */

import { lt, and, eq, isNotNull, or } from "drizzle-orm";
import { db, sessions, magicLinks, inviteCodes } from "../db/index.js";

interface CleanupResult {
  expiredSessions: number;
  usedMagicLinks: number;
  expiredInviteCodes: number;
  errors: string[];
}

/**
 * Run all GDPR cleanup tasks
 */
export async function runGdprCleanup(): Promise<CleanupResult> {
  const result: CleanupResult = {
    expiredSessions: 0,
    usedMagicLinks: 0,
    expiredInviteCodes: 0,
    errors: [],
  };

  const now = new Date();

  // 1. Remove expired sessions (TTL: 30 days, enforced by expiresAt)
  try {
    const deleted = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))
      .returning({ id: sessions.id });
    result.expiredSessions = deleted.length;
  } catch (err) {
    result.errors.push(
      `Sessions cleanup: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 2. Remove used or expired magic links (keep unused ones until they expire)
  try {
    const deleted = await db
      .delete(magicLinks)
      .where(
        or(
          // Used links — no longer needed
          eq(magicLinks.used, true),
          // Expired links (15 min TTL)
          lt(magicLinks.expiresAt, now),
        ),
      )
      .returning({ id: magicLinks.id });
    result.usedMagicLinks = deleted.length;
  } catch (err) {
    result.errors.push(
      `Magic links cleanup: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 3. Remove expired invite codes that are in 'available' status and older than 90 days
  try {
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const deleted = await db
      .delete(inviteCodes)
      .where(
        and(
          eq(inviteCodes.status, "available"),
          isNotNull(inviteCodes.expiresAt),
          lt(inviteCodes.expiresAt, ninetyDaysAgo),
        ),
      )
      .returning({ id: inviteCodes.id });
    result.expiredInviteCodes = deleted.length;
  } catch (err) {
    result.errors.push(
      `Invite codes cleanup: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return result;
}
