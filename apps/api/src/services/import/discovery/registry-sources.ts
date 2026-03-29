/**
 * European Municipality Registry Sources
 *
 * Country-by-country configuration for municipality discovery.
 * Each country defines:
 * - Operating mode (production, test, discovery-only, disabled)
 * - URL patterns to probe for known systems
 * - Municipality lists (or methods to fetch them)
 * - Content language
 *
 * Operating modes:
 * - 'production': Full automation — discovery, import, self-healing, scheduling
 * - 'test': Run single test fetches on demand, no automated scheduling
 * - 'discovery-only': Probe and discover, but don't import content
 * - 'disabled': Skip entirely
 *
 * Override via env: SCRAPER_MODE_FI=production, SCRAPER_MODE_EE=test, etc.
 *
 * Country priorities: 1 FI, 2 SE, 3 NO, 4 DK, 5 EE, 6 DE
 */

import {
  EE_MUNICIPALITIES as EE_FULL,
  DE_MUNICIPALITIES as DE_FULL,
  SE_MUNICIPALITIES as SE_FULL,
  NO_MUNICIPALITIES as NO_FULL,
  DK_MUNICIPALITIES as DK_FULL,
} from "./municipality-data.js";

import type { AdminLevel, AdminEntity } from "./admin-entities.js";
import {
  FI_ADMIN_ENTITIES,
  SE_ADMIN_ENTITIES,
  NO_ADMIN_ENTITIES,
  DK_ADMIN_ENTITIES,
  DE_ADMIN_ENTITIES,
} from "./admin-entities-data.js";

export type OperatingMode =
  | "production"
  | "test"
  | "discovery-only"
  | "disabled";

export interface UrlPattern {
  system: string; // System type key matching templates.ts
  buildUrl: (slug: string) => string;
  // Additional validation: check for specific HTML pattern to confirm system
  confirmPattern?: string;
}

export interface CountryConfig {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  nameLocal: string;
  language: string; // Primary content language
  defaultMode: OperatingMode;
  urlPatterns: UrlPattern[];
  // Municipality slugs for probing (expanded below per country)
  municipalities: { name: string; slug: string; population?: number }[];
  // Higher administrative level entities (regions, counties, states)
  adminEntities?: AdminEntity[];
  // URL patterns per admin level (municipality patterns stay in urlPatterns)
  adminUrlPatterns?: Partial<Record<AdminLevel, UrlPattern[]>>;
  // Rate limit between probes (ms)
  probeDelayMs: number;
  // Max entities to probe in one discovery run (municipalities + admin entities)
  probeLimit: number;
}

/**
 * Get the operating mode for a country.
 * Checks env var first (e.g., SCRAPER_MODE_FI), then falls back to default.
 */
export function getCountryMode(countryCode: string): OperatingMode {
  const envKey = `SCRAPER_MODE_${countryCode.toUpperCase()}`;
  const envVal = process.env[envKey] as OperatingMode | undefined;
  if (
    envVal &&
    ["production", "test", "discovery-only", "disabled"].includes(envVal)
  ) {
    return envVal;
  }
  return COUNTRY_CONFIGS[countryCode]?.defaultMode || "disabled";
}

// ============================================
// FINLAND (FI) - 309 municipalities (2024)
// ============================================

const FI_URL_PATTERNS: UrlPattern[] = [
  // CloudNC
  {
    system: "cloudnc",
    buildUrl: (slug) => `https://${slug}.cloudnc.fi/fi-FI`,
    confirmPattern: "cloudnc",
  },
  // Dynasty: poytakirjat.[kunta].fi
  {
    system: "dynasty",
    buildUrl: (slug) =>
      `https://poytakirjat.${slug}.fi/cgi/DREQUEST.PHP?page=meeting_frames`,
    confirmPattern: "DREQUEST",
  },
  // Dynasty: dynasty.[kunta].fi/djulkaisu
  {
    system: "dynasty",
    buildUrl: (slug) =>
      `https://dynasty.${slug}.fi/djulkaisu/cgi/DREQUEST.PHP?page=meeting_frames`,
    confirmPattern: "DREQUEST",
  },
  // Dynasty: www.[kunta].fi/djulkaisu
  {
    system: "dynasty",
    buildUrl: (slug) =>
      `https://www.${slug}.fi/djulkaisu/cgi/DREQUEST.PHP?page=meeting_frames`,
    confirmPattern: "DREQUEST",
  },
  // Tweb
  {
    system: "tweb",
    buildUrl: (slug) =>
      `https://${slug}.tweb.fi/ktwebbin/dbisa.dll/ktwebscr/pk_tek_tweb.htm`,
    confirmPattern: "ktwebbin",
  },
  // Tweb "new" (ktwebscr variant — no dbisa.dll, different URL structure)
  {
    system: "tweb-new",
    buildUrl: (slug) => `https://${slug}.tweb.fi/ktwebscr/epj_tek_tweb.htm`,
    confirmPattern: "tweb",
  },
  // Dynasty: OnCloudOS (cloud-hosted Dynasty, growing fast)
  {
    system: "dynasty",
    buildUrl: (slug) =>
      `https://${slug}.oncloudos.com/cgi/DREQUEST.PHP?page=meeting_frames`,
    confirmPattern: "DREQUEST",
  },
  // Dynasty: OnCloudOS with d10 suffix (common variant)
  {
    system: "dynasty",
    buildUrl: (slug) =>
      `https://${slug}d10.oncloudos.com/cgi/DREQUEST.PHP?page=meeting_frames`,
    confirmPattern: "DREQUEST",
  },
  // Dynasty: OnCloudOS with 10 suffix
  {
    system: "dynasty",
    buildUrl: (slug) =>
      `https://${slug}10.oncloudos.com/cgi/DREQUEST.PHP?page=meeting_frames`,
    confirmPattern: "DREQUEST",
  },
  // TriPlanCloud (Triplan's cloud-hosted Tweb variant, uses ktwebscr)
  {
    system: "tweb-new",
    buildUrl: (slug) =>
      `https://${slug}-julkaisu.triplancloud.fi/ktwebscr/epj_tek_tweb.htm`,
    confirmPattern: "tweb",
  },
];

