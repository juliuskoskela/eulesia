import { Link } from "react-router-dom";

interface TagListProps {
  tags: string[];
  onTagClick?: (tag: string) => void;
  size?: "sm" | "md";
  linkToTagPage?: boolean;
}

export function TagList({
  tags,
  onTagClick,
  size = "sm",
  linkToTagPage = true,
}: TagListProps) {
  const sizeClasses =
    size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const className = `${sizeClasses} bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`;

        if (linkToTagPage) {
          return (
            <Link
              key={tag}
              to={`/agora/tag/${encodeURIComponent(tag)}`}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(tag);
              }}
              className={className}
            >
              {tag.replace(/-/g, " ")}
            </Link>
          );
        }

        return (
          <button
            key={tag}
            onClick={() => onTagClick?.(tag)}
            className={className}
          >
            {tag.replace(/-/g, " ")}
          </button>
        );
      })}
    </div>
  );
}
