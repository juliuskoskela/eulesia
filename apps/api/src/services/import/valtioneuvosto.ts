/**
 * Valtioneuvosto Decision Fetcher
 *
 * Scrapes government decisions from valtioneuvosto.fi/paatokset.
 * Covers ALL ministries via a single source — replaces the limited RSS approach.
 *
 * Strategy: session-based discovery
 * 1. Enumerate sessions (istunto) by sessionId — each session lists all its decisions
 * 2. Parse decision links from session pages
 * 3. Fetch individual decision pages for full content + metadata
 *
 * Session types:
 * - Valtioneuvoston yleisistunto (Government plenary session)
 * - Raha-asiainvaliokunta (Finance Committee)
 * - Tasavallan presidentin esittely (Presidential session)
 *
 * URL patterns:
 * - Session list: https://valtioneuvosto.fi/paatokset/istunto?sessionId={id}
 * - Decision:     https://valtioneuvosto.fi/paatokset/paatos?decisionId={id}
 */

const BASE_URL = "https://valtioneuvosto.fi";
const RATE_LIMIT_MS = 2000;
let lastRequestTime = 0;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
  return fetch(url, {
    headers: {
      "User-Agent": "Eulesia/1.0 (civic platform; contact@eulesia.eu)",
      Accept: "text/html",
    },
  });
}

// ============================================
// Types
// ============================================

export interface VnSession {
  sessionId: number;
  title: string; // e.g. "Valtioneuvoston yleisistunto 5.2.2026 VN 7/2026"
  date: string; // e.g. "5.2.2026"
  type: string; // e.g. "Valtioneuvoston yleisistunto"
  reference: string; // e.g. "VN 7/2026"
  decisions: VnDecisionLink[];
}

export interface VnDecisionLink {
  decisionId: number;
  title: string;
  ministry: string; // e.g. "Oikeusministeriö"
}

export interface VnDecision {
  decisionId: number;
  title: string;
  reference: string; // e.g. "VM/2026/20"
  ministry: string;
  minister?: string;
  presenter?: string;
  sessionDate: string;
  sessionType: string;
  content: string; // Combined asia + esitys + päätös text
  attachmentUrls: string[];
  sourceUrl: string;
}

// ============================================
// Ministry name mapping (h4 headings → short names)
// ============================================

