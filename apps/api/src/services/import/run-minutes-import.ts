#!/usr/bin/env npx tsx
/**
 * Municipal Minutes Import CLI
 *
 * Usage:
 *   npm run import:minutes                    # Import all municipalities
 *   npm run import:minutes -- --dry-run       # Test without writing to DB
 *   npm run import:minutes -- --municipality=Rautalampi
 *   npm run import:minutes -- --limit=3
 */

import "dotenv/config";
import { importMinutes, getAvailableMunicipalities } from "./minutes.js";

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const dryRun = args.includes("--dry-run");
  const listOnly = args.includes("--list");

  const municipalityArg = args.find((a) => a.startsWith("--municipality="));
  const municipalities = municipalityArg
    ? [municipalityArg.split("=")[1]]
    : undefined;

  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 5;

  if (listOnly) {
    console.log("Available municipalities:");
    for (const m of await getAvailableMunicipalities()) {
      console.log(`  - ${m}`);
    }
    return;
  }

  console.log("=".repeat(50));
  console.log("MUNICIPAL MINUTES IMPORT");
  console.log("=".repeat(50));
  console.log();

  const result = await importMinutes({
    municipalities,
    dryRun,
    limit,
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
      console.log(`  [${t.municipality}] ${t.title}`);
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