// All 309 Finnish municipalities grouped by region (maakunta), 2024 data
const FI_MUNICIPALITIES = [
  // ---- Uusimaa (26 municipalities) ----
  { name: "Helsinki", slug: "helsinki", population: 674500 },
  { name: "Espoo", slug: "espoo", population: 302200 },
  { name: "Vantaa", slug: "vantaa", population: 243000 },
  { name: "Kauniainen", slug: "kauniainen", population: 10200 },
  { name: "Hyvinkää", slug: "hyvinkaa", population: 46800 },
  { name: "Järvenpää", slug: "jarvenpaa", population: 44600 },
  { name: "Kerava", slug: "kerava", population: 37800 },
  { name: "Kirkkonummi", slug: "kirkkonummi", population: 41500 },
  { name: "Lohja", slug: "lohja", population: 46400 },
  { name: "Nurmijärvi", slug: "nurmijarvi", population: 43800 },
  { name: "Porvoo", slug: "porvoo", population: 50800 },
  { name: "Raseborg", slug: "raseborg", population: 27200 },
  { name: "Sipoo", slug: "sipoo", population: 21600 },
  { name: "Siuntio", slug: "siuntio", population: 6300 },
  { name: "Tuusula", slug: "tuusula", population: 40000 },
  { name: "Vihti", slug: "vihti", population: 30100 },
  { name: "Mäntsälä", slug: "mantsala", population: 20800 },
  { name: "Pornainen", slug: "pornainen", population: 5600 },
  { name: "Hanko", slug: "hanko", population: 8200 },
  { name: "Inkoo", slug: "inkoo", population: 5500 },
  { name: "Karkkila", slug: "karkkila", population: 8900 },
  { name: "Loviisa", slug: "loviisa", population: 14700 },
  { name: "Askola", slug: "askola", population: 4800 },
  { name: "Lapinjärvi", slug: "lapinjarvi", population: 2600 },
  { name: "Myrskylä", slug: "myrskyla", population: 1900 },
  { name: "Pukkila", slug: "pukkila", population: 1900 },

  // ---- Varsinais-Suomi (27 municipalities) ----
  { name: "Turku", slug: "turku", population: 199500 },
  { name: "Salo", slug: "salo", population: 51000 },
  { name: "Kaarina", slug: "kaarina", population: 34600 },
  { name: "Raisio", slug: "raisio", population: 24300 },
  { name: "Naantali", slug: "naantali", population: 19700 },
  { name: "Lieto", slug: "lieto", population: 20100 },
  { name: "Parainen", slug: "parainen", population: 15200 },
  { name: "Paimio", slug: "paimio", population: 10900 },
  { name: "Loimaa", slug: "loimaa", population: 15700 },
  { name: "Uusikaupunki", slug: "uusikaupunki", population: 16100 },
  { name: "Laitila", slug: "laitila", population: 8500 },
  { name: "Somero", slug: "somero", population: 8700 },
  { name: "Masku", slug: "masku", population: 9900 },
  { name: "Mynämäki", slug: "mynamaki", population: 7800 },
  { name: "Nousiainen", slug: "nousiainen", population: 4800 },
  { name: "Aura", slug: "aura", population: 4100 },
  { name: "Pöytyä", slug: "poytya", population: 8500 },
  { name: "Rusko", slug: "rusko", population: 6500 },
  { name: "Marttila", slug: "marttila", population: 2000 },
  { name: "Koski Tl", slug: "koskitl", population: 2300 },
  { name: "Oripää", slug: "oripaa", population: 1300 },
  { name: "Sauvo", slug: "sauvo", population: 3000 },
  { name: "Pyhäranta", slug: "pyharanta", population: 2000 },
  { name: "Taivassalo", slug: "taivassalo", population: 1600 },
  { name: "Vehmaa", slug: "vehmaa", population: 2200 },
  { name: "Kustavi", slug: "kustavi", population: 900 },
  { name: "Kemiönsaari", slug: "kemionsaari", population: 6600 },

  // ---- Satakunta (16 municipalities) ----
  { name: "Pori", slug: "pori", population: 83500 },
  { name: "Rauma", slug: "rauma", population: 39000 },
  { name: "Ulvila", slug: "ulvila", population: 13000 },
  { name: "Eura", slug: "eura", population: 11700 },
  { name: "Eurajoki", slug: "eurajoki", population: 9500 },
  { name: "Huittinen", slug: "huittinen", population: 10100 },
  { name: "Kankaanpää", slug: "kankaanpaa", population: 11200 },
  { name: "Kokemäki", slug: "kokemaki", population: 7200 },
  { name: "Harjavalta", slug: "harjavalta", population: 7000 },
  { name: "Nakkila", slug: "nakkila", population: 5400 },
  { name: "Säkylä", slug: "sakyla", population: 4200 },
  { name: "Pomarkku", slug: "pomarkku", population: 2100 },
  { name: "Merikarvia", slug: "merikarvia", population: 3000 },
  { name: "Siikainen", slug: "siikainen", population: 1400 },
  { name: "Jämijärvi", slug: "jamijarvi", population: 1800 },
  { name: "Karvia", slug: "karvia", population: 2300 },

  // ---- Kanta-Häme (11 municipalities) ----
  { name: "Hämeenlinna", slug: "hameenlinna", population: 68800 },
  { name: "Riihimäki", slug: "riihimaki", population: 29100 },
  { name: "Forssa", slug: "forssa", population: 16800 },
  { name: "Janakkala", slug: "janakkala", population: 16600 },
  { name: "Hattula", slug: "hattula", population: 9800 },
  { name: "Tammela", slug: "tammela", population: 6100 },
  { name: "Loppi", slug: "loppi", population: 8000 },
  { name: "Hausjärvi", slug: "hausjarvi", population: 8400 },
  { name: "Jokioinen", slug: "jokioinen", population: 5200 },
  { name: "Humppila", slug: "humppila", population: 2300 },
  { name: "Ypäjä", slug: "ypaja", population: 2300 },

  // ---- Pirkanmaa (23 municipalities) ----
  { name: "Tampere", slug: "tampere", population: 252200 },
  { name: "Nokia", slug: "nokia", population: 35200 },
  { name: "Ylöjärvi", slug: "ylojarvi", population: 34500 },
  { name: "Kangasala", slug: "kangasala", population: 33000 },
  { name: "Lempäälä", slug: "lempaala", population: 24300 },
  { name: "Pirkkala", slug: "pirkkala", population: 20200 },
  { name: "Valkeakoski", slug: "valkeakoski", population: 20800 },
  { name: "Sastamala", slug: "sastamala", population: 24600 },
  { name: "Akaa", slug: "akaa", population: 16600 },
  { name: "Orivesi", slug: "orivesi", population: 9100 },
  { name: "Mänttä-Vilppula", slug: "manttavilppula", population: 9800 },
  { name: "Hämeenkyrö", slug: "hameenkyro", population: 10600 },
  { name: "Parkano", slug: "parkano", population: 6400 },
  { name: "Pälkäne", slug: "palkane", population: 6500 },
  { name: "Vesilahti", slug: "vesilahti", population: 4600 },
  { name: "Urjala", slug: "urjala", population: 4700 },
  { name: "Punkalaidun", slug: "punkalaidun", population: 2800 },
  { name: "Ikaalinen", slug: "ikaalinen", population: 6900 },
  { name: "Ruovesi", slug: "ruovesi", population: 4300 },
  { name: "Virrat", slug: "virrat", population: 6500 },
  { name: "Kihniö", slug: "kihnio", population: 1900 },
  { name: "Juupajoki", slug: "juupajoki", population: 1800 },
  { name: "Kuhmoinen", slug: "kuhmoinen", population: 2100 },

  // ---- Päijät-Häme (10 municipalities) ----
  { name: "Lahti", slug: "lahti", population: 120400 },
  { name: "Heinola", slug: "heinola", population: 18700 },
  { name: "Orimattila", slug: "orimattila", population: 16200 },
  { name: "Hollola", slug: "hollola", population: 24300 },
  { name: "Asikkala", slug: "asikkala", population: 7900 },
  { name: "Kärkölä", slug: "karkola", population: 4500 },
  { name: "Padasjoki", slug: "padasjoki", population: 2800 },
  { name: "Sysmä", slug: "sysma", population: 3600 },
  { name: "Hartola", slug: "hartola", population: 2700 },
  { name: "Iitti", slug: "iitti", population: 6500 },

  // ---- Kymenlaakso (6 municipalities) ----
  { name: "Kouvola", slug: "kouvola", population: 81000 },
  { name: "Kotka", slug: "kotka", population: 51500 },
  { name: "Hamina", slug: "hamina", population: 19800 },
  { name: "Pyhtää", slug: "pyhtaa", population: 5200 },
  { name: "Virolahti", slug: "virolahti", population: 3100 },
  { name: "Miehikkälä", slug: "miehikkala", population: 1900 },

  // ---- Etelä-Karjala (9 municipalities) ----
  { name: "Lappeenranta", slug: "lappeenranta", population: 73400 },
  { name: "Imatra", slug: "imatra", population: 26000 },
  { name: "Lemi", slug: "lemi", population: 3100 },
  { name: "Luumäki", slug: "luumaki", population: 4600 },
  { name: "Parikkala", slug: "parikkala", population: 4800 },
  { name: "Rautjärvi", slug: "rautjarvi", population: 3100 },
  { name: "Ruokolahti", slug: "ruokolahti", population: 4900 },
  { name: "Savitaipale", slug: "savitaipale", population: 3300 },
  { name: "Taipalsaari", slug: "taipalsaari", population: 4700 },

  // ---- Etelä-Savo (12 municipalities) ----
  { name: "Mikkeli", slug: "mikkeli", population: 52000 },
  { name: "Savonlinna", slug: "savonlinna", population: 32800 },
  { name: "Pieksämäki", slug: "pieksamaki", population: 17200 },
  { name: "Mäntyharju", slug: "mantyharju", population: 5900 },
  { name: "Kangasniemi", slug: "kangasniemi", population: 5300 },
  { name: "Juva", slug: "juva", population: 5800 },
  { name: "Pertunmaa", slug: "pertunmaa", population: 1700 },
  { name: "Puumala", slug: "puumala", population: 2200 },
  { name: "Sulkava", slug: "sulkava", population: 2500 },
  { name: "Enonkoski", slug: "enonkoski", population: 1300 },
  { name: "Hirvensalmi", slug: "hirvensalmi", population: 2100 },
  { name: "Rantasalmi", slug: "rantasalmi", population: 3300 },

  // ---- Pohjois-Savo (19 municipalities) ----
  { name: "Kuopio", slug: "kuopio", population: 123000 },
  { name: "Siilinjärvi", slug: "siilinjarvi", population: 21800 },
  { name: "Iisalmi", slug: "iisalmi", population: 21000 },
  { name: "Varkaus", slug: "varkaus", population: 19700 },
  { name: "Suonenjoki", slug: "suonenjoki", population: 7100 },
  { name: "Leppävirta", slug: "leppavirta", population: 9000 },
  { name: "Kiuruvesi", slug: "kiuruvesi", population: 7800 },
  { name: "Lapinlahti", slug: "lapinlahti", population: 9200 },
  { name: "Sonkajärvi", slug: "sonkajarvi", population: 3600 },
  { name: "Pielavesi", slug: "pielavesi", population: 4200 },
  { name: "Rautalampi", slug: "rautalampi", population: 3100 },
  { name: "Keitele", slug: "keitele", population: 2200 },
  { name: "Vesanto", slug: "vesanto", population: 2000 },
  { name: "Tervo", slug: "tervo", population: 1500 },
  { name: "Tuusniemi", slug: "tuusniemi", population: 2400 },
  { name: "Kaavi", slug: "kaavi", population: 2800 },
  { name: "Rautavaara", slug: "rautavaara", population: 1500 },
  { name: "Vieremä", slug: "vierema", population: 3400 },
  { name: "Joroinen", slug: "joroinen", population: 4800 },

  // ---- Pohjois-Karjala (13 municipalities) ----
  { name: "Joensuu", slug: "joensuu", population: 78000 },
  { name: "Lieksa", slug: "lieksa", population: 10600 },
  { name: "Nurmes", slug: "nurmes", population: 7400 },
  { name: "Outokumpu", slug: "outokumpu", population: 6700 },
  { name: "Kitee", slug: "kitee", population: 9600 },
  { name: "Kontiolahti", slug: "kontiolahti", population: 15500 },
  { name: "Liperi", slug: "liperi", population: 12000 },
  { name: "Polvijärvi", slug: "polvijarvi", population: 4000 },
  { name: "Juuka", slug: "juuka", population: 4500 },
  { name: "Ilomantsi", slug: "ilomantsi", population: 4800 },
  { name: "Tohmajärvi", slug: "tohmajarvi", population: 4400 },
  { name: "Heinävesi", slug: "heinavesi", population: 3100 },
  { name: "Rääkkylä", slug: "raakkyla", population: 2100 },

  // ---- Keski-Suomi (22 municipalities) ----
  { name: "Jyväskylä", slug: "jyvaskyla", population: 146400 },
  { name: "Jämsä", slug: "jamsa", population: 20000 },
  { name: "Äänekoski", slug: "aanekoski", population: 18800 },
  { name: "Saarijärvi", slug: "saarijarvi", population: 9400 },
  { name: "Viitasaari", slug: "viitasaari", population: 6000 },
  { name: "Laukaa", slug: "laukaa", population: 19200 },
  { name: "Muurame", slug: "muurame", population: 10300 },
  { name: "Keuruu", slug: "keuruu", population: 9400 },
  { name: "Petäjävesi", slug: "petajavesi", population: 4000 },
  { name: "Joutsa", slug: "joutsa", population: 4200 },
  { name: "Pihtipudas", slug: "pihtipudas", population: 3800 },
  { name: "Kivijärvi", slug: "kivijarvi", population: 1100 },
  { name: "Kannonkoski", slug: "kannonkoski", population: 1300 },
  { name: "Karstula", slug: "karstula", population: 3900 },
  { name: "Kyyjärvi", slug: "kyyjarvi", population: 1200 },
  { name: "Kinnula", slug: "kinnula", population: 1500 },
  { name: "Konnevesi", slug: "konnevesi", population: 2600 },
  { name: "Multia", slug: "multia", population: 1500 },
  { name: "Uurainen", slug: "uurainen", population: 3800 },
  { name: "Hankasalmi", slug: "hankasalmi", population: 4800 },
  { name: "Toivakka", slug: "toivakka", population: 2500 },
  { name: "Luhanka", slug: "luhanka", population: 650 },

  // ---- Etelä-Pohjanmaa (18 municipalities) ----
  { name: "Seinäjoki", slug: "seinajoki", population: 65200 },
  { name: "Kauhava", slug: "kauhava", population: 15700 },
  { name: "Lapua", slug: "lapua", population: 14700 },
  { name: "Kurikka", slug: "kurikka", population: 20700 },
  { name: "Kauhajoki", slug: "kauhajoki", population: 13000 },
  { name: "Alavus", slug: "alavus", population: 11200 },
  { name: "Ilmajoki", slug: "ilmajoki", population: 12200 },
  { name: "Teuva", slug: "teuva", population: 5000 },
  { name: "Ähtäri", slug: "ahtari", population: 5700 },
  { name: "Alajärvi", slug: "alajarvi", population: 9500 },
  { name: "Lappajärvi", slug: "lappajarvi", population: 2900 },
  { name: "Vimpeli", slug: "vimpeli", population: 2800 },
  { name: "Evijärvi", slug: "evijarvi", population: 2400 },
  { name: "Soini", slug: "soini", population: 2000 },
  { name: "Kuortane", slug: "kuortane", population: 3500 },
  { name: "Isojoki", slug: "isojoki", population: 2000 },
  { name: "Karijoki", slug: "karijoki", population: 1300 },
  { name: "Isokyrö", slug: "isokyro", population: 4600 },

  // ---- Pohjanmaa (14 municipalities) ----
  { name: "Vaasa", slug: "vaasa", population: 68100 },
  { name: "Mustasaari", slug: "mustasaari", population: 19700 },
  { name: "Pietarsaari", slug: "pietarsaari", population: 19100 },
  { name: "Pedersören kunta", slug: "pedersore", population: 11100 },
  { name: "Närpiö", slug: "narpio", population: 9200 },
  { name: "Kristiinankaupunki", slug: "kristiinankaupunki", population: 6400 },
  { name: "Uusikaarlepyy", slug: "uusikaarlepyy", population: 7400 },
  { name: "Kruunupyy", slug: "kruunupyy", population: 6500 },
  { name: "Luoto", slug: "luoto", population: 5400 },
  { name: "Maalahti", slug: "maalahti", population: 5500 },
  { name: "Vöyri", slug: "voyri", population: 6300 },
  { name: "Korsnäs", slug: "korsnas", population: 2100 },
  { name: "Laihia", slug: "laihia", population: 8200 },
  { name: "Kaskinen", slug: "kaskinen", population: 1200 },

  // ---- Keski-Pohjanmaa (8 municipalities) ----
  { name: "Kokkola", slug: "kokkola", population: 48800 },
  { name: "Kannus", slug: "kannus", population: 5400 },
  { name: "Kaustinen", slug: "kaustinen", population: 4200 },
  { name: "Veteli", slug: "veteli", population: 3100 },
  { name: "Halsua", slug: "halsua", population: 1100 },
  { name: "Lestijärvi", slug: "lestijarvi", population: 700 },
  { name: "Toholampi", slug: "toholampi", population: 3000 },
  { name: "Perho", slug: "perho", population: 2700 },

  // ---- Pohjois-Pohjanmaa (30 municipalities) ----
  { name: "Oulu", slug: "oulu", population: 212000 },
  { name: "Raahe", slug: "raahe", population: 24200 },
  { name: "Ylivieska", slug: "ylivieska", population: 15200 },
  { name: "Kalajoki", slug: "kalajoki", population: 12800 },
  { name: "Kuusamo", slug: "kuusamo", population: 14800 },
  { name: "Nivala", slug: "nivala", population: 10800 },
  { name: "Haapajärvi", slug: "haapajarvi", population: 7100 },
  { name: "Haapavesi", slug: "haapavesi", population: 7000 },
  { name: "Oulainen", slug: "oulainen", population: 7400 },
  { name: "Ii", slug: "ii", population: 10100 },
  { name: "Muhos", slug: "muhos", population: 9100 },
  { name: "Liminka", slug: "liminka", population: 10900 },
  { name: "Kempele", slug: "kempele", population: 18500 },
  { name: "Tyrnävä", slug: "tyrnava", population: 7300 },
  { name: "Lumijoki", slug: "lumijoki", population: 2100 },
  { name: "Siikajoki", slug: "siikajoki", population: 5100 },
  { name: "Pyhäjoki", slug: "pyhajoki", population: 3000 },
  { name: "Merijärvi", slug: "merijarvi", population: 1100 },
  { name: "Alavieska", slug: "alavieska", population: 2500 },
  { name: "Sievi", slug: "sievi", population: 4900 },
  { name: "Pyhäjärvi", slug: "pyhajarvi", population: 4900 },
  { name: "Kärsämäki", slug: "karsamaki", population: 2500 },
  { name: "Reisjärvi", slug: "reisjarvi", population: 2600 },
  { name: "Pyhäntä", slug: "pyhanta", population: 1400 },
  { name: "Siikalatva", slug: "siikalatva", population: 5200 },
  { name: "Pudasjärvi", slug: "pudasjarvi", population: 7700 },
  { name: "Taivalkoski", slug: "taivalkoski", population: 3700 },
  { name: "Vaala", slug: "vaala", population: 2800 },
  { name: "Utajärvi", slug: "utajarvi", population: 2600 },
  { name: "Hailuoto", slug: "hailuoto", population: 1000 },

  // ---- Kainuu (8 municipalities) ----
  { name: "Kajaani", slug: "kajaani", population: 35800 },
  { name: "Sotkamo", slug: "sotkamo", population: 10100 },
  { name: "Kuhmo", slug: "kuhmo", population: 7700 },
  { name: "Suomussalmi", slug: "suomussalmi", population: 7500 },
  { name: "Puolanka", slug: "puolanka", population: 2500 },
  { name: "Paltamo", slug: "paltamo", population: 3200 },
  { name: "Ristijärvi", slug: "ristijarvi", population: 1200 },
  { name: "Hyrynsalmi", slug: "hyrynsalmi", population: 2100 },

  // ---- Lappi (21 municipalities) ----
  { name: "Rovaniemi", slug: "rovaniemi", population: 64700 },
  { name: "Tornio", slug: "tornio", population: 21500 },
  { name: "Kemi", slug: "kemi", population: 20200 },
  { name: "Sodankylä", slug: "sodankyla", population: 8300 },
  { name: "Kemijärvi", slug: "kemijarvi", population: 6800 },
  { name: "Kittilä", slug: "kittila", population: 6600 },
  { name: "Inari", slug: "inari", population: 7200 },
  { name: "Kolari", slug: "kolari", population: 3700 },
  { name: "Muonio", slug: "muonio", population: 2300 },
  { name: "Enontekiö", slug: "enontekio", population: 1800 },
  { name: "Utsjoki", slug: "utsjoki", population: 1200 },
  { name: "Savukoski", slug: "savukoski", population: 1000 },
  { name: "Pelkosenniemi", slug: "pelkosenniemi", population: 900 },
  { name: "Salla", slug: "salla", population: 3300 },
  { name: "Posio", slug: "posio", population: 3100 },
  { name: "Ranua", slug: "ranua", population: 3700 },
  { name: "Pello", slug: "pello", population: 3200 },
  { name: "Ylitornio", slug: "ylitornio", population: 3700 },
  { name: "Tervola", slug: "tervola", population: 2900 },
  { name: "Simo", slug: "simo", population: 3000 },
  { name: "Keminmaa", slug: "keminmaa", population: 8100 },

  // ---- Ahvenanmaa / Åland (16 municipalities) ----
  { name: "Maarianhamina", slug: "maarianhamina", population: 11900 },
  { name: "Jomala", slug: "jomala", population: 5500 },
  { name: "Finström", slug: "finstrom", population: 2600 },
  { name: "Lemland", slug: "lemland", population: 2200 },
  { name: "Saltvik", slug: "saltvik", population: 1900 },
  { name: "Hammarland", slug: "hammarland", population: 1600 },
  { name: "Sund", slug: "sund", population: 1000 },
  { name: "Eckerö", slug: "eckero", population: 950 },
  { name: "Föglö", slug: "foglo", population: 550 },
  { name: "Brändö", slug: "brando", population: 450 },
  { name: "Kumlinge", slug: "kumlinge", population: 300 },
  { name: "Kökar", slug: "kokar", population: 240 },
  { name: "Sottunga", slug: "sottunga", population: 100 },
  { name: "Geta", slug: "geta", population: 500 },
  { name: "Vårdö", slug: "vardo", population: 430 },
  { name: "Lumparland", slug: "lumparland", population: 400 },
];