export const MINISTRY_SHORT: Record<string, string> = {
  "valtioneuvoston kanslia": "VNK",
  ulkoministeriö: "UM",
  oikeusministeriö: "OM",
  sisäministeriö: "SM",
  puolustusministeriö: "PLM",
  valtiovarainministeriö: "VM",
  "opetus- ja kulttuuriministeriö": "OKM",
  "maa- ja metsätalousministeriö": "MMM",
  "liikenne- ja viestintäministeriö": "LVM",
  "työ- ja elinkeinoministeriö": "TEM",
  "sosiaali- ja terveysministeriö": "STM",
  ympäristöministeriö: "YM",
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ============================================
// Session fetching
// ============================================

/**
 * Fetch a single session page and extract decision links.
 * Returns null if session doesn't exist.
 */
export async function fetchSession(
  sessionId: number,
): Promise<VnSession | null> {
  const url = `${BASE_URL}/paatokset/istunto?sessionId=${sessionId}`;
  const response = await rateLimitedFetch(url);

  if (!response.ok) return null;

  const html = await response.text();

  // Check if session exists (page shows error or empty content)
  if (
    html.includes("Istuntoa ei löydy") ||
    html.includes("Sivua ei löytynyt")
  ) {
    return null;
  }

  // Extract session title — typically in a heading like:
  // "Valtioneuvoston yleisistunto 5.2.2026 VN 7/2026"
  const titleMatch = html.match(
    /(Valtioneuvoston yleisistunto|Raha-asiainvaliokunta|Tasavallan presidentin esittely)\s+(\d{1,2}\.\d{1,2}\.\d{4})\s*((?:VN|RV)\s+\d+\/\d{4})?/i,
  );

  const type = titleMatch?.[1] || "Istunto";
  const date = titleMatch?.[2] || "";
  const reference = titleMatch?.[3]?.trim() || "";
  const title = titleMatch?.[0] || `Istunto ${sessionId}`;

  // Extract decision links grouped by ministry
  // Pattern: <h4>Ministeriönimi</h4> followed by <a href="...?decisionId=X">Title</a>
  const decisions: VnDecisionLink[] = [];
  let currentMinistry = "";

  // Split by h4 tags to group decisions under ministries
  const sections = html.split(/<h4[^>]*>/i);

  for (const section of sections) {
    // Extract ministry name from the start of this section
    const ministryMatch = section.match(/^([^<]+)<\/h4>/i);
    if (ministryMatch) {
      currentMinistry = ministryMatch[1].trim();
    }

    // Find all decision links in this section
    const linkRegex = /paatos\?decisionId=(\d+)[^"]*"[^>]*>([^<]+)/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(section)) !== null) {
      decisions.push({
        decisionId: parseInt(linkMatch[1], 10),
        title: linkMatch[2].trim(),
        ministry: currentMinistry,
      });
    }
  }

  // Deduplicate by decisionId
  const seen = new Set<number>();
  const uniqueDecisions = decisions.filter((d) => {
    if (seen.has(d.decisionId)) return false;
    seen.add(d.decisionId);
    return true;
  });

  return {
    sessionId,
    title,
    date,
    type,
    reference,
    decisions: uniqueDecisions,
  };
}

/**
 * Fetch an individual decision page and extract full content.
 */
