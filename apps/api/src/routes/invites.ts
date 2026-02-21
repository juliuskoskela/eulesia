import { Router, type Response } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, inviteCodes, users, siteSettings } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../types/index.js";
import { randomBytes } from "crypto";

const router = Router();

// Generate a unique invite code
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoiding confusing chars like 0/O, 1/I
  const randomPart = Array.from(randomBytes(6))
    .map((b) => chars[b % chars.length])
    .join("");
  return `EULESIA-${randomPart}`;
}

// GET /invites - Get user's invite codes
router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    // Get user's created invite codes
    const codes = await db
      .select({
        id: inviteCodes.id,
        code: inviteCodes.code,
        status: inviteCodes.status,
        usedAt: inviteCodes.usedAt,
        createdAt: inviteCodes.createdAt,
        usedByName: users.name,
      })
      .from(inviteCodes)
      .leftJoin(users, eq(inviteCodes.usedBy, users.id))
      .where(eq(inviteCodes.createdBy, userId))
      .orderBy(desc(inviteCodes.createdAt));

    // Get remaining invite count
    const [user] = await db
      .select({ inviteCodesRemaining: users.inviteCodesRemaining })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    res.json({
      success: true,
      data: {
        codes: codes.map((c) => ({
          id: c.id,
          code: c.code,
          status: c.status,
          usedAt: c.usedAt,
          createdAt: c.createdAt,
          usedBy: c.usedByName ? { name: c.usedByName } : null,
        })),
        remaining: user?.inviteCodesRemaining ?? 0,
      },
    });
  }),
);

// POST /invites - Create a new invite code
router.post(
  "/",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    // Check if invites are enabled
    const [inviteSetting] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, "invites_enabled"))
      .limit(1);
    if (inviteSetting && inviteSetting.value === "false") {
      throw new AppError(403, "Invite creation is currently disabled");
    }

    // Check if user has remaining invites
    const [user] = await db
      .select({ inviteCodesRemaining: users.inviteCodesRemaining })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || (user.inviteCodesRemaining ?? 0) <= 0) {
      throw new AppError(400, "No invite codes remaining");
    }

    // Generate unique code
    let code: string;
    let attempts = 0;
    while (attempts < 10) {
      code = generateInviteCode();
      const [existing] = await db
        .select({ id: inviteCodes.id })
        .from(inviteCodes)
        .where(eq(inviteCodes.code, code))
        .limit(1);

      if (!existing) break;
      attempts++;
    }

    if (attempts >= 10) {
      throw new AppError(500, "Failed to generate unique invite code");
    }

    // Create invite code and decrement user's remaining count (atomic)
    const [newCode] = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(inviteCodes)
        .values({
          code: code!,
          createdBy: userId,
          status: "available",
        })
        .returning();

      await tx
        .update(users)
        .set({
          inviteCodesRemaining: sql`${users.inviteCodesRemaining} - 1`,
        })
        .where(eq(users.id, userId));

      return [created];
    });

    res.status(201).json({
      success: true,
      data: {
        id: newCode.id,
        code: newCode.code,
        status: newCode.status,
        createdAt: newCode.createdAt,
      },
    });
  }),
);

// GET /invites/validate/:code - Validate an invite code (public endpoint)
router.get(
  "/validate/:code",
  asyncHandler(async (req, res: Response) => {
    const { code } = req.params;

    const [inviteCode] = await db
      .select({
        id: inviteCodes.id,
        code: inviteCodes.code,
        status: inviteCodes.status,
        expiresAt: inviteCodes.expiresAt,
        creatorName: users.name,
      })
      .from(inviteCodes)
      .leftJoin(users, eq(inviteCodes.createdBy, users.id))
      .where(eq(inviteCodes.code, code.toUpperCase()))
      .limit(1);

    if (!inviteCode) {
      res.json({
        success: true,
        data: { valid: false, reason: "Code not found" },
      });
      return;
    }

    if (inviteCode.status !== "available") {
      res.json({
        success: true,
        data: { valid: false, reason: "Code already used" },
      });
      return;
    }

    if (inviteCode.expiresAt && new Date(inviteCode.expiresAt) < new Date()) {
      res.json({
        success: true,
        data: { valid: false, reason: "Code expired" },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        valid: true,
        invitedBy: inviteCode.creatorName || "Eulesia Admin",
      },
    });
  }),
);

// DELETE /invites/:id - Revoke an invite code
router.delete(
  "/:id",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    // Find the invite code
    const [inviteCode] = await db
      .select()
      .from(inviteCodes)
      .where(
        and(
          eq(inviteCodes.id, id),
          eq(inviteCodes.createdBy, userId),
          eq(inviteCodes.status, "available"),
        ),
      )
      .limit(1);

    if (!inviteCode) {
      throw new AppError(404, "Invite code not found or already used");
    }

    // Revoke the code and give back the invite
    await db
      .update(inviteCodes)
      .set({ status: "revoked" })
      .where(eq(inviteCodes.id, id));

    await db
      .update(users)
      .set({
        inviteCodesRemaining: sql`${users.inviteCodesRemaining} + 1`,
      })
      .where(eq(users.id, userId));

    res.json({ success: true });
  }),
);

// GET /invites/tree - Get user's invite tree (who they invited)
router.get(
  "/tree",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    // Get users invited by this user
    const invitedUsers = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.invitedBy, userId))
      .orderBy(desc(users.createdAt));

    res.json({
      success: true,
      data: invitedUsers,
    });
  }),
);

export default router;