// ============================================
// ESTONIA (EE) - 79 municipalities
// ============================================

const EE_URL_PATTERNS: UrlPattern[] = [
  // Amphora (most common)
  {
    system: "volis",
    buildUrl: (slug) => `https://atp.amphora.ee/${slug}/`,
    confirmPattern: "amphora",
  },
  // Delta (newer system)
  {
    system: "delta",
    buildUrl: (slug) => `https://delta.${slug}.ee/`,
    confirmPattern: "delta",
  },
];

// All 79 Estonian municipalities — imported from municipality-data.ts
const EE_MUNICIPALITIES = EE_FULL;

// ============================================
// GERMANY (DE) - Top 200 cities
// ============================================

const DE_URL_PATTERNS: UrlPattern[] = [
  // ALLRIS (most common)
  {
    system: "allris",
    buildUrl: (slug) => `https://ratsinfo.${slug}.de/bi/allris.net.asp`,
    confirmPattern: "allris",
  },
  // ALLRIS variant: stadt-prefix
  {
    system: "allris",
    buildUrl: (slug) => `https://ratsinfo.stadt-${slug}.de/bi/allris.net.asp`,
    confirmPattern: "allris",
  },
  // SessionNet
  {
    system: "sessionnet",
    buildUrl: (slug) => `https://ratsinformation.${slug}.de/`,
    confirmPattern: "sessionnet",
  },
  // SessionNet: stadt-prefix
  {
    system: "sessionnet",
    buildUrl: (slug) => `https://ratsinformation.stadt-${slug}.de/`,
    confirmPattern: "sessionnet",
  },
  // SD.NET
  {
    system: "sdnet",
    buildUrl: (slug) => `https://sdnet.${slug}.de/`,
    confirmPattern: "sdnet",
  },
];

