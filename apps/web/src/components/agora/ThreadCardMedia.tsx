import { useMemo } from "react";
import { useLinkPreview } from "../../hooks/useApi";
import { ExternalLink } from "lucide-react";

interface ThreadCardMediaProps {
  contentHtml: string;
}

// Regex patterns to extract media from contentHtml
const YOUTUBE_REGEX =
  /src="https:\/\/www\.youtube-nocookie\.com\/embed\/([^"]+)"/g;
const IMAGE_REGEX =
  /<img[^>]+src="([^"]+)"[^>]*class="(?:embedded-image|uploaded-image)"[^>]*>/g;
const IMAGE_SRC_ALT_REGEX =
  /<img[^>]+class="(?:embedded-image|uploaded-image)"[^>]*src="([^"]+)"[^>]*>/g;
const LINK_PREVIEW_REGEX = /class="link-preview"\s+data-url="([^"]+)"/g;

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

/**
 * Compact inline link preview for ThreadCard (no nested <a> tags).
 * Uses a div with onClick to open the URL so it can live inside
 * the parent <Link> without invalid HTML nesting.
 */
function InlineCardPreview({ url }: { url: string }) {
  const { data, isLoading, isError } = useLinkPreview(url);

  if (isLoading) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden animate-pulse">
        <div className="flex">
          <div className="flex-1 p-2.5 space-y-1.5">
            <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          </div>
          <div className="w-20 h-16 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
        </div>
      </div>
    );
  }

  if (isError || !data) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as any);
        }
      }}
      className="border border-gray-200 rounded-lg overflow-hidden hover:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="flex">
        <div className="flex-1 p-2.5 min-w-0">
          {/* Site name / favicon */}
          <div className="flex items-center gap-1.5 mb-0.5">
            {data.faviconUrl && (
              <img
                src={data.faviconUrl}
                alt=""
                className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {data.siteName || new URL(url).hostname}
            </span>
            <ExternalLink className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
          </div>
          {/* Title */}
          {data.title && (
            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-1 leading-snug">
              {data.title}
            </p>
          )}
          {/* Description */}
          {data.description && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5 leading-relaxed">
              {data.description}
            </p>
          )}
        </div>
        {/* Image */}
        {data.imageUrl && (
          <div className="w-20 flex-shrink-0 bg-gray-100 dark:bg-gray-800">
            <img
              src={data.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.style.display =
                  "none";
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function ThreadCardMedia({ contentHtml }: ThreadCardMediaProps) {
  const media = useMemo(() => {
    const youtubeIds: string[] = [];
    const imageUrls: string[] = [];
    const linkPreviewUrls: string[] = [];

    // Extract YouTube video IDs
    let match;
    const ytRegex = new RegExp(YOUTUBE_REGEX.source, "g");
    while ((match = ytRegex.exec(contentHtml)) !== null) {
      youtubeIds.push(match[1].split("?")[0]); // Remove query params
    }

    // Extract image URLs (try both attribute orders)
    const imgRegex1 = new RegExp(IMAGE_REGEX.source, "g");
    while ((match = imgRegex1.exec(contentHtml)) !== null) {
      imageUrls.push(decodeHtmlEntities(match[1]));
    }
    const imgRegex2 = new RegExp(IMAGE_SRC_ALT_REGEX.source, "g");
    while ((match = imgRegex2.exec(contentHtml)) !== null) {
      const url = decodeHtmlEntities(match[1]);
      if (!imageUrls.includes(url)) {
        imageUrls.push(url);
      }
    }

    // Extract link preview URLs
    const lpRegex = new RegExp(LINK_PREVIEW_REGEX.source, "g");
    while ((match = lpRegex.exec(contentHtml)) !== null) {
      linkPreviewUrls.push(decodeHtmlEntities(match[1]));
    }

    return { youtubeIds, imageUrls, linkPreviewUrls };
  }, [contentHtml]);

  const hasMedia =
    media.youtubeIds.length > 0 ||
    media.imageUrls.length > 0 ||
    media.linkPreviewUrls.length > 0;

  if (!hasMedia) return null;

  return (
    <div className="mt-1 mb-2">
      {/* YouTube thumbnails */}
      {media.youtubeIds.length > 0 && (
        <div className="flex gap-2 mb-2">
          {media.youtubeIds.slice(0, 2).map((videoId) => (
            <div
              key={videoId}
              className="relative rounded-lg overflow-hidden bg-gray-100 flex-shrink-0"
              style={{
                width: "100%",
                maxWidth: media.youtubeIds.length === 1 ? "100%" : "50%",
              }}
            >
              <div className="relative" style={{ paddingBottom: "56.25%" }}>
                <img
                  src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                  alt="YouTube video"
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 bg-red-600 bg-opacity-90 rounded-full flex items-center justify-center shadow-lg">
                    <svg
                      className="w-5 h-5 text-white ml-0.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Embedded images */}
      {media.imageUrls.length > 0 && (
        <div
          className={`mb-2 ${media.imageUrls.length > 1 ? "grid grid-cols-2 gap-1.5" : ""} rounded-lg overflow-hidden`}
        >
          {media.imageUrls.slice(0, 4).map((url, i) => (
            <div
              key={url}
              className={`relative bg-gray-100 overflow-hidden ${media.imageUrls.length === 1 ? "rounded-lg" : "rounded"}`}
              style={{
                maxHeight: media.imageUrls.length === 1 ? "240px" : "140px",
              }}
            >
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display =
                    "none";
                }}
              />
              {/* Show count overlay on last image if more than 4 */}
              {i === 3 && media.imageUrls.length > 4 && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">
                    +{media.imageUrls.length - 4}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Link preview — show only first one in card, using div instead of <a> to avoid nested links */}
      {media.linkPreviewUrls.length > 0 && (
        <InlineCardPreview url={media.linkPreviewUrls[0]} />
      )}
    </div>
  );
}
