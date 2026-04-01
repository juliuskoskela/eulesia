import { Router, type Request, type Response } from "express";
import dns from "dns/promises";
import { db, linkPreviews } from "../db/index.js";
import { eq } from "drizzle-orm";

const router = Router();

// Cache TTL: 7 days
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// SSRF protection: block internal IPs
function isInternalUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Block obvious internal hostnames
    if (hostname === "localhost" || hostname === "0.0.0.0") return true;

    // Block internal IP ranges
    const parts = hostname.split(".");
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const first = parseInt(parts[0]);
      const second = parseInt(parts[1]);
      if (first === 127) return true; // 127.x.x.x
      if (first === 10) return true; // 10.x.x.x
      if (first === 172 && second >= 16 && second <= 31) return true; // 172.16-31.x.x
      if (first === 192 && second === 168) return true; // 192.168.x.x
      if (first === 169 && second === 254) return true; // 169.254.x.x (link-local)
      if (first === 0) return true; // 0.x.x.x
    }

    // Block IPv6 loopback
    if (hostname === "[::1]" || hostname === "::1") return true;

    return false;
  } catch {
    return true;
  }
}

// Check if a resolved IP address is internal/private
function isInternalIp(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const first = parseInt(parts[0]);
    const second = parseInt(parts[1]);
    if (first === 127) return true;
    if (first === 10) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first === 192 && second === 168) return true;
    if (first === 169 && second === 254) return true;
    if (first === 0) return true;
  }
  // IPv6 loopback
  if (
    ip === "::1" ||
    ip === "::" ||
    ip.startsWith("fe80:") ||
    ip.startsWith("fc00:") ||
    ip.startsWith("fd")
  )
    return true;
  return false;
}

// Resolve hostname and check if it points to an internal IP (DNS rebinding protection)
async function resolvesToInternalIp(hostname: string): Promise<boolean> {
  try {
    const addresses = await dns.resolve4(hostname);
    for (const addr of addresses) {
      if (isInternalIp(addr)) return true;
    }
  } catch {
    // If DNS resolution fails, allow the request — the fetch will fail anyway
  }
  try {
    const addresses = await dns.resolve6(hostname);
    for (const addr of addresses) {
      if (isInternalIp(addr)) return true;
    }
  } catch {
    // IPv6 resolution failure is fine
  }
  return false;
}