// Top 200 German cities — imported from municipality-data.ts
const DE_MUNICIPALITIES = DE_FULL;

// ============================================
// SWEDEN (SE) - 290 municipalities
// ============================================

const SE_URL_PATTERNS: UrlPattern[] = [
  // Flexite
  {
    system: "flexite",
    buildUrl: (slug) => `https://${slug}.flexite.se/`,
    confirmPattern: "flexite",
  },
  // Municipal protocols page (generic)
  {
    system: "sweden-generic",
    buildUrl: (slug) => `https://www.${slug}.se/kommun-och-politik/protokoll`,
    confirmPattern: "protokoll",
  },
  // Alternative: kommun path
  {
    system: "sweden-generic",
    buildUrl: (slug) => `https://www.${slug}.se/kommun/protokoll-och-kallelser`,
    confirmPattern: "protokoll",
  },
];

// All 290 Swedish municipalities — imported from municipality-data.ts
const SE_MUNICIPALITIES = SE_FULL;

// ============================================
// FRANCE (FR) - Top 100 communes
// ============================================

const FR_URL_PATTERNS: UrlPattern[] = [
  // WebDelib (open-source)
  {
    system: "webdelib",
    buildUrl: (slug) => `https://webdelib.${slug}.fr/`,
    confirmPattern: "webdelib",
  },
  // iDélibes
  {
    system: "idelbes",
    buildUrl: (slug) => `https://deliberations.${slug}.fr/`,
    confirmPattern: "deliberation",
  },
  // Municipal deliberations page (generic)
  {
    system: "webdelib",
    buildUrl: (slug) => `https://www.${slug}.fr/deliberations`,
    confirmPattern: "délibération",
  },
];

