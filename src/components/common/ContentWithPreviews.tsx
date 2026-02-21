import { useMemo } from "react";
import { sanitizeContent } from "../../utils/sanitize";
import { LinkPreview } from "./LinkPreview";

interface ContentWithPreviewsProps {
  html: string;
  className?: string;
}

// Extract link-preview URLs from HTML string (no DOM parsing needed)
const LINK_PREVIEW_REGEX = /class="link-preview"\s+data-url="([^"]+)"/g;

export function ContentWithPreviews({
  html,
  className,
}: ContentWithPreviewsProps) {
  const sanitizedHtml = useMemo(() => sanitizeContent(html), [html]);

  // Extract preview URLs from the sanitized HTML
  const previewUrls = useMemo(() => {
    const urls: string[] = [];
    let match;
    const regex = new RegExp(LINK_PREVIEW_REGEX.source, "g");
    while ((match = regex.exec(sanitizedHtml)) !== null) {
      // Decode HTML entities in the URL
      const url = match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"');
      urls.push(url);
    }
    return urls;
  }, [sanitizedHtml]);

  // Remove the placeholder divs from the HTML since we render previews separately
  const cleanHtml = useMemo(() => {
    return sanitizedHtml.replace(/<div class="link-preview"[^>]*><\/div>/g, "");
  }, [sanitizedHtml]);

  return (
    <>
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
      {previewUrls.map((url) => (
        <LinkPreview key={url} url={url} />
      ))}
    </>
  );
}
