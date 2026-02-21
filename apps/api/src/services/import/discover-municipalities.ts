#!/usr/bin/env npx tsx
/**
 * Municipality Discovery Tool
 *
 * Probes Finnish municipalities to discover which document management
 * system (CloudNC, Dynasty, Tweb) they use for publishing meeting minutes.
 *
 * Usage:
 *   npm run discover:municipalities                      # All systems
 *   npm run discover:municipalities -- --system=dynasty   # Only Dynasty
 *   npm run discover:municipalities -- --system=cloudnc   # Only CloudNC
 *   npm run discover:municipalities -- --system=tweb      # Only Tweb
 *   npm run discover:municipalities -- --limit=50         # Only first 50 municipalities
 */

import "dotenv/config";

// ============================================
// Finnish municipalities (URL-normalized names)
// ~310 municipalities as of 2025
// ============================================

const FINNISH_MUNICIPALITIES = [
  "akaa",
  "alajarvi",
  "alavieska",
  "alavus",
  "asikkala",
  "askola",
  "aura",
  "brando",
  "eckero",
  "enonkoski",
  "enontekio",
  "espoo",
  "eura",
  "eurajoki",
  "evijarvi",
  "finstrom",
  "forssa",
  "geta",
  "haapajärvi",
  "haapavesi",
  "hailuoto",
  "halsua",
  "hamina",
  "hammarland",
  "hankasalmi",
  "hanko",
  "harjavalta",
  "hartola",
  "hattula",
  "hausjarvi",
  "heinola",
  "heinävesi",
  "helsinki",
  "hirvensalmi",
  "hollola",
  "honkajoki",
  "huittinen",
  "humppila",
  "hyrynsalmi",
  "hyvinkaa",
  "hameenkoski",
  "hameenkyro",
  "hameenlinna",
  "ii",
  "iisalmi",
  "iitti",
  "ikaalinen",
  "ilmajoki",
  "ilomantsi",
  "imatra",
  "inari",
  "inkoo",
  "isojoki",
  "isokyro",
  "janakkala",
  "joensuu",
  "jokioinen",
  "jomala",
  "joroinen",
  "joutsa",
  "juankoski",
  "juuka",
  "juupajoki",
  "juva",
  "jyvaskyla",
  "jamijarvi",
  "jamsa",
  "jarvenpa",
  "jarvenpaa",
  "kaarina",
  "kaavi",
  "kajaani",
  "kalajoki",
  "kangasala",
  "kangasniemi",
  "kankaanpaa",
  "kannonkoski",
  "kannus",
  "karijoki",
  "karkkila",
  "karstula",
  "karvia",
  "kaskinen",
  "kauhajoki",
  "kauhava",
  "kauniainen",
  "kaustinen",
  "keitele",
  "kemi",
  "kemijarvi",
  "keminmaa",
  "kempele",
  "kerava",
  "keuruu",
  "kihniö",
  "kinnula",
  "kirkkonummi",
  "kitee",
  "kittila",
  "kiuruvesi",
  "kivijarvi",
  "kokemaki",
  "kokkola",
  "kolari",
  "konnevesi",
  "kontiolahti",
  "korsnas",
  "koski",
  "kotka",
  "kouvola",
  "kristiinankaupunki",
  "kruunupyy",
  "kuhmo",
  "kuhmoinen",
  "kumlinge",
  "kuopio",
  "kuortane",
  "kurikka",
  "kustavi",
  "kuusamo",
  "kyyjärvi",
  "kärkölä",
  "kärsämäki",
  "lahti",
  "laihia",
  "laitila",
  "lappajärvi",
  "lappavirta",
  "lapinlahti",
  "lappeeranta",
  "lapua",
  "laukaa",
  "lemi",
  "lempaala",
  "lempäälä",
  "leppävirta",
  "lestijärvi",
  "lieksa",
  "lieto",
  "liminka",
  "liperi",
  "lohja",
  "loimaa",
  "loppi",
  "loviisa",
  "luhanka",
  "lumijoki",
  "lumparland",
  "luoto",
  "luumaki",
  "maalahti",
  "mariehamn",
  "masku",
  "merijarvi",
  "merikarvia",
  "miehikkala",
  "mikkeli",
  "mouhijarvi",
  "muhos",
  "multia",
  "muonio",
  "mustasaari",
  "muurame",
  "mynamaki",
  "mantsala",
  "mantyharju",
  "mantta-vilppula",
  "naantali",
  "nakkila",
  "nivala",
  "nokia",
  "nousiainen",
  "nurmes",
  "nurmijarvi",
  "narpio",
  "orimattila",
  "oripaa",
  "orivesi",
  "oulainen",
  "oulu",
  "outokumpu",
  "padasjoki",
  "paimio",
  "paltamo",
  "parainen",
  "parikkala",
  "parkano",
  "pedersore",
  "pelkosenniemi",
  "pello",
  "perho",
  "pertunmaa",
  "petajavesi",
  "pieksamaki",
  "pielavesi",
  "pietarsaari",
  "pihtipudas",
  "pirkkala",
  "polvijarvi",
  "pomarkku",
  "pori",
  "pornainen",
  "porvoo",
  "posio",
  "pudasjarvi",
  "pukkila",
  "punkalaidun",
  "puolanka",
  "puumala",
  "pyhtaa",
  "pyhajoki",
  "pyhajarvi",
  "pyhanta",
  "pyharanta",
  "parnainen",
  "poytya",
  "raahe",
  "raasepori",
  "rantasalmi",
  "ranua",
  "rauma",
  "rautalampi",
  "rautavaara",
  "rautjarvi",
  "reisjärvi",
  "riihimaki",
  "ristiina",
  "ristijärvi",
  "rovaniemi",
  "ruokolahti",
  "ruovesi",
  "rusko",
  "raakkyla",
  "saarijarvi",
  "salla",
  "salo",
  "saltvik",
  "sastamala",
  "sauvo",
  "savitaipale",
  "savonlinna",
  "savukoski",
  "seinajoki",
  "sievi",
  "siikainen",
  "siikajoki",
  "siikalatva",
  "siilinjärvi",
  "simo",
  "sipoo",
  "siuntio",
  "sodankyla",
  "soini",
  "somero",
  "sonkajarvi",
  "sotkamo",
  "sottunga",
  "sulkava",
  "sund",
  "suomussalmi",
  "suonenjoki",
  "sysmä",
  "säkylä",
  "taipalsaari",
  "taivalkoski",
  "taivassalo",
  "tammela",
  "tampere",
  "tervo",
  "tervola",
  "teuva",
  "tohmajärvi",
  "toholampi",
  "toivakka",
  "tornio",
  "turku",
  "tuusniemi",
  "tuusula",
  "tyrnava",
  "ulvila",
  "urjala",
  "utajarvi",
  "utsjoki",
  "uurainen",
  "uusikaarlepyy",
  "uusikaupunki",
  "vaala",
  "vaasa",
  "valkeakoski",
  "valtimo",
  "vantaa",
  "varkaus",
  "vehmaa",
  "vesanto",
  "vesilahti",
  "veteli",
  "vierema",
  "vihti",
  "viitasaari",
  "vimpeli",
  "virolahti",
  "virrat",
  "vardö",
  "vöyri",
  "ylitornio",
  "ylivieska",
  "ylöjärvi",
  "ypäjä",
  "ähtäri",
  "äänekoski",
];

