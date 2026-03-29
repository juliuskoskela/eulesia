/**
 * Health Monitor
 *
 * Tracks success/failure rates for adaptive scraper configs.
 * Triggers self-healing when consecutive failures exceed threshold.
 */

import {
  scraperDb,
  scraperConfigs,
  healthEvents,
} from "../../../db/scraper-db.js";
import { eq, and, lt, sql } from "drizzle-orm";

const FAILURE_THRESHOLD = 5; // Consecutive failures before triggering self-heal
const MAX_HEAL_ATTEMPTS = 3; // Max times to attempt self-healing before disabling

// ============================================
// Health Recording
// ============================================

export async function recordSuccess(configId: string): Promise<void> {
  await scraperDb
    .update(scraperConfigs)
    .set({
      lastSuccessAt: new Date(),
      consecutiveFailures: 0,
      totalSuccesses: sql`${scraperConfigs.totalSuccesses} + 1`,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(scraperConfigs.id, configId));

  await scraperDb.insert(healthEvents).values({
    configId,
    eventType: "success",
  });
}

export async function recordFailure(
  configId: string,
  error: string,
): Promise<void> {
  const [updated] = await scraperDb
    .update(scraperConfigs)
    .set({
      lastFailureAt: new Date(),
      consecutiveFailures: sql`${scraperConfigs.consecutiveFailures} + 1`,
      totalFailures: sql`${scraperConfigs.totalFailures} + 1`,
      lastError: error.slice(0, 5000), // Truncate long errors
      updatedAt: new Date(),
    })
    .where(eq(scraperConfigs.id, configId))
    .returning({
      consecutiveFailures: scraperConfigs.consecutiveFailures,
      healAttempts: scraperConfigs.healAttempts,
    });

  await scraperDb.insert(healthEvents).values({
    configId,
    eventType: "failure",
    details: error.slice(0, 1000),
  });

  // Check if self-healing should be triggered
  if (updated && updated.consecutiveFailures >= FAILURE_THRESHOLD) {
    if (updated.healAttempts < MAX_HEAL_ATTEMPTS) {
      await scraperDb
        .update(scraperConfigs)
        .set({ status: "failing" })
        .where(eq(scraperConfigs.id, configId));

      console.log(
        `   [health] Config ${configId} marked as failing (${updated.consecutiveFailures} consecutive failures)`,
      );
    } else {
      await scraperDb
        .update(scraperConfigs)
        .set({ status: "disabled" })
        .where(eq(scraperConfigs.id, configId));

      await scraperDb.insert(healthEvents).values({
        configId,
        eventType: "disabled",
        details: `Disabled after ${MAX_HEAL_ATTEMPTS} heal attempts`,
      });

      console.log(
        `   [health] Config ${configId} disabled after ${MAX_HEAL_ATTEMPTS} heal attempts`,
      );
    }
  }
}

export async function recordHealed(configId: string): Promise<void> {
  await scraperDb
    .update(scraperConfigs)
    .set({
      status: "active",
      consecutiveFailures: 0,
      lastHealedAt: new Date(),
      healAttempts: sql`${scraperConfigs.healAttempts} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(scraperConfigs.id, configId));

  await scraperDb.insert(healthEvents).values({
    configId,
    eventType: "healed",
  });
}

// ============================================
// Health Queries
// ============================================

export async function getFailingConfigs() {
  return scraperDb
    .select()
    .from(scraperConfigs)
    .where(
      and(
        eq(scraperConfigs.status, "failing"),
        lt(scraperConfigs.healAttempts, MAX_HEAL_ATTEMPTS),
      ),
    );
}

export async function getHealthSummary(): Promise<{
  active: number;
  pending: number;
  failing: number;
  disabled: number;
  total: number;
  byCountry: Record<
    string,
    { active: number; failing: number; disabled: number }
  >;
}> {
  const all = await scraperDb
    .select({
      status: scraperConfigs.status,
      country: scraperConfigs.country,
    })
    .from(scraperConfigs);

  const summary = {
    active: 0,
    pending: 0,
    failing: 0,
    disabled: 0,
    total: all.length,
    byCountry: {} as Record<
      string,
      { active: number; failing: number; disabled: number }
    >,
  };

  for (const row of all) {
    const status = row.status as keyof typeof summary;
    if (status in summary && typeof summary[status] === "number") {
      (summary[status] as number)++;
    }

    if (!summary.byCountry[row.country]) {
      summary.byCountry[row.country] = { active: 0, failing: 0, disabled: 0 };
    }
    const cs = row.status as "active" | "failing" | "disabled";
    if (cs in summary.byCountry[row.country]) {
      summary.byCountry[row.country][cs]++;
    }
  }

  return summary;
}

export async function logHealthReport(): Promise<void> {
  const summary = await getHealthSummary();
  console.log(`\n📊 Scraper Health Report:`);
  console.log(
    `   Total: ${summary.total} | Active: ${summary.active} | Pending: ${summary.pending} | Failing: ${summary.failing} | Disabled: ${summary.disabled}`,
  );

  for (const [country, stats] of Object.entries(summary.byCountry)) {
    console.log(
      `   ${country}: active=${stats.active} failing=${stats.failing} disabled=${stats.disabled}`,
    );
  }
}