const FR_MUNICIPALITIES = [
  { name: "Paris", slug: "paris", population: 2161000 },
  { name: "Marseille", slug: "marseille", population: 873076 },
  { name: "Lyon", slug: "lyon", population: 522250 },
  { name: "Toulouse", slug: "toulouse", population: 498003 },
  { name: "Nice", slug: "nice", population: 342669 },
  { name: "Nantes", slug: "nantes", population: 318808 },
  { name: "Montpellier", slug: "montpellier", population: 299096 },
  { name: "Strasbourg", slug: "strasbourg", population: 287228 },
  { name: "Bordeaux", slug: "bordeaux", population: 260958 },
  { name: "Lille", slug: "lille", population: 236234 },
  { name: "Rennes", slug: "rennes", population: 222485 },
  { name: "Reims", slug: "reims", population: 182592 },
  { name: "Saint-Étienne", slug: "saint-etienne", population: 174082 },
  { name: "Toulon", slug: "toulon", population: 176198 },
  { name: "Le Havre", slug: "lehavre", population: 170147 },
  { name: "Grenoble", slug: "grenoble", population: 158180 },
  { name: "Dijon", slug: "dijon", population: 159346 },
  { name: "Angers", slug: "angers", population: 157175 },
  { name: "Villeurbanne", slug: "villeurbanne", population: 154781 },
  { name: "Nîmes", slug: "nimes", population: 151001 },
];

