import { ChevronUp, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";

interface ThreadVoteButtonsProps {
  threadId: string;
  score: number;
  userVote: number;
  onVote: (value: number) => void;
  isLoading?: boolean;
  size?: "sm" | "md";
}

export function ThreadVoteButtons({
  score,
  userVote,
  onVote,
  isLoading = false,
  size = "md",
}: ThreadVoteButtonsProps) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();

  const handleUpvote = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser || isLoading) return;
    // Toggle: if already upvoted, remove vote, otherwise upvote
    onVote(userVote === 1 ? 0 : 1);
  };

  const handleDownvote = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser || isLoading) return;
    // Toggle: if already downvoted, remove vote, otherwise downvote
    onVote(userVote === -1 ? 0 : -1);
  };

  const sizeClasses = {
    sm: {
      container: "w-8",
      button: "p-1",
      icon: "w-4 h-4",
      score: "text-xs",
    },
    md: {
      container: "w-10",
      button: "p-1.5",
      icon: "w-5 h-5",
      score: "text-sm",
    },
  };

  const classes = sizeClasses[size];

  // Format score for display (e.g., 1.2k for 1200)
  const formatScore = (n: number): string => {
    if (n >= 1000) {
      return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }
    return n.toString();
  };

  return (
    <div className={`flex flex-col items-center ${classes.container}`}>
      {/* Upvote button */}
      <button
        onClick={handleUpvote}
        disabled={!currentUser || isLoading}
        className={`
          ${classes.button} rounded transition-colors
          ${
            userVote === 1
              ? "text-orange-500 bg-orange-50 dark:bg-orange-900/30"
              : "text-gray-400 dark:text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30"
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        aria-label={
          currentUser ? t("actions.upvote") : t("actions.loginToVote")
        }
        aria-pressed={userVote === 1}
      >
        <ChevronUp className={classes.icon} strokeWidth={2.5} />
      </button>

      {/* Score */}
      <span
        className={`
          ${classes.score} font-semibold tabular-nums
          ${userVote === 1 ? "text-orange-500" : userVote === -1 ? "text-blue-500" : "text-gray-700 dark:text-gray-300"}
        `}
        aria-label={t("actions.score", { score: formatScore(score) })}
      >
        {formatScore(score)}
      </span>

      {/* Downvote button */}
      <button
        onClick={handleDownvote}
        disabled={!currentUser || isLoading}
        className={`
          ${classes.button} rounded transition-colors
          ${
            userVote === -1
              ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30"
              : "text-gray-400 dark:text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30"
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        aria-label={
          currentUser ? t("actions.downvote") : t("actions.loginToVote")
        }
        aria-pressed={userVote === -1}
      >
        <ChevronDown className={classes.icon} strokeWidth={2.5} />
      </button>
    </div>
  );
}
