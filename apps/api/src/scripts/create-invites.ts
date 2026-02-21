/**
 * Admin CLI for creating initial invite codes
 *
 * Usage:
 *   npm run create-invites           # Create 10 invite codes
 *   npm run create-invites -- 5      # Create 5 invite codes
 *   npm run create-invites -- 20     # Create 20 invite codes
 */

import { eq } from "drizzle-orm";
import { db, inviteCodes } from "../db/index.js";
import { randomBytes } from "crypto";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomPart = Array.from(randomBytes(6))
    .map((b) => chars[b % chars.length])
    .join("");
  return `EULESIA-${randomPart}`;
}

async function createInvites(count: number) {
  console.log(`\n🎟️  Creating ${count} admin invite codes...\n`);

  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    let code: string = "";
    let attempts = 0;

    // Generate unique code
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

    if (attempts >= 10 || !code) {
      console.error("Failed to generate unique code");
      continue;
    }

    // Create invite code (no createdBy = admin created)
    await db.insert(inviteCodes).values({
      code,
      createdBy: null, // Admin created
      status: "available",
    });

    codes.push(code);
    console.log(`  ✓ ${code}`);
  }

  console.log(`\n✅ Created ${codes.length} invite codes!\n`);
  console.log("Share these codes with your first users.");
  console.log(
    "Each user who registers will receive 5 invite codes of their own.\n",
  );

  // Print codes in a copyable format
  console.log("=".repeat(50));
  console.log("INVITE CODES:");
  console.log("=".repeat(50));
  codes.forEach((code) => console.log(code));
  console.log("=".repeat(50));
}

// Parse command line arguments
const count = parseInt(process.argv[2] || "10", 10);

if (isNaN(count) || count < 1 || count > 100) {
  console.error("Please provide a valid number between 1 and 100");
  process.exit(1);
}

createInvites(count)
  .catch(console.error)
  .finally(() => process.exit());
