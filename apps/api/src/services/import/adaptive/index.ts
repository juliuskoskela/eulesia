/**
 * AdaptiveFetcher
 *
 * Universal MinuteFetcher implementation that interprets declarative
 * FetcherConfig JSON instead of hard-coding extraction logic.
 *
 * This enables AI-generated and template-based scraper configs
 * without generating or executing arbitrary code.
 */

import type {
  MinuteFetcher,
  MinuteSource,
  Meeting,
} from "../fetchers/types.js";
import type { AdminLevel } from "../discovery/admin-entities.js";
import type { FetcherConfig } from "./config-schema.js";
import { scraperDb, scraperConfigs } from "../../../db/scraper-db.js";
import { eq } from "drizzle-orm";

// ============================================
// Rate Limiting (shared across all adaptive fetches)
// ============================================

const RATE_LIMIT_MS = 2000;
let lastRequestTime = 0;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimitedFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
  return fetch(url, {
    ...options,
    headers: {
      "User-Agent": "Eulesia/1.0 (civic platform; contact@eulesia.eu)",
      ...options?.headers,
    },
  });
}

// ============================================
// Text Utilities
// ============================================

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
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

function applyTextCleaning(text: string, config: FetcherConfig): string {
  let cleaned = text;

  if (config.textCleaning?.stripPatterns) {
    for (const pattern of config.textCleaning.stripPatterns) {
      try {
        cleaned = cleaned.replace(new RegExp(pattern, "gi"), "");
      } catch {
        // Skip invalid patterns silently
      }
    }
  }

  if (config.textCleaning?.replacePatterns) {
    for (const { from, to } of config.textCleaning.replacePatterns) {
      try {
        cleaned = cleaned.replace(new RegExp(from, "gi"), to);
      } catch {
        // Skip invalid patterns silently
      }
    }
  }

  return cleaned.trim();
}

/**
 * Resolve URL template placeholders.
 * Supported: {baseUrl}, {baseUrlNoQuery}, {origin}, {pathPrefix}, {meetingId}, {itemId}
 */
function resolveUrlTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let resolved = template;
  for (const [key, value] of Object.entries(vars)) {
    resolved = resolved.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return resolved;
}

/**
 * Parse date string according to format.
 * Supports: DD.MM.YYYY, YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
 */
function parseDate(dateStr: string, format: string): string | undefined {
  if (!dateStr) return undefined;

  const cleaned = dateStr.trim();

  switch (format) {
    case "DD.MM.YYYY":
    case "DD/MM/YYYY": {
      const sep = format.includes(".") ? "\\." : "/";
      const match = cleaned.match(
        new RegExp(`(\\d{1,2})${sep}(\\d{1,2})${sep}(\\d{4})`),
      );
      return match ? `${match[1]}.${match[2]}.${match[3]}` : undefined;
    }
    case "YYYY-MM-DD": {
      const match = cleaned.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      return match ? `${match[3]}.${match[2]}.${match[1]}` : undefined;
    }
    default:
      return cleaned;
  }
}

// ============================================
// Config Cache (avoid DB lookups per meeting)
// ============================================

const configCache = new Map<
  string,
  {
    config: FetcherConfig;
    fetcherOptions: Record<string, string> | null;
    expiry: number;
  }
>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getConfig(configId: string): Promise<{
  config: FetcherConfig;
  fetcherOptions: Record<string, string> | null;
} | null> {
  const cached = configCache.get(configId);
  if (cached && cached.expiry > Date.now()) {
    return { config: cached.config, fetcherOptions: cached.fetcherOptions };
  }

  const rows = await scraperDb
    .select({
      config: scraperConfigs.config,
      fetcherOptions: scraperConfigs.fetcherOptions,
    })
    .from(scraperConfigs)
    .where(eq(scraperConfigs.id, configId))
    .limit(1);

  if (rows.length === 0) return null;

  const result = {
    config: rows[0].config as FetcherConfig,
    fetcherOptions: rows[0].fetcherOptions as Record<string, string> | null,
  };

  configCache.set(configId, { ...result, expiry: Date.now() + CACHE_TTL_MS });
  return result;
}

// ============================================
// AdaptiveFetcher Implementation
// ============================================