// ============================================
// URL patterns per system
// ============================================

interface UrlPattern {
  system: string;
  buildUrl: (municipality: string) => string;
}

const URL_PATTERNS: UrlPattern[] = [
  // CloudNC: single pattern
  {
    system: "cloudnc",
    buildUrl: (m) => `https://${m}.cloudnc.fi/fi-FI`,
  },
  // Dynasty: direct server patterns
  {
    system: "dynasty",
    buildUrl: (m) =>
      `https://poytakirjat.${m}.fi/cgi/DREQUEST.PHP?page=meeting_frames`,
  },
  {
    system: "dynasty",
    buildUrl: (m) =>
      `https://dynasty.${m}.fi/djulkaisu/cgi/DREQUEST.PHP?page=meeting_frames`,
  },
  {
    system: "dynasty",
    buildUrl: (m) =>
      `https://${m}.dynasty.fi/cgi/DREQUEST.PHP?page=meeting_frames`,
  },
  {
    system: "dynasty",
    buildUrl: (m) =>
      `https://www.${m}.fi/djulkaisu/cgi/DREQUEST.PHP?page=meeting_frames`,
  },
  // Dynasty: regional servers (Kaustisen seutukunta)
  {
    system: "dynasty",
    buildUrl: (m) => {
      const capitalized = m.charAt(0).toUpperCase() + m.slice(1);
      return `https://dynastyjulkaisu.kase.fi/D10_${capitalized}/cgi/DREQUEST.PHP?page=meeting_frames`;
    },
  },
  // Dynasty: regional servers (Pohjois-Karjala)
  {
    system: "dynasty",
    buildUrl: (m) => {
      const capitalized = m.charAt(0).toUpperCase() + m.slice(1);
      return `https://dynastyjulkaisu.pohjoiskarjala.net/${capitalized}/cgi/DREQUEST.PHP?page=meeting_frames`;
    },
  },
  // Tweb: single pattern
  {
    system: "tweb",
    buildUrl: (m) =>
      `https://${m}.tweb.fi/ktwebbin/dbisa.dll/ktwebscr/pk_tek_tweb.htm`,
  },
];

