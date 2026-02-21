import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface BookmarkButtonProps {
  threadId: string;
  isBookmarked?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function BookmarkButton({
  threadId,
  isBookmarked: initialBookmarked = false,
  size = "sm",
  className = "",
}: BookmarkButtonProps) {
  const { currentUser } = useAuth();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isLoading, setIsLoading] = useState(false);

  if (!currentUser) return null;

  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;

    setIsLoading(true);
    try {
      if (bookmarked) {
        await api.removeBookmark(threadId);
        setBookmarked(false);
      } else {
        await api.addBookmark(threadId);
        setBookmarked(true);
      }
    } catch (err) {
      console.error("Bookmark toggle failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`transition-colors ${
        bookmarked
          ? "text-amber-500 hover:text-amber-600"
          : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      } ${isLoading ? "opacity-50" : ""} ${className}`}
      title={bookmarked ? "Poista kirjanmerkki" : "Lisää kirjanmerkki"}
    >
      {bookmarked ? (
        <BookmarkCheck className={iconSize} />
      ) : (
        <Bookmark className={iconSize} />
      )}
    </button>
  );
}