// ============================================
// NETHERLANDS (NL) - Top cities
// ============================================

const NL_URL_PATTERNS: UrlPattern[] = [
  {
    system: "ibabs",
    buildUrl: (slug) => `https://${slug}.bestuurlijkeinformatie.nl/`,
    confirmPattern: "ibabs",
  },
  {
    system: "notubiz",
    buildUrl: (slug) => `https://${slug}.notubiz.nl/`,
    confirmPattern: "notubiz",
  },
];

const NL_MUNICIPALITIES = [
  { name: "Amsterdam", slug: "amsterdam", population: 882633 },
  { name: "Rotterdam", slug: "rotterdam", population: 655468 },
  { name: "Den Haag", slug: "denhaag", population: 548320 },
  { name: "Utrecht", slug: "utrecht", population: 361924 },
  { name: "Eindhoven", slug: "eindhoven", population: 238478 },
  { name: "Groningen", slug: "groningen", population: 234249 },
  { name: "Tilburg", slug: "tilburg", population: 222399 },
  { name: "Almere", slug: "almere", population: 218096 },
  { name: "Breda", slug: "breda", population: 184403 },
  { name: "Nijmegen", slug: "nijmegen", population: 179073 },
];

// ============================================
// NORWAY (NO) - ~355 municipalities (post-2024 reform)
// ============================================

