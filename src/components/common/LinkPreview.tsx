import { useLinkPreview } from "../../hooks/useApi";
import { ExternalLink } from "lucide-react";

interface LinkPreviewProps {
  url: string;
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const { data, isLoading, isError } = useLinkPreview(url);

  if (isLoading) {
    return (
      <div className="my-2 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden animate-pulse">
        <div className="flex">
          <div className="flex-1 p-3 space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          </div>
          <div className="w-24 h-20 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
        </div>
      </div>
    );
  }

  if (isError || !data) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-2 block border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors no-underline"
    >
      <div className="flex">
        <div className="flex-1 p-3 min-w-0">
          {/* Site name / favicon */}
          <div className="flex items-center gap-1.5 mb-1">
            {data.faviconUrl && (
              <img
                src={data.faviconUrl}
                alt=""
                className="w-4 h-4 rounded-sm flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {data.siteName || new URL(url).hostname}
            </span>
            <ExternalLink className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          </div>
          {/* Title */}
          {data.title && (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
              {data.title}
            </p>
          )}
          {/* Description */}
          {data.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5 leading-relaxed">
              {data.description}
            </p>
          )}
        </div>
        {/* Image */}
        {data.imageUrl && (
          <div className="w-28 flex-shrink-0 bg-gray-100 dark:bg-gray-800">
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
    </a>
  );
}