// ============================================
// Probe logic
// ============================================

interface DiscoveryResult {
  municipality: string;
  system: string;
  url: string;
  status: number;
  responseTime: number;
}

async function probe(
  url: string,
  timeout: number = 5000,
): Promise<{ status: number; time: number } | null> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timer);
    return { status: response.status, time: Date.now() - start };
  } catch {
    return null;
  }
}

function normalizeForUrl(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
    .replace(/ü/g, "u")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9-]/g, "");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Main discovery function
// ============================================

async function discoverMunicipalities(options: {
  system?: string;
  limit?: number;
}) {
  const { system, limit } = options;

  const patterns = system
    ? URL_PATTERNS.filter((p) => p.system === system)
    : URL_PATTERNS;

  if (patterns.length === 0) {
    console.error(`Unknown system: ${system}`);
    console.error("Available systems: cloudnc, dynasty, tweb");
    process.exit(1);
  }

  const municipalitiesToCheck = limit
    ? FINNISH_MUNICIPALITIES.slice(0, limit)
    : FINNISH_MUNICIPALITIES;

  console.log("=".repeat(60));
  console.log("MUNICIPALITY DISCOVERY TOOL");
  console.log("=".repeat(60));
  console.log(`Systems: ${system || "all"}`);
  console.log(`Municipalities to check: ${municipalitiesToCheck.length}`);
  console.log(`URL patterns: ${patterns.length}`);
  console.log();

  const results: DiscoveryResult[] = [];
  let checked = 0;

  for (const municipality of municipalitiesToCheck) {
    const normalized = normalizeForUrl(municipality);

    for (const pattern of patterns) {
      const url = pattern.buildUrl(normalized);
      const probeResult = await probe(url);

      checked++;
      if (checked % 50 === 0) {
        console.log(
          `   Progress: ${checked}/${municipalitiesToCheck.length * patterns.length} checked, ${results.length} found`,
        );
      }

      if (probeResult && probeResult.status === 200) {
        console.log(
          `   ✅ ${municipality} → ${pattern.system} (${probeResult.time}ms)`,
        );
        results.push({
          municipality,
          system: pattern.system,
          url: url.split("?")[0], // Strip query params for cleaner output
          status: probeResult.status,
          responseTime: probeResult.time,
        });
        // If found on one pattern for this system, skip other patterns for same system
        break;
      }

      // Rate limit: 500ms between requests
      await sleep(500);
    }
  }

  // Output results
  console.log();
  console.log("=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(`Total found: ${results.length}`);
  console.log();

  // Group by system
  const bySystem: Record<string, DiscoveryResult[]> = {};
  for (const r of results) {
    if (!bySystem[r.system]) bySystem[r.system] = [];
    bySystem[r.system].push(r);
  }

  for (const [sys, sysResults] of Object.entries(bySystem)) {
    console.log(`\n${sys.toUpperCase()} (${sysResults.length}):`);
    for (const r of sysResults) {
      console.log(
        `  { municipality: '${r.municipality}', type: '${r.system}', url: '${r.url}' },`,
      );
    }
  }

  // Output as copy-pasteable TypeScript
  console.log();
  console.log("=".repeat(60));
  console.log("COPY-PASTE READY (MinuteSource[]):");
  console.log("=".repeat(60));
  for (const [sys, sysResults] of Object.entries(bySystem)) {
    console.log(`\n// ${sys} (${sysResults.length} municipalities)`);
    for (const r of sysResults) {
      console.log(
        `  { municipality: '${r.municipality.charAt(0).toUpperCase() + r.municipality.slice(1)}', type: '${r.system}', url: '${r.url}' },`,
      );
    }
  }
}

// ============================================
// CLI entry point
// ============================================

async function main() {
  const args = process.argv.slice(2);

  const systemArg = args.find((a) => a.startsWith("--system="));
  const system = systemArg ? systemArg.split("=")[1] : undefined;

  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

  await discoverMunicipalities({ system, limit });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