const NO_URL_PATTERNS: UrlPattern[] = [
  {
    system: "norway-generic",
    buildUrl: (slug) => `https://www.${slug}.kommune.no/politikk/motekalender`,
    confirmPattern: "protokoll",
  },
];

// All ~355 Norwegian municipalities (post-2024 reform) — imported from municipality-data.ts
const NO_MUNICIPALITIES = NO_FULL;

// ============================================
// DENMARK (DK) - 98 municipalities
// ============================================

const DK_URL_PATTERNS: UrlPattern[] = [
  {
    system: "denmark-generic",
    buildUrl: (slug) =>
      `https://www.${slug}.dk/politik/dagsordener-og-referater`,
    confirmPattern: "referat",
  },
];

// All 98 Danish municipalities — imported from municipality-data.ts
const DK_MUNICIPALITIES = DK_FULL;

// ============================================
// Additional countries (with fewer details)
// ============================================

const AT_MUNICIPALITIES = [
  { name: "Wien", slug: "wien", population: 1920000 },
  { name: "Graz", slug: "graz", population: 295000 },
  { name: "Linz", slug: "linz", population: 208000 },
  { name: "Salzburg", slug: "salzburg", population: 156000 },
  { name: "Innsbruck", slug: "innsbruck", population: 132000 },
];

const PL_MUNICIPALITIES = [
  { name: "Warszawa", slug: "warszawa", population: 1794000 },
  { name: "Kraków", slug: "krakow", population: 780000 },
  { name: "Łódź", slug: "lodz", population: 672000 },
  { name: "Wrocław", slug: "wroclaw", population: 642000 },
  { name: "Poznań", slug: "poznan", population: 534000 },
  { name: "Gdańsk", slug: "gdansk", population: 471000 },
];

const CZ_MUNICIPALITIES = [
  { name: "Praha", slug: "praha", population: 1310000 },
  { name: "Brno", slug: "brno", population: 382000 },
  { name: "Ostrava", slug: "ostrava", population: 283000 },
  { name: "Plzeň", slug: "plzen", population: 175000 },
  { name: "Liberec", slug: "liberec", population: 104000 },
];

const ES_MUNICIPALITIES = [
  { name: "Madrid", slug: "madrid", population: 3266000 },
  { name: "Barcelona", slug: "barcelona", population: 1621000 },
  { name: "Valencia", slug: "valencia", population: 792000 },
  { name: "Sevilla", slug: "sevilla", population: 688592 },
  { name: "Zaragoza", slug: "zaragoza", population: 675301 },
  { name: "Málaga", slug: "malaga", population: 578460 },
  { name: "Bilbao", slug: "bilbao", population: 346843 },
];

const IT_MUNICIPALITIES = [
  { name: "Roma", slug: "roma", population: 2873000 },
  { name: "Milano", slug: "milano", population: 1396000 },
  { name: "Napoli", slug: "napoli", population: 914758 },
  { name: "Torino", slug: "torino", population: 848885 },
  { name: "Palermo", slug: "palermo", population: 630828 },
  { name: "Firenze", slug: "firenze", population: 367150 },
];

const PT_MUNICIPALITIES = [
  { name: "Lisboa", slug: "lisboa", population: 545923 },
  { name: "Porto", slug: "porto", population: 231800 },
  { name: "Braga", slug: "braga", population: 193333 },
  { name: "Coimbra", slug: "coimbra", population: 143396 },
  { name: "Funchal", slug: "funchal", population: 111892 },
];

