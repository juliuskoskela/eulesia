import { CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ContentEndMarkerProps {
  message?: string;
}

export function ContentEndMarker({ message }: ContentEndMarkerProps) {
  const { t } = useTranslation();

  return (
    <div className="py-8 text-center border-t border-gray-200 dark:border-gray-800 mt-4">
      <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <span className="text-sm font-medium">
          {message ?? t("contentEnd.upToDate")}
        </span>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        {t("contentEnd.noMore")}
      </p>
    </div>
  );
}