export const adaptiveFetcher: MinuteFetcher = {
  type: "adaptive",

  async fetchMeetings(source: MinuteSource): Promise<Meeting[]> {
    if (!source.configId) {
      throw new Error(`AdaptiveFetcher requires configId in MinuteSource`);
    }

    const loaded = await getConfig(source.configId);
    if (!loaded) {
      throw new Error(`No scraper config found for id: ${source.configId}`);
    }

    const { config, fetcherOptions } = loaded;
    const baseUrl = source.url;
    const parsedUrl = new URL(baseUrl);
    const origin = parsedUrl.origin;
    const pathPrefix = fetcherOptions?.pathPrefix || "";
    // baseUrlNoQuery: strip query string (for Dynasty item URLs: DREQUEST.PHP?page=meetingitem&id=...)
    const baseUrlNoQuery = baseUrl.split("?")[0];

    // Build the meeting list URL
    const listUrl = resolveUrlTemplate(config.meetingList.url, {
      baseUrl,
      origin,
      pathPrefix,
      baseUrlNoQuery,
    });
    console.log(`   [adaptive] Fetching meetings: ${listUrl}`);

    const response = await rateLimitedFetch(listUrl, {
      method: config.meetingList.method,
      headers: config.meetingList.headers,
    });

    if (!response.ok) {
      throw new Error(
        `Adaptive fetch failed: ${response.status} for ${listUrl}`,
      );
    }

    const html = await response.text();
    const meetings: Meeting[] = [];

    // Apply the meeting selector regex
    const { pattern, groups } = config.meetingList.meetingSelector;
    const regex = new RegExp(pattern, "gi");
    let match;

    while ((match = regex.exec(html)) !== null) {
      const id = match[groups.id];
      const url = match[groups.url];
      const title =
        groups.title !== undefined ? match[groups.title]?.trim() : undefined;
      const dateRaw =
        groups.date !== undefined ? match[groups.date] : undefined;
      const organ =
        groups.organ !== undefined ? match[groups.organ]?.trim() : undefined;

      if (!id || !url) continue;

      // Filter by protocol indicators if configured.
      // Use a ±500 char window around the match for context, since indicators
      // may appear before the link (OnCloudOS: class="protocol") or after it.
      if (config.meetingList.protocolIndicators.length > 0) {
        const windowStart = Math.max(0, match.index - 500);
        const windowEnd = Math.min(
          html.length,
          match.index + match[0].length + 500,
        );
        const context = html.slice(windowStart, windowEnd);
        const hasIndicator = config.meetingList.protocolIndicators.some(
          (indicator) =>
            context.toLowerCase().includes(indicator.toLowerCase()),
        );
        if (!hasIndicator) continue;
      }

      let date = dateRaw
        ? parseDate(dateRaw, config.meetingList.dateFormat)
        : undefined;

      // If no date from regex, try to extract from surrounding context (±200 chars).
      // Dynasty/OnCloudOS has dates in adjacent <td> cells or aria-labels.
      if (!date) {
        const ctxStart = Math.max(0, match.index - 200);
        const ctxEnd = Math.min(
          html.length,
          match.index + match[0].length + 200,
        );
        const nearby = html.slice(ctxStart, ctxEnd);
        const dateInContext = nearby.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
        if (dateInContext) {
          date = parseDate(dateInContext[1], config.meetingList.dateFormat);
        }
      }

      // Decode &amp; → & in URLs (common in Dynasty HTML attributes)
      const decodedUrl = url.replace(/&amp;/g, "&");
      const resolvedUrl = decodedUrl.startsWith("http")
        ? decodedUrl
        : new URL(decodedUrl, listUrl).toString();

      // Try to extract organ name from context (Dynasty: preceding <td> with organ link)
      let resolvedOrgan = organ;
      if (!resolvedOrgan) {
        const ctxStart = Math.max(0, match.index - 500);
        const organContext = html.slice(ctxStart, match.index);
        const organMatch = organContext.match(
          /page=meetings[^>]*>([^<]+)<\/a>/i,
        );
        if (organMatch) {
          resolvedOrgan = organMatch[1]
            .replace(/&ouml;/g, "ö")
            .replace(/&auml;/g, "ä")
            .replace(/&amp;/g, "&")
            .trim();
        }
      }

      meetings.push({
        id,
        pageUrl: resolvedUrl,
        title:
          title ||
          (resolvedOrgan ? `${resolvedOrgan} ${date || id}` : `Kokous ${id}`),
        date,
        organ: resolvedOrgan,
      });
    }

    console.log(`   [adaptive] Found ${meetings.length} meetings`);
    return meetings.slice(0, config.meetingList.maxMeetings);
  },

  async extractContent(
    meeting: Meeting,
    source: MinuteSource,
  ): Promise<string | null> {
    if (!source.configId) return null;

    const loaded = await getConfig(source.configId);
    if (!loaded) return null;

    const { config, fetcherOptions } = loaded;
    const origin = new URL(source.url).origin;
    const pathPrefix = fetcherOptions?.pathPrefix || "";
    const { strategy } = config.contentExtraction;
    const baseUrlNoQuery = source.url.split("?")[0];

    const templateVars = {
      origin,
      pathPrefix,
      meetingId: meeting.id,
      baseUrl: source.url,
      baseUrlNoQuery,
    };

    // ---- Strategy: PDF ----
    if (strategy === "pdf" || strategy === "pdf-with-html-fallback") {
      const text = await extractPdf(meeting, config, templateVars);
      if (text) return applyTextCleaning(text, config);
      if (strategy === "pdf") return null;
      // Fall through to HTML for pdf-with-html-fallback
    }

    // ---- Strategy: HTML ----
    if (strategy === "html" || strategy === "pdf-with-html-fallback") {
      const text = await extractHtml(meeting, config, source, templateVars);
      if (text) return applyTextCleaning(text, config);
      return null;
    }

    // ---- Strategy: API ----
    if (strategy === "api" && config.contentExtraction.api) {
      const text = await extractApi(meeting, config, templateVars);
      if (text) return applyTextCleaning(text, config);
      return null;
    }

    return null;
  },
};

