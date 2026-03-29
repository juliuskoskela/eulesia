import { AlertTriangle, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({
  title,
  description,
  onRetry,
  compact = false,
}: ErrorStateProps) {
  const { t } = useTranslation();

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <p className="text-sm text-red-700 dark:text-red-300 flex-1">
          {description || t("errorPages.error.description")}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            {t("errorPages.reload")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-300" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {title || t("errorPages.error.title")}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm mb-6">
        {description || t("errorPages.error.description")}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <RotateCcw className="w-4 h-4" />
          {t("errorPages.reload")}
        </button>
      )}
    </div>
  );
}
