/**
 * Tweb (Triplan) Minute Fetcher
 *
 * Fetches meeting minutes from the public Tweb ktwebbin interface.
 * Used by 15-20+ Finnish municipalities.
 *
 * IMPORTANT: Uses the PUBLIC interface at [kunta].tweb.fi/ktwebbin/
 * NOT the authenticated twebportaali.fi system.
 *
 * URL hierarchy:
 * - /dbisa.dll/ktwebscr/pk_tek_tweb.htm           → Search page
 * - /dbisa.dll/ktwebscr/pk_asil_tweb.htm?+bid=XXX → Meeting agenda
 * - /ktproxy2.dll?doctype=3&docid=XXXXXX           → Individual item content
 *
 * Content is available as HTML directly — no PDF parsing needed.
 */

import type { MinuteFetcher, MinuteSource, Meeting } from "./types.js";

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
  return fetch(url);
}

/**
 * Strip HTML tags and decode entities
 */
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

// ============================================
// Tweb Municipality Configuration
// ============================================

export const TWEB_SOURCES: MinuteSource[] = [
  {
    municipality: "Uurainen",
    type: "tweb",
    url: "https://uurainen.tweb.fi/ktwebbin",
  },
];

// ============================================
// Tweb Fetcher Implementation
// ============================================

export const twebFetcher: MinuteFetcher = {
  type: "tweb",

  async fetchMeetings(source: MinuteSource): Promise<Meeting[]> {
    // Fetch the search page which often lists recent meetings
    const searchUrl = `${source.url}/dbisa.dll/ktwebscr/pk_tek_tweb.htm`;
    console.log(`   Fetching: ${searchUrl}`);

    const response = await rateLimitedFetch(searchUrl);
    if (!response.ok) {
      throw new Error(`Tweb fetch failed: ${response.status} for ${searchUrl}`);
    }
    const html = await response.text();

    const meetings: Meeting[] = [];

    // Parse the search page / results for meeting links
    // Tweb lists meetings as links to pk_asil_tweb.htm?+bid=XXXX
    const meetingRegex = /pk_asil_tweb\.htm\?\+bid=(\d+)[^"]*"[^>]*>([^<]*)/gi;
    let match;

    while ((match = meetingRegex.exec(html)) !== null) {
      const bid = match[1];
      const linkText = match[2].trim();

      // Extract date from link text (Finnish format: DD.MM.YYYY)
      const dateMatch = linkText.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
      const date = dateMatch ? dateMatch[1] : undefined;

      meetings.push({
        id: `tweb-${bid}`,
        pageUrl: `${source.url}/dbisa.dll/ktwebscr/pk_asil_tweb.htm?+bid=${bid}`,
        title: linkText || `Kokous ${bid}`,
        date,
        organ: linkText.split(/\s+\d/).at(0)?.trim(),
      });
    }

    // If direct parsing didn't work, try to POST the search form
    // to get recent meetings (no date filter = all recent)
    if (meetings.length === 0) {
      console.log(`   Trying POST search for recent meetings...`);

      try {
        const postResponse = await rateLimitedFetch(searchUrl);
        const postHtml = await postResponse.text();

        // Look for any meeting links in the response
        const altRegex = /bid=(\d+)/g;
        const seenBids = new Set<string>();
        let altMatch;

        while ((altMatch = altRegex.exec(postHtml)) !== null) {
          const bid = altMatch[1];
          if (seenBids.has(bid)) continue;
          seenBids.add(bid);

          meetings.push({
            id: `tweb-${bid}`,
            pageUrl: `${source.url}/dbisa.dll/ktwebscr/pk_asil_tweb.htm?+bid=${bid}`,
            title: `Kokous ${bid}`,
          });
        }
      } catch {
        // Search POST failed, return empty
      }
    }

    console.log(`   Found ${meetings.length} pöytäkirjat`);
    return meetings.slice(0, 10);
  },

  async extractContent(
    meeting: Meeting,
    source: MinuteSource,
  ): Promise<string | null> {
    // Fetch the meeting agenda page
    console.log(`   Fetching agenda: ${meeting.pageUrl}`);

    const response = await rateLimitedFetch(meeting.pageUrl);
    if (!response.ok) {
      return null;
    }
    const html = await response.text();

    // Parse agenda items: links to ktproxy2.dll?doctype=3&docid=XXXXX
    const itemRegex =
      /ktproxy2\.dll\?doctype=3&(?:amp;)?docid=(\d+)[^"]*"[^>]*>([^<]*)/gi;
    const items: { id: string; title: string }[] = [];
    let match;

    while ((match = itemRegex.exec(html)) !== null) {
      items.push({
        id: match[1],
        title: match[2].trim(),
      });
    }

    // Also look for items with different doctype patterns
    if (items.length === 0) {
      const altRegex = /ktproxy2\.dll\?[^"]*docid=(\d+)[^"]*"[^>]*>([^<]*)/gi;
      let altMatch;
      while ((altMatch = altRegex.exec(html)) !== null) {
        items.push({
          id: altMatch[1],
          title: altMatch[2].trim(),
        });
      }
    }

    if (items.length === 0) {
      // Try to extract content directly from the agenda page itself
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        const text = stripHtml(bodyMatch[1]);
        return text.length > 100 ? text : null;
      }
      return null;
    }

    // Fetch each item's HTML content
    const contentParts: string[] = [];

    for (const item of items) {
      const itemUrl = `${source.url}/ktproxy2.dll?doctype=3&docid=${item.id}`;

      try {
        const itemResponse = await rateLimitedFetch(itemUrl);
        if (!itemResponse.ok) continue;

        const itemHtml = await itemResponse.text();
        const text = stripHtml(itemHtml);

        if (text.length > 20) {
          contentParts.push(`§ ${item.title}\n\n${text}`);
        }
      } catch {
        // Skip failed items
      }
    }

    if (contentParts.length === 0) {
      return null;
    }

    return contentParts.join("\n\n---\n\n");
  },
};