// Parse OG metadata from HTML
function parseOgMetadata(html: string, baseUrl: string) {
  const getMetaContent = (property: string): string | null => {
    // Match both property="og:..." and name="..." patterns
    const patterns = [
      new RegExp(
        `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return decodeHtmlEntities(match[1]);
    }
    return null;
  };

  const getNameContent = (name: string): string | null => {
    const patterns = [
      new RegExp(
        `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return decodeHtmlEntities(match[1]);
    }
    return null;
  };

  // Extract title
  let title = getMetaContent("og:title");
  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;
  }

  // Extract description
  let description = getMetaContent("og:description");
  if (!description) {
    description = getNameContent("description");
  }
  // Truncate description
  if (description && description.length > 300) {
    description = description.substring(0, 297) + "...";
  }

  // Extract image
  let imageUrl = getMetaContent("og:image");
  if (imageUrl && !imageUrl.startsWith("http")) {
    try {
      imageUrl = new URL(imageUrl, baseUrl).href;
    } catch {
      imageUrl = null;
    }
  }

  // Extract site name
  const siteName = getMetaContent("og:site_name");

  // Extract favicon
  let faviconUrl: string | null = null;
  const faviconMatch =
    html.match(
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
    );
  if (faviconMatch) {
    faviconUrl = faviconMatch[1];
    if (!faviconUrl.startsWith("http")) {
      try {
        faviconUrl = new URL(faviconUrl, baseUrl).href;
      } catch {
        faviconUrl = null;
      }
    }
  }
  if (!faviconUrl) {
    try {
      faviconUrl = new URL("/favicon.ico", baseUrl).href;
    } catch {
      // ignore
    }
  }

  return { title, description, imageUrl, siteName, faviconUrl };
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

// GET /link-preview?url=...
router.get("/link-preview", async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ success: false, error: "URL required" });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: "Invalid URL" });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res
        .status(400)
        .json({ success: false, error: "Only HTTP/HTTPS URLs supported" });
    }

    if (isInternalUrl(url)) {
      return res
        .status(400)
        .json({ success: false, error: "Internal URLs not allowed" });
    }

    // DNS resolution check — prevent domain-to-internal-IP bypass (SSRF)
    if (await resolvesToInternalIp(parsedUrl.hostname)) {
      return res
        .status(400)
        .json({ success: false, error: "Internal URLs not allowed" });
    }

    // Check cache
    const [cached] = await db
      .select()
      .from(linkPreviews)
      .where(eq(linkPreviews.url, url))
      .limit(1);

    if (cached) {
      const age = Date.now() - cached.fetchedAt.getTime();
      if (age < CACHE_TTL_MS) {
        if (cached.error) {
          return res
            .status(404)
            .json({ success: false, error: "Preview not available" });
        }
        return res.json({
          success: true,
          data: {
            url: cached.url,
            title: cached.title,
            description: cached.description,
            imageUrl: cached.imageUrl,
            siteName: cached.siteName,
            faviconUrl: cached.faviconUrl,
          },
        });
      }
    }

    // Fetch the URL
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "EulesiaBot/1.0 (+https://eulesia.org)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } catch {
      clearTimeout(timeout);
      // Cache the error
      await upsertPreview(url, { error: true });
      return res
        .status(404)
        .json({ success: false, error: "Failed to fetch URL" });
    }
    clearTimeout(timeout);

    // Verify content type
    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      await upsertPreview(url, { error: true });
      return res
        .status(404)
        .json({ success: false, error: "Not an HTML page" });
    }

    // Read body (max 1MB)
    const reader = response.body?.getReader();
    if (!reader) {
      await upsertPreview(url, { error: true });
      return res
        .status(404)
        .json({ success: false, error: "No response body" });
    }

    let html = "";
    const decoder = new TextDecoder();
    const MAX_SIZE = 1024 * 1024; // 1MB
    let totalSize = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.length;
      if (totalSize > MAX_SIZE) break;
      html += decoder.decode(value, { stream: true });
      // Stop early if we've found </head> — metadata is in <head>
      if (html.includes("</head>")) break;
    }
    reader.cancel();

    // Parse metadata
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    const metadata = parseOgMetadata(html, baseUrl);

    if (!metadata.title) {
      await upsertPreview(url, { error: true });
      return res
        .status(404)
        .json({ success: false, error: "No metadata found" });
    }

    // Cache
    await upsertPreview(url, {
      title: metadata.title,
      description: metadata.description,
      imageUrl: metadata.imageUrl,
      siteName: metadata.siteName,
      faviconUrl: metadata.faviconUrl,
      error: false,
    });

    return res.json({
      success: true,
      data: {
        url,
        title: metadata.title,
        description: metadata.description,
        imageUrl: metadata.imageUrl,
        siteName: metadata.siteName,
        faviconUrl: metadata.faviconUrl,
      },
    });
  } catch {
    return res.status(500).json({ success: false, error: "Internal error" });
  }
});

async function upsertPreview(
  url: string,
  data: {
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    siteName?: string | null;
    faviconUrl?: string | null;
    error?: boolean;
  },
) {
  await db
    .insert(linkPreviews)
    .values({
      url,
      title: data.title ?? null,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      siteName: data.siteName ?? null,
      faviconUrl: data.faviconUrl ?? null,
      error: data.error ?? false,
    })
    .onConflictDoUpdate({
      target: linkPreviews.url,
      set: {
        title: data.title ?? null,
        description: data.description ?? null,
        imageUrl: data.imageUrl ?? null,
        siteName: data.siteName ?? null,
        faviconUrl: data.faviconUrl ?? null,
        error: data.error ?? false,
        fetchedAt: new Date(),
      },
    });
}

export default router;