// ============================================
// Extraction Strategies
// ============================================

async function extractPdf(
  meeting: Meeting,
  config: FetcherConfig,
  vars: Record<string, string>,
): Promise<string | null> {
  const pdfConfig = config.contentExtraction.pdf;
  if (!pdfConfig) return null;

  try {
    let pdfUrl: string | null = null;

    if (pdfConfig.urlTemplate) {
      // Construct PDF URL from template
      pdfUrl = resolveUrlTemplate(pdfConfig.urlTemplate, vars);
    } else if (pdfConfig.linkPattern) {
      // Find PDF link on the meeting page
      const response = await rateLimitedFetch(meeting.pageUrl);
      if (!response.ok) return null;
      const html = await response.text();

      const linkRegex = new RegExp(pdfConfig.linkPattern, "i");
      const linkMatch = html.match(linkRegex);
      if (!linkMatch) return null;

      pdfUrl = linkMatch[1];
      if (pdfUrl && !pdfUrl.startsWith("http")) {
        pdfUrl = new URL(pdfUrl, meeting.pageUrl).toString();
      }
    }

    if (!pdfUrl) return null;
    console.log(`   [adaptive] Trying PDF: ${pdfUrl}`);

    const response = await rateLimitedFetch(pdfUrl);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("pdf") && !contentType.includes("octet-stream"))
      return null;

    const arrayBuffer = await response.arrayBuffer();
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: arrayBuffer });
    const result = await parser.getText();

    console.log(`   [adaptive] Extracted ${result.text.length} chars from PDF`);
    return result.text;
  } catch (err) {
    console.log(
      `   [adaptive] PDF extraction failed: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }
}

async function extractHtml(
  meeting: Meeting,
  config: FetcherConfig,
  _source: MinuteSource,
  vars: Record<string, string>,
): Promise<string | null> {
  const htmlConfig = config.contentExtraction.html;
  if (!htmlConfig) return null;

  try {
    // Fetch meeting page
    const response = await rateLimitedFetch(meeting.pageUrl);
    if (!response.ok) return null;
    const html = await response.text();

    // If we have item patterns, fetch individual items
    if (htmlConfig.itemPattern) {
      const itemRegex = new RegExp(htmlConfig.itemPattern, "gi");
      const items: { id: string; title: string }[] = [];
      let match;

      while ((match = itemRegex.exec(html)) !== null) {
        items.push({ id: match[1], title: match[2]?.trim() || "" });
      }

      if (items.length > 0) {
        const contentParts: string[] = [];

        for (const item of items) {
          const itemVars = { ...vars, itemId: item.id };
          const itemUrl = htmlConfig.itemUrlTemplate
            ? resolveUrlTemplate(htmlConfig.itemUrlTemplate, itemVars)
            : null;

          if (!itemUrl) continue;

          try {
            const resolvedItemUrl = itemUrl.startsWith("http")
              ? itemUrl
              : new URL(itemUrl, meeting.pageUrl).toString();
            const itemResponse = await rateLimitedFetch(resolvedItemUrl);
            if (!itemResponse.ok) continue;

            const contentType = itemResponse.headers.get("content-type") || "";

            let text: string | null = null;
            if (
              contentType.includes("pdf") ||
              contentType.includes("octet-stream")
            ) {
              // Item URL returns a PDF — extract text with pdf-parse
              try {
                const arrayBuffer = await itemResponse.arrayBuffer();
                const { PDFParse } = await import("pdf-parse");
                const parser = new PDFParse({ data: arrayBuffer });
                const result = await parser.getText();
                text = result.text;
              } catch {
                // PDF parse failed, skip
              }
            } else {
              const itemHtml = await itemResponse.text();
              text = extractContentFromHtml(itemHtml, htmlConfig);
            }

            if (text && text.length > 20) {
              contentParts.push(`§ ${item.title}\n\n${text}`);
            }
          } catch {
            // Skip failed items
          }
        }

        if (contentParts.length > 0) {
          return contentParts.join("\n\n---\n\n");
        }
      }
    }

    // Fallback: extract content directly from meeting page
    const text = extractContentFromHtml(html, htmlConfig);
    return text && text.length > 100 ? text : null;
  } catch (err) {
    console.log(
      `   [adaptive] HTML extraction failed: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }
}