export async function fetchDecision(
  decisionId: number,
  ministry?: string,
): Promise<VnDecision | null> {
  const url = `${BASE_URL}/paatokset/paatos?decisionId=${decisionId}`;
  const response = await rateLimitedFetch(url);

  if (!response.ok) return null;

  const html = await response.text();

  if (
    html.includes("Päätöstä ei löydy") ||
    html.includes("Sivua ei löytynyt")
  ) {
    return null;
  }

  // Extract title (usually contains reference like "VM/2026/20")
  const titleMatch =
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = titleMatch ? stripHtml(titleMatch[1]) : `Päätös ${decisionId}`;

  // Extract reference number (pattern: XX/YYYY/NN)
  const refMatch = html.match(/([A-ZÄÖÅ]{2,4}\/\d{4}\/\d+)/);
  const reference = refMatch ? refMatch[1] : "";

  // Clean up title — remove reference if it's duplicated there
  if (reference && title.includes(reference)) {
    title = title.replace(reference, "").trim();
  }

  // Extract minister
  const ministerMatch =
    html.match(/(?:Ministeri|Minister)[^<]*<[^>]*>([^<]+)/i) ||
    html.match(/(?:Esittelevä ministeri|Ministeri)\s*[:.]?\s*([^\n<]+)/i);
  const minister = ministerMatch
    ? stripHtml(ministerMatch[1]).trim()
    : undefined;

  // Extract presenter
  const presenterMatch =
    html.match(/(?:Esittelijä|Esittelevä)[^<]*<[^>]*>([^<]+)/i) ||
    html.match(/(?:Esittelijä)\s*[:.]?\s*([^\n<]+)/i);
  const presenter = presenterMatch
    ? stripHtml(presenterMatch[1]).trim()
    : undefined;

  // Extract session info
  const sessionMatch = html.match(
    /(Valtioneuvoston yleisistunto|Raha-asiainvaliokunta|Tasavallan presidentin esittely)\s+(\d{1,2}\.\d{1,2}\.\d{4})/i,
  );
  const sessionType = sessionMatch?.[1] || "";
  const sessionDate = sessionMatch?.[2] || "";

  // Extract content sections (Asia, Esitys, Päätös)
  const contentParts: string[] = [];

  // Try to find structured sections
  const asiaMatch = html.match(
    /(?:>Asia\s*<|<strong>Asia<\/strong>)([\s\S]*?)(?=(?:>Esitys\s*<|<strong>Esitys|>Päätös\s*<|<strong>Päätös|$))/i,
  );
  if (asiaMatch) {
    const text = stripHtml(asiaMatch[1]);
    if (text.length > 10) contentParts.push(`Asia:\n${text}`);
  }

  const esitysMatch = html.match(
    /(?:>Esitys\s*<|<strong>Esitys<\/strong>)([\s\S]*?)(?=(?:>Päätös\s*<|<strong>Päätös|$))/i,
  );
  if (esitysMatch) {
    const text = stripHtml(esitysMatch[1]);
    if (text.length > 10) contentParts.push(`Esitys:\n${text}`);
  }

  const paatosMatch = html.match(
    /(?:>Päätös\s*<|<strong>Päätös<\/strong>)([\s\S]*?)(?=(?:<\/div>|<\/article>|<footer|<nav|$))/i,
  );
  if (paatosMatch) {
    const text = stripHtml(paatosMatch[1]);
    if (text.length > 10) contentParts.push(`Päätös:\n${text}`);
  }

  // Fallback: if no structured sections found, try to extract main content area
  if (contentParts.length === 0) {
    const mainMatch =
      html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
      html.match(
        /<div[^>]*class="[^"]*journal-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      ) ||
      html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) {
      contentParts.push(stripHtml(mainMatch[1]));
    }
  }

  const content = contentParts.join("\n\n---\n\n");

  // Extract PDF attachment URLs
  const attachmentUrls: string[] = [];
  const fileRegex = /\/delegate\/file\/\d+/g;
  let fileMatch;
  while ((fileMatch = fileRegex.exec(html)) !== null) {
    const fileUrl = `${BASE_URL}${fileMatch[0]}`;
    if (!attachmentUrls.includes(fileUrl)) {
      attachmentUrls.push(fileUrl);
    }
  }

  return {
    decisionId,
    title,
    reference,
    ministry: ministry || "",
    minister,
    presenter,
    sessionDate,
    sessionType,
    content,
    attachmentUrls,
    sourceUrl: url,
  };
}

/**
 * Discover the latest session ID by probing recent IDs.
 * Starts from a high estimate and scans backwards to find the last valid session.
 */
export async function findLatestSessionId(startFrom = 400): Promise<number> {
  console.log(`   Probing for latest session from ${startFrom}...`);

  // Scan backwards from startFrom to find valid sessions
  for (let id = startFrom; id > Math.max(startFrom - 30, 1); id--) {
    const url = `${BASE_URL}/paatokset/istunto?sessionId=${id}`;
    try {
      const response = await rateLimitedFetch(url);
      if (!response.ok) continue;
      const html = await response.text();
      if (
        !html.includes("Istuntoa ei löydy") &&
        !html.includes("Sivua ei löytynyt") &&
        html.includes("decisionId=")
      ) {
        console.log(`   Latest session: ${id}`);
        return id;
      }
    } catch {
      continue;
    }
  }

  // If nothing found scanning backwards, try forward from a known base
  return 355;
}

/**
 * Fetch recent sessions (last N sessions that exist).
 * Sessions IDs are sparse — not every ID has a session.
 */
export async function fetchRecentSessions(
  count = 5,
  startFromId?: number,
): Promise<VnSession[]> {
  const latestId = startFromId ?? (await findLatestSessionId());
  const sessions: VnSession[] = [];
  let misses = 0;

  for (
    let id = latestId;
    id > 0 && sessions.length < count && misses < 15;
    id--
  ) {
    const session = await fetchSession(id);
    if (session && session.decisions.length > 0) {
      sessions.push(session);
      misses = 0;
    } else {
      misses++;
    }
  }

  return sessions;
}