// ============================================
// COUNTRY CONFIGS REGISTRY
// ============================================

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  FI: {
    code: "FI",
    name: "Finland",
    nameLocal: "Suomi",
    language: "fi",
    defaultMode: "production", // Full automation for Finland
    urlPatterns: FI_URL_PATTERNS,
    municipalities: FI_MUNICIPALITIES,
    adminEntities: FI_ADMIN_ENTITIES,
    adminUrlPatterns: {
      region: [
        // Maakuntaliittojen esityslistat ja pöytäkirjat
        {
          system: "dynasty",
          buildUrl: (slug) =>
            `https://${slug}.fi/paatoksenteko/esityslistat-ja-poytakirjat`,
          confirmPattern: "pöytäkirja",
        },
        {
          system: "dynasty",
          buildUrl: (slug) => `https://www.${slug}liitto.fi/paatoksenteko`,
          confirmPattern: "esityslista",
        },
      ],
    },
    probeDelayMs: 500,
    probeLimit: 400,
  },
  EE: {
    code: "EE",
    name: "Estonia",
    nameLocal: "Eesti",
    language: "et",
    defaultMode: "test", // Priority 5
    urlPatterns: EE_URL_PATTERNS,
    municipalities: EE_MUNICIPALITIES,
    probeDelayMs: 500,
    probeLimit: 100, // All 79 municipalities
  },
  DE: {
    code: "DE",
    name: "Germany",
    nameLocal: "Deutschland",
    language: "de",
    defaultMode: "test", // Priority 6
    urlPatterns: DE_URL_PATTERNS,
    municipalities: DE_MUNICIPALITIES,
    adminEntities: DE_ADMIN_ENTITIES,
    adminUrlPatterns: {
      state: [
        // Landtag-Drucksachen und Protokolle — each state has its own system
        // but many use parlamentsspiegel or their own Landtag portals
        {
          system: "germany-landtag",
          buildUrl: (slug) => `https://www.landtag.${slug}.de/`,
          confirmPattern: "Plenarprotokoll",
        },
        {
          system: "germany-landtag",
          buildUrl: (slug) => `https://www.landtag-${slug}.de/`,
          confirmPattern: "Protokoll",
        },
      ],
    },
    probeDelayMs: 500,
    probeLimit: 250, // Top 200 cities + 16 Landtage
  },
  SE: {
    code: "SE",
    name: "Sweden",
    nameLocal: "Sverige",
    language: "sv",
    defaultMode: "test", // Priority 2
    urlPatterns: SE_URL_PATTERNS,
    municipalities: SE_MUNICIPALITIES,
    adminEntities: SE_ADMIN_ENTITIES,
    adminUrlPatterns: {
      region: [
        // Regionfullmäktige protokoll
        {
          system: "sweden-generic",
          buildUrl: (slug) =>
            `https://www.${slug}.se/politik-och-demokrati/protokoll`,
          confirmPattern: "protokoll",
        },
        {
          system: "sweden-generic",
          buildUrl: (slug) =>
            `https://www.${slug}.se/om-regionen/politik/sammantraden`,
          confirmPattern: "protokoll",
        },
      ],
    },
    probeDelayMs: 500,
    probeLimit: 320, // 290 municipalities + 21 regions
  },
  FR: {
    code: "FR",
    name: "France",
    nameLocal: "France",
    language: "fr",
    defaultMode: "test",
    urlPatterns: FR_URL_PATTERNS,
    municipalities: FR_MUNICIPALITIES,
    probeDelayMs: 500,
    probeLimit: 50,
  },
  NL: {
    code: "NL",
    name: "Netherlands",
    nameLocal: "Nederland",
    language: "nl",
    defaultMode: "test",
    urlPatterns: NL_URL_PATTERNS,
    municipalities: NL_MUNICIPALITIES,
    probeDelayMs: 500,
    probeLimit: 50,
  },
  NO: {
    code: "NO",
    name: "Norway",
    nameLocal: "Norge",
    language: "no",
    defaultMode: "test", // Priority 3
    urlPatterns: NO_URL_PATTERNS,
    municipalities: NO_MUNICIPALITIES,
    adminEntities: NO_ADMIN_ENTITIES,
    adminUrlPatterns: {
      county: [
        // Fylkesting-protokoller
        {
          system: "norway-generic",
          buildUrl: (slug) => `https://www.${slug}.no/politikk/motekalender`,
          confirmPattern: "protokoll",
        },
      ],
    },
    probeDelayMs: 500,
    probeLimit: 400, // ~355 municipalities + 15 counties
  },
  DK: {
    code: "DK",
    name: "Denmark",
    nameLocal: "Danmark",
    language: "da",
    defaultMode: "test", // Priority 4
    urlPatterns: DK_URL_PATTERNS,
    municipalities: DK_MUNICIPALITIES,
    adminEntities: DK_ADMIN_ENTITIES,
    adminUrlPatterns: {
      region: [
        // Regionsråd-referater
        {
          system: "denmark-generic",
          buildUrl: (slug) =>
            `https://www.${slug}.dk/politik/dagsordener-og-referater`,
          confirmPattern: "referat",
        },
      ],
    },
    probeDelayMs: 500,
    probeLimit: 110, // 98 municipalities + 5 regions
  },
  AT: {
    code: "AT",
    name: "Austria",
    nameLocal: "Österreich",
    language: "de",
    defaultMode: "disabled",
    urlPatterns: [
      {
        system: "austria-generic",
        buildUrl: (slug) =>
          `https://www.${slug}.gv.at/politik/gemeinderatsprotokolle`,
        confirmPattern: "protokoll",
      },
    ],
    municipalities: AT_MUNICIPALITIES,
    probeDelayMs: 500,
    probeLimit: 20,
  },
  PL: {
    code: "PL",
    name: "Poland",
    nameLocal: "Polska",
    language: "pl",
    defaultMode: "disabled",
    urlPatterns: [
      {
        system: "poland-bip",
        buildUrl: (slug) => `https://bip.${slug}.pl/`,
        confirmPattern: "bip",
      },
    ],
    municipalities: PL_MUNICIPALITIES,
    probeDelayMs: 500,
    probeLimit: 20,
  },
  CZ: {
    code: "CZ",
    name: "Czech Republic",
    nameLocal: "Česko",
    language: "cs",
    defaultMode: "disabled",
    urlPatterns: [
      {
        system: "czech-generic",
        buildUrl: (slug) =>
          `https://www.${slug}.cz/samosprava/zastupitelstvo/zapisy-z-jednani`,
        confirmPattern: "zápis",
      },
    ],
    municipalities: CZ_MUNICIPALITIES,
    probeDelayMs: 500,
    probeLimit: 20,
  },
  ES: {
    code: "ES",
    name: "Spain",
    nameLocal: "España",
    language: "es",
    defaultMode: "disabled",
    urlPatterns: [
      {
        system: "spain-generic",
        buildUrl: (slug) => `https://www.${slug}.es/plenos`,
        confirmPattern: "pleno",
      },
    ],
    municipalities: ES_MUNICIPALITIES,
    probeDelayMs: 500,
    probeLimit: 20,
  },
  IT: {
    code: "IT",
    name: "Italy",
    nameLocal: "Italia",
    language: "it",
    defaultMode: "disabled",
    urlPatterns: [
      {
        system: "italy-generic",
        buildUrl: (slug) => `https://www.comune.${slug}.it/delibere`,
        confirmPattern: "deliber",
      },
    ],
    municipalities: IT_MUNICIPALITIES,
    probeDelayMs: 500,
    probeLimit: 20,
  },
  PT: {
    code: "PT",
    name: "Portugal",
    nameLocal: "Portugal",
    language: "pt",
    defaultMode: "disabled",
    urlPatterns: [
      {
        system: "portugal-generic",
        buildUrl: (slug) => `https://www.cm-${slug}.pt/atas`,
        confirmPattern: "ata",
      },
    ],
    municipalities: PT_MUNICIPALITIES,
    probeDelayMs: 500,
    probeLimit: 20,
  },
};

/**
 * Get all supported country codes.
 */
export function getSupportedCountries(): string[] {
  return Object.keys(COUNTRY_CONFIGS);
}

/**
 * Get country config by code.
 */
export function getCountryConfig(code: string): CountryConfig | null {
  return COUNTRY_CONFIGS[code] || null;
}
