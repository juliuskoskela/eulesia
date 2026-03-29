/**
 * Page Analyzer
 *
 * Fetches a web page and extracts structural information
 * for AI analysis. Strips noise (scripts, styles, nav) and
 * highlights meaningful patterns (tables, links, PDFs).
 *
 * Used by:
 * - config-generator.ts: generate FetcherConfig from page structure
 * - self-healer.ts: re-analyze pages when configs break
 * - ai-classifier.ts: identify which system a municipality uses
 */

const ANALYZE_TIMEOUT_MS = 10000;

/**
 * Fetch and analyze a page, returning a cleaned summary for AI.
 */
export async function analyzePage(url: string): Promise<PageAnalysis | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Eulesia/1.0 (civic platform; contact@eulesia.eu)",
      },
      signal: AbortSignal.timeout(ANALYZE_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        url,
        status: response.status,
        error: `HTTP ${response.status}`,
        cleanedHtml: "",
        structure: null,
      };
    }

    const html = await response.text();
    const cleaned = cleanHtmlForAi(html);
    const structure = extractStructure(html);

    return {
      url,
      status: response.status,
      cleanedHtml: cleaned,
      structure,
    };
  } catch (err) {
    return {
      url,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
      cleanedHtml: "",
      structure: null,
    };
  }
}

export interface PageAnalysis {
  url: string;
  status: number;
  error?: string;
  cleanedHtml: string; // Stripped HTML suitable for AI analysis (~8000 chars)
  structure: PageStructure | null;
}

export interface PageStructure {
  title: string;
  lang: string;
  charset: string;
  linkCount: number;
  pdfLinks: string[];
  formCount: number;
  tableCount: number;
  // Detected patterns
  patterns: {
    hasPdfLinks: boolean;
    hasDatePatterns: boolean;
    hasMeetingKeywords: boolean;
    hasProtocolKeywords: boolean;
    detectedDateFormat: string | null;
    detectedSystem: string | null;
  };
  // Sample links (first 20)
  sampleLinks: { href: string; text: string }[];
}

/**
 * Clean HTML for AI consumption.
 * Removes scripts, styles, navigation, and other noise.
 * Keeps structure: links, tables, headings, lists.
 */
function cleanHtmlForAi(html: string): string {
  let cleaned = html;

  // Remove scripts, styles, comments, SVGs, iframes
  cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  cleaned = cleaned.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "");
  cleaned = cleaned.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
  cleaned = cleaned.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");

  // Remove header and footer navigation (common noise)
  cleaned = cleaned.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, "");
  cleaned = cleaned.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, "");
  cleaned = cleaned.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, "");

  // Remove inline event handlers and data attributes (noise)
  cleaned = cleaned.replace(/\s(?:on\w+|data-\w+)="[^"]*"/gi, "");

  // Collapse excessive whitespace
  cleaned = cleaned.replace(/\s{3,}/g, " ");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Truncate to ~8000 chars for AI context window efficiency
  if (cleaned.length > 8000) {
    cleaned = cleaned.slice(0, 8000) + "\n... [truncated]";
  }

  return cleaned.trim();
}

/**
 * Extract structural information from HTML.
 */
function extractStructure(html: string): PageStructure {
  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || "";

  // Language
  const langMatch = html.match(/<html[^>]*lang="([^"]+)"/i);
  const lang = langMatch?.[1] || "";

  // Charset
  const charsetMatch = html.match(/charset=["']?([^"'\s;>]+)/i);
  const charset = charsetMatch?.[1]?.toUpperCase() || "UTF-8";

  // Links
  const linkRegex = /href="([^"]*)"[^>]*>([^<]*)/gi;
  const links: { href: string; text: string }[] = [];
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null && links.length < 50) {
    const href = linkMatch[1];
    const text = linkMatch[2].trim();
    if (
      href &&
      text &&
      !href.startsWith("#") &&
      !href.startsWith("javascript:")
    ) {
      links.push({ href, text });
    }
  }

  // PDF links
  const pdfLinks = links
    .filter((l) => l.href.toLowerCase().endsWith(".pdf"))
    .map((l) => l.href);

  // Form count
  const formCount = (html.match(/<form\b/gi) || []).length;

  // Table count
  const tableCount = (html.match(/<table\b/gi) || []).length;

  // Date pattern detection
  const datePatterns = {
    "DD.MM.YYYY": /\d{1,2}\.\d{1,2}\.\d{4}/.test(html),
    "YYYY-MM-DD": /\d{4}-\d{2}-\d{2}/.test(html),
    "DD/MM/YYYY": /\d{1,2}\/\d{1,2}\/\d{4}/.test(html),
  };

  const detectedDateFormat =
    Object.entries(datePatterns).find(([, found]) => found)?.[0] || null;

  // Meeting-related keywords (multi-language)
  const meetingKeywords = [
    "kokous",
    "pöytäkirja",
    "esityslista", // Finnish
    "meeting",
    "minutes",
    "agenda", // English
    "protokoll",
    "sitzung",
    "niederschrift", // German
    "sammanträde",
    "kallelse", // Swedish
    "délibération",
    "procès-verbal",
    "séance", // French
    "istung",
    "otsus", // Estonian
    "vergadering",
    "notulen", // Dutch
    "referat",
    "møte", // Norwegian/Danish
  ];

  const hasMeetingKeywords = meetingKeywords.some((kw) =>
    html.toLowerCase().includes(kw),
  );

  const protocolKeywords = [
    "pöytäkirja",
    "protokoll",
    "protocol",
    "procès-verbal",
    "minutes",
    "niederschrift",
    "notulen",
    "referat",
  ];

  const hasProtocolKeywords = protocolKeywords.some((kw) =>
    html.toLowerCase().includes(kw),
  );

  // System detection heuristics
  let detectedSystem: string | null = null;
  const lowerHtml = html.toLowerCase();

  if (lowerHtml.includes("cloudnc")) detectedSystem = "cloudnc";
  else if (lowerHtml.includes("drequest.php")) detectedSystem = "dynasty";
  else if (lowerHtml.includes("ktwebbin") || lowerHtml.includes("ktproxy2"))
    detectedSystem = "tweb";
  else if (lowerHtml.includes("allris")) detectedSystem = "allris";
  else if (lowerHtml.includes("sessionnet")) detectedSystem = "sessionnet";
  else if (lowerHtml.includes("sdnet") || lowerHtml.includes("sdnetrim"))
    detectedSystem = "sdnet";
  else if (lowerHtml.includes("amphora") || lowerHtml.includes("volis"))
    detectedSystem = "volis";
  else if (lowerHtml.includes("flexite")) detectedSystem = "flexite";
  else if (lowerHtml.includes("webdelib")) detectedSystem = "webdelib";
  else if (lowerHtml.includes("notubiz")) detectedSystem = "notubiz";
  else if (lowerHtml.includes("ibabs")) detectedSystem = "ibabs";

  return {
    title,
    lang,
    charset,
    linkCount: links.length,
    pdfLinks: pdfLinks.slice(0, 10),
    formCount,
    tableCount,
    patterns: {
      hasPdfLinks: pdfLinks.length > 0,
      hasDatePatterns: detectedDateFormat !== null,
      hasMeetingKeywords,
      hasProtocolKeywords,
      detectedDateFormat,
      detectedSystem,
    },
    sampleLinks: links.slice(0, 20),
  };
}
