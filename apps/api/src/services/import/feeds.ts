/**
 * RSS/Atom Feed Parser
 *
 * Generic feed parser for importing content from RSS and Atom feeds.
 * Used by ministry and EU import services.
 */

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
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
  });
}

export interface FeedItem {
  id: string; // Unique identifier (guid or link)
  title: string;
  description: string; // Summary/description text
  link: string; // URL to full article
  pubDate: Date;
  author?: string;
  categories?: string[];
}

export interface FeedResult {
  title: string;
  items: FeedItem[];
}

/**
 * Parse an RSS or Atom feed from a URL
 */
export async function parseFeed(
  feedUrl: string,
  limit = 20,
): Promise<FeedResult> {
  const response = await rateLimitedFetch(feedUrl);
  if (!response.ok) {
    throw new Error(
      `Feed fetch failed: ${response.status} ${response.statusText} for ${feedUrl}`,
    );
  }

  const xml = await response.text();

  // Detect feed type and parse
  if (
    xml.includes("<feed") &&
    xml.includes('xmlns="http://www.w3.org/2005/Atom"')
  ) {
    return parseAtom(xml, limit);
  }
  return parseRss(xml, limit);
}

/**
 * Parse RSS 2.0 feed
 */
function parseRss(xml: string, limit: number): FeedResult {
  const feedTitle =
    extractTag(xml, "channel>title") ||
    extractTag(xml, "title") ||
    "Unknown Feed";

  const items: FeedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const itemXml = match[1];

    const title = decodeXmlEntities(extractTag(itemXml, "title") || "");
    const description = decodeXmlEntities(
      stripHtml(extractTag(itemXml, "description") || ""),
    );
    const link = extractTag(itemXml, "link") || "";
    const guid = extractTag(itemXml, "guid") || link;
    const pubDateStr = extractTag(itemXml, "pubDate");
    const author =
      extractTag(itemXml, "dc:creator") || extractTag(itemXml, "author");

    // Extract categories
    const categories: string[] = [];
    const catRegex = /<category[^>]*>([^<]+)<\/category>/gi;
    let catMatch;
    while ((catMatch = catRegex.exec(itemXml)) !== null) {
      categories.push(decodeXmlEntities(catMatch[1].trim()));
    }

    if (title && link) {
      items.push({
        id: guid || link,
        title,
        description: description.slice(0, 5000),
        link,
        pubDate: pubDateStr ? new Date(pubDateStr) : new Date(),
        author: author ? decodeXmlEntities(author) : undefined,
        categories: categories.length > 0 ? categories : undefined,
      });
    }
  }

  return { title: decodeXmlEntities(feedTitle), items };
}

/**
 * Parse Atom feed
 */
function parseAtom(xml: string, limit: number): FeedResult {
  const feedTitle = extractTag(xml, "title") || "Unknown Feed";

  const items: FeedItem[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = entryRegex.exec(xml)) !== null && items.length < limit) {
    const entryXml = match[1];

    const title = decodeXmlEntities(extractTag(entryXml, "title") || "");
    const summary = decodeXmlEntities(
      stripHtml(
        extractTag(entryXml, "summary") ||
          extractTag(entryXml, "content") ||
          "",
      ),
    );
    const id = extractTag(entryXml, "id") || "";

    // Atom link: <link href="..." />
    const linkMatch = entryXml.match(
      /<link[^>]*href="([^"]+)"[^>]*(?:rel="alternate")?/i,
    );
    const link = linkMatch ? linkMatch[1] : id;

    const updatedStr =
      extractTag(entryXml, "updated") || extractTag(entryXml, "published");
    const author = extractTag(entryXml, "name"); // Inside <author><name>

    // Extract categories from <category term="...">
    const categories: string[] = [];
    const catRegex = /<category[^>]*term="([^"]+)"/gi;
    let catMatch;
    while ((catMatch = catRegex.exec(entryXml)) !== null) {
      categories.push(decodeXmlEntities(catMatch[1].trim()));
    }

    if (title && link) {
      items.push({
        id: id || link,
        title,
        description: summary.slice(0, 5000),
        link,
        pubDate: updatedStr ? new Date(updatedStr) : new Date(),
        author: author ? decodeXmlEntities(author) : undefined,
        categories: categories.length > 0 ? categories : undefined,
      });
    }
  }

  return { title: decodeXmlEntities(feedTitle), items };
}

/**
 * Extract text content from an XML tag
 */
function extractTag(xml: string, tagName: string): string | null {
  // Handle CDATA
  const cdataRegex = new RegExp(
    `<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>`,
    "i",
  );
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Decode common XML entities
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

/**
 * Fetch the full text content from an article page
 * Extracts the main text, stripping navigation, scripts, etc.
 */
export async function fetchArticleContent(url: string): Promise<string> {
  const response = await rateLimitedFetch(url);
  if (!response.ok) {
    throw new Error(`Article fetch failed: ${response.status} for ${url}`);
  }

  const html = await response.text();

  // Try to extract main content area
  // Priority: <article>, <main>, role="main", .content, .article-body
  const contentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*role="main"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match) {
      return stripHtml(match[1]).slice(0, 15000);
    }
  }

  // Fallback: strip entire body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return stripHtml(bodyMatch[1]).slice(0, 15000);
  }

  return stripHtml(html).slice(0, 15000);
}