function extractContentFromHtml(
  html: string,
  htmlConfig: NonNullable<FetcherConfig["contentExtraction"]["html"]>,
): string | null {
  // Try content patterns first (regex-based)
  if (htmlConfig.contentPatterns) {
    for (const pattern of htmlConfig.contentPatterns) {
      try {
        const regex = new RegExp(pattern, "is");
        const match = html.match(regex);
        if (match?.[1]) {
          return stripHtml(match[1]);
        }
      } catch {
        // Skip invalid patterns
      }
    }
  }

  // Try CSS-like selectors (simplified: class and tag matching)
  if (htmlConfig.contentSelectors) {
    for (const selector of htmlConfig.contentSelectors) {
      const content = simpleSelect(html, selector);
      if (content) {
        return stripHtml(content);
      }
    }
  }

  // Last resort: extract body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return stripHtml(bodyMatch[1]);
  }

  return null;
}

/**
 * Simplified CSS selector matching for common patterns:
 * - 'div.content' → <div class="...content...">...</div>
 * - 'article' → <article>...</article>
 * - 'main' → <main>...</main>
 * - '#id' → <... id="id">...</...>
 */
function simpleSelect(html: string, selector: string): string | null {
  let pattern: string;

  if (selector.startsWith("#")) {
    // ID selector
    const id = selector.slice(1);
    pattern = `<[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)</`;
  } else if (selector.includes(".")) {
    // Tag.class selector
    const [tag, className] = selector.split(".");
    pattern = `<${tag || "[^>]+"}[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)</${tag || "[^>]+"}`;
  } else {
    // Simple tag selector
    pattern = `<${selector}[^>]*>([\\s\\S]*?)</${selector}>`;
  }

  try {
    const regex = new RegExp(pattern, "i");
    const match = html.match(regex);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

async function extractApi(
  meeting: Meeting,
  config: FetcherConfig,
  vars: Record<string, string>,
): Promise<string | null> {
  const apiConfig = config.contentExtraction.api;
  if (!apiConfig) return null;

  try {
    const url = resolveUrlTemplate(apiConfig.endpoint, {
      ...vars,
      meetingId: meeting.id,
    });
    console.log(`   [adaptive] Fetching API: ${url}`);

    const response = await rateLimitedFetch(url, {
      method: apiConfig.method,
      headers: apiConfig.headers,
    });

    if (!response.ok) return null;

    if (apiConfig.responseFormat === "json") {
      const data = await response.json();
      // Simple JSONPath-like extraction: "data.content" → data['data']['content']
      const parts = apiConfig.contentPath.split(".");
      let value: unknown = data;
      for (const part of parts) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[part];
        } else {
          return null;
        }
      }
      return typeof value === "string" ? stripHtml(value) : null;
    }

    // XML: just strip tags
    const text = await response.text();
    return stripHtml(text);
  } catch (err) {
    console.log(
      `   [adaptive] API extraction failed: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }
}

// ============================================
// Utility: Load adaptive sources from DB
// ============================================

export async function loadAdaptiveSourcesFromDb(): Promise<MinuteSource[]> {
  const configs = await scraperDb
    .select()
    .from(scraperConfigs)
    .where(eq(scraperConfigs.status, "active"));

  return configs.map((c: typeof scraperConfigs.$inferSelect) => ({
    municipality: c.entityName || c.municipalityName,
    entityName: c.entityName || c.municipalityName,
    adminLevel: c.adminLevel as AdminLevel,
    type: "adaptive",
    url: c.baseUrl,
    country: c.country,
    language: c.contentLanguage,
    configId: c.id,
    region: (c.fetcherOptions as Record<string, string> | null)?.region,
    pathPrefix: (c.fetcherOptions as Record<string, string> | null)?.pathPrefix,
    pdfBasePath: (c.fetcherOptions as Record<string, string> | null)
      ?.pdfBasePath,
  }));
}
