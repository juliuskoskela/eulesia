import { Router, type Response } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, users, institutionManagers } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../types/index.js";

const router = Router();

// Finnish business ID (y-tunnus) validation: 1234567-8
function validateFinnishBusinessId(id: string): boolean {
  const match = id.match(/^(\d{7})-(\d)$/);
  if (!match) return false;
  const digits = match[1];
  const checkDigit = parseInt(match[2]);
  const weights = [7, 9, 10, 5, 8, 4, 2];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += parseInt(digits[i]) * weights[i];
  }
  const remainder = sum % 11;
  if (remainder === 1) return false; // Invalid
  const expected = remainder === 0 ? 0 : 11 - remainder;
  return checkDigit === expected;
}

function validateBusinessId(id: string, country: string): boolean {
  switch (country) {
    case "FI":
      return validateFinnishBusinessId(id);
    // Other countries: basic format validation
    case "SE":
      return /^\d{6}-\d{4}$/.test(id); // Swedish org.nr
    case "EE":
      return /^\d{8}$/.test(id); // Estonian registry code
    case "DE":
      return /^(DE)?\d{9}$/.test(id); // German USt-IdNr
    default:
      return id.length >= 5 && id.length <= 30;
  }
}

// POST /institutions/create — Create a new organization account
router.post(
  "/create",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const data = z
      .object({
        name: z.string().min(2).max(255),
        institutionName: z.string().min(2).max(255),
        businessId: z.string().min(5).max(50).optional(),
        businessIdCountry: z.string().length(2).optional(),
        websiteUrl: z.string().url().max(500).optional().or(z.literal("")),
        description: z.string().max(2000).optional(),
        institutionType: z
          .enum(["organization", "agency"])
          .default("organization"),
      })
      .parse(req.body);

    // Validate business ID if provided
    if (data.businessId && data.businessIdCountry) {
      if (!validateBusinessId(data.businessId, data.businessIdCountry)) {
        res
          .status(400)
          .json({ success: false, error: "Invalid business ID format" });
        return;
      }

      // Check if business ID is already in use
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.businessId, data.businessId))
        .limit(1);

      if (existing) {
        res
          .status(400)
          .json({ success: false, error: "Business ID is already registered" });
        return;
      }
    }

    // Generate a unique username for the organization
    const baseUsername = data.name
      .toLowerCase()
      .replace(/[^a-z0-9äöåüß]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 40);
    let orgUsername = baseUsername;
    let attempt = 0;
    while (true) {
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, orgUsername))
        .limit(1);
      if (!existingUser) break;
      attempt++;
      orgUsername = `${baseUsername}-${attempt}`;
    }

    // Create the institution user account
    const [orgAccount] = await db
      .insert(users)
      .values({
        email: null,
        username: orgUsername,
        name: data.name,
        role: "institution",
        institutionType: data.institutionType,
        institutionName: data.institutionName,
        businessId: data.businessId || null,
        businessIdCountry: data.businessIdCountry || null,
        websiteUrl: data.websiteUrl || null,
        description: data.description || null,
        identityProvider: "managed",
        identityVerified: false, // Will be verified by admin
      })
      .returning();

    // Create manager link — creator becomes owner, auto-approved
    await db.insert(institutionManagers).values({
      institutionId: orgAccount.id,
      userId,
      role: "owner",
      status: "approved",
      approvedAt: new Date(),
      approvedBy: userId, // Self-approved for owner creation
    });

    res.status(201).json({
      success: true,
      data: {
        id: orgAccount.id,
        name: orgAccount.name,
        username: orgAccount.username,
        institutionType: orgAccount.institutionType,
        institutionName: orgAccount.institutionName,
        businessId: orgAccount.businessId,
      },
    });
  }),
);

// GET /institutions/my — List institutions I manage
router.get(
  "/my",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const managers = await db
      .select({
        id: institutionManagers.id,
        role: institutionManagers.role,
        status: institutionManagers.status,
        createdAt: institutionManagers.createdAt,
        approvedAt: institutionManagers.approvedAt,
        institution: {
          id: users.id,
          name: users.name,
          username: users.username,
          institutionType: users.institutionType,
          institutionName: users.institutionName,
          avatarUrl: users.avatarUrl,
          municipalityId: users.municipalityId,
        },
      })
      .from(institutionManagers)
      .innerJoin(users, eq(institutionManagers.institutionId, users.id))
      .where(eq(institutionManagers.userId, userId));

    res.json({ success: true, data: managers });
  }),
);

