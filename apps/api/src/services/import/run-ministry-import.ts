#!/usr/bin/env npx tsx
/**
 * Ministry Content Import CLI
 *
 * Usage:
 *   npm run import:ministry                          # Import VN decisions + RSS
 *   npm run import:ministry -- --dry-run             # Test without writing to DB
 *   npm run import:ministry -- --limit=3             # Check last 3 sessions
 *   npm run import:ministry -- --skip-rss            # Only VN decisions
 *   npm run import:ministry -- --skip-vn             # Only RSS feeds
 *   npm run import:ministry -- --clean               # Remove old threads
 *   npm run import:ministry -- --clean --dry-run
 *   npm run import:ministry -- --clean --cutoff=2025-06-01
 */

import "dotenv/config";
import { importMinistryContent, cleanOldMinistryThreads } from "./ministry.js";

async function main() {
  const args = process.argv.slice(2);

  const dryRun = args.includes("--dry-run");
  const clean = args.includes("--clean");
  const skipRss = args.includes("--skip-rss");
  const skipVn = args.includes("--skip-vn");

  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 5;

  const cutoffArg = args.find((a) => a.startsWith("--cutoff="));
  const cutoffDate = cutoffArg ? new Date(cutoffArg.split("=")[1]) : undefined;

  if (clean) {
    console.log("=".repeat(50));
    console.log("MINISTRY THREAD CLEANUP");
    console.log("=".repeat(50));
    console.log();

    const deleted = await cleanOldMinistryThreads({ dryRun, cutoffDate });

    console.log();
    console.log(
      `Total: ${deleted} threads ${dryRun ? "would be" : ""} removed`,
    );
    return;
  }

  console.log("=".repeat(50));
  console.log("MINISTRY CONTENT IMPORT");
  console.log("=".repeat(50));
  console.log();

  const result = await importMinistryContent({
    dryRun,
    limit,
    skipRss,
    skipVn,
  });

  console.log();
  console.log("=".repeat(50));
  console.log("SUMMARY");
  console.log("=".repeat(50));
  console.log(`Imported: ${result.imported}`);
  console.log(`Skipped:  ${result.skipped}`);
  console.log(`Errors:   ${result.errors.length}`);

  if (result.threads.length > 0) {
    console.log();
    console.log("Created threads:");
    for (const t of result.threads) {
      console.log(`  [${t.source}] ${t.title}`);
    }
  }

  if (result.errors.length > 0) {
    console.log();
    console.log("Errors:");
    for (const e of result.errors) {
      console.log(`  - ${e}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
