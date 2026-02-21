#!/usr/bin/env node
/**
 * Place Import CLI
 *
 * Usage:
 *   npm run import:places                     # Full import for Finland
 *   npm run import:places -- --source=osm    # OSM only
 *   npm run import:places -- --source=lipas  # Lipas only
 *   npm run import:places -- --country=SE    # Import for Sweden
 *   npm run import:places -- --dry-run       # Preview without saving
 *   npm run import:places -- --help          # Show help
 */

import {
  importFromOSM,
  getAvailableCategories,
  getSupportedCountries,
} from "../services/import/osm.js";
import {
  importFromLipas,
  getAvailableTypeCodes,
} from "../services/import/lipas.js";
import { importAll } from "../services/import/index.js";

function printHelp() {
  console.log(`
🗺️  Eulesia Place Import CLI

USAGE:
  npm run import:places [options]

OPTIONS:
  --source=<source>     Import from specific source: osm, lipas, all (default: all)
  --country=<code>      Country code: FI, SE, NO, DK, EE, LV, LT (default: FI)
  --dry-run             Preview import without saving to database
  --help                Show this help message

EXAMPLES:
  npm run import:places                        # Full import for Finland
  npm run import:places -- --source=osm       # OSM only
  npm run import:places -- --country=SE       # Sweden import
  npm run import:places -- --dry-run          # Dry run

SUPPORTED COUNTRIES:
  ${getSupportedCountries().join(", ")}

OSM CATEGORIES:
  ${getAvailableCategories().slice(0, 10).join(", ")}...
  (${getAvailableCategories().length} total)

LIPAS TYPE CODES (Finland only):
  ${getAvailableTypeCodes()
    .slice(0, 5)
    .map((t: { code: number; name: string }) => `${t.code}: ${t.name}`)
    .join(", ")}...
  (${getAvailableTypeCodes().length} total)
`);
}

function parseArgs(args: string[]): {
  source: "osm" | "lipas" | "all";
  country: string;
  dryRun: boolean;
  help: boolean;
} {
  const result = {
    source: "all" as "osm" | "lipas" | "all",
    country: "FI",
    dryRun: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg.startsWith("--source=")) {
      const source = arg.split("=")[1];
      if (source === "osm" || source === "lipas" || source === "all") {
        result.source = source;
      }
    } else if (arg.startsWith("--country=")) {
      result.country = arg.split("=")[1].toUpperCase();
    }
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log(`
╔════════════════════════════════════════════════════╗
║           EULESIA PLACE IMPORT                     ║
╚════════════════════════════════════════════════════╝
`);

  console.log(`Configuration:`);
  console.log(`  Source: ${args.source}`);
  console.log(`  Country: ${args.country}`);
  console.log(`  Dry run: ${args.dryRun}`);
  console.log("");

  const startTime = Date.now();

  try {
    if (args.source === "all") {
      await importAll(args.country, args.dryRun);
    } else if (args.source === "osm") {
      await importFromOSM({
        country: args.country,
        dryRun: args.dryRun,
      });
    } else if (args.source === "lipas") {
      if (args.country !== "FI") {
        console.log("⚠️  Lipas is only available for Finland (FI)");
        process.exit(1);
      }
      const result = await importFromLipas({
        dryRun: args.dryRun,
      });
      if (result.errors.length > 0) {
        console.log("\nErrors:");
        result.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Completed in ${duration}s`);
  } catch (error) {
    console.error("\n❌ Import failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