// GET /institutions/available — List claimable municipality institutions (bot-created, not yet managed)
router.get(
  "/available",
  authMiddleware,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    // Find institution accounts created by bot that have no approved manager
    const availableInstitutions = await db
      .select({
        id: users.id,
        name: users.name,
        institutionType: users.institutionType,
        institutionName: users.institutionName,
        municipalityId: users.municipalityId,
        identityProvider: users.identityProvider,
      })
      .from(users)
      .where(
        and(
          eq(users.role, "institution"),
          eq(users.identityProvider, "eulesia-bot"),
        ),
      )
      .limit(100);

    res.json({ success: true, data: availableInstitutions });
  }),
);

// POST /institutions/:institutionId/claim — Request to manage an institution
router.post(
  "/:institutionId/claim",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { institutionId } = req.params;
    const { role } = z
      .object({
        role: z.enum(["owner", "editor"]).default("owner"),
      })
      .parse(req.body || {});

    // Verify institution exists and is an institution account
    const [institution] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(eq(users.id, institutionId), eq(users.role, "institution")))
      .limit(1);

    if (!institution) {
      res.status(404).json({ success: false, error: "Institution not found" });
      return;
    }

    // Check if user already has a claim
    const [existing] = await db
      .select({
        id: institutionManagers.id,
        status: institutionManagers.status,
      })
      .from(institutionManagers)
      .where(
        and(
          eq(institutionManagers.institutionId, institutionId),
          eq(institutionManagers.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      res
        .status(400)
        .json({
          success: false,
          error: "You already have a claim for this institution",
        });
      return;
    }

    // Create claim (pending admin approval)
    const [claim] = await db
      .insert(institutionManagers)
      .values({
        institutionId,
        userId,
        role,
        status: "pending",
      })
      .returning();

    res.status(201).json({ success: true, data: claim });
  }),
);

// POST /institutions/:institutionId/post — Post as institution
// This endpoint allows a manager to create a thread as the institution
router.get(
  "/:institutionId/check",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { institutionId } = req.params;

    // Check if user can post as this institution
    const [manager] = await db
      .select({ id: institutionManagers.id, role: institutionManagers.role })
      .from(institutionManagers)
      .where(
        and(
          eq(institutionManagers.institutionId, institutionId),
          eq(institutionManagers.userId, userId),
          eq(institutionManagers.status, "approved"),
        ),
      )
      .limit(1);

    res.json({
      success: true,
      data: { canManage: !!manager, role: manager?.role || null },
    });
  }),
);

// Admin: GET /institutions/claims — List pending claims
router.get(
  "/claims",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== "admin") {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }

    const claims = await db
      .select({
        id: institutionManagers.id,
        role: institutionManagers.role,
        status: institutionManagers.status,
        createdAt: institutionManagers.createdAt,
        institution: {
          id: users.id,
          name: users.name,
          institutionName: users.institutionName,
          institutionType: users.institutionType,
        },
      })
      .from(institutionManagers)
      .innerJoin(users, eq(institutionManagers.institutionId, users.id))
      .where(eq(institutionManagers.status, "pending"));

    // Get user info separately to avoid join ambiguity
    const claimsWithUsers = await Promise.all(
      claims.map(async (claim) => {
        const [claimRow] = await db
          .select({ userId: institutionManagers.userId })
          .from(institutionManagers)
          .where(eq(institutionManagers.id, claim.id))
          .limit(1);

        const [claimUser] = await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, claimRow.userId))
          .limit(1);

        return { ...claim, user: claimUser };
      }),
    );

    res.json({ success: true, data: claimsWithUsers });
  }),
);

// Admin: PATCH /institutions/claims/:claimId — Approve or reject a claim
router.patch(
  "/claims/:claimId",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== "admin") {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }

    const { claimId } = req.params;
    const { status } = z
      .object({
        status: z.enum(["approved", "rejected"]),
      })
      .parse(req.body);

    const [claim] = await db
      .select()
      .from(institutionManagers)
      .where(eq(institutionManagers.id, claimId))
      .limit(1);

    if (!claim) {
      res.status(404).json({ success: false, error: "Claim not found" });
      return;
    }

    if (claim.status !== "pending") {
      res
        .status(400)
        .json({ success: false, error: "Claim has already been processed" });
      return;
    }

    await db
      .update(institutionManagers)
      .set({
        status,
        approvedAt: status === "approved" ? new Date() : null,
        approvedBy: status === "approved" ? req.user!.id : null,
      })
      .where(eq(institutionManagers.id, claimId));

    // If approved and institution was bot-created, update identity provider
    if (status === "approved") {
      const [inst] = await db
        .select({ identityProvider: users.identityProvider })
        .from(users)
        .where(eq(users.id, claim.institutionId))
        .limit(1);

      if (inst?.identityProvider === "eulesia-bot") {
        await db
          .update(users)
          .set({ identityProvider: "managed", identityVerified: true })
          .where(eq(users.id, claim.institutionId));
      }
    }

    res.json({ success: true, data: { status } });
  }),
);

export default router;
