import { useState } from "react";
import { HelpCircle, X, TrendingUp, Shield, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CvsBreakdown } from "../../lib/api";

interface ScoreBreakdownProps {
  score: number;
  breakdown: CvsBreakdown;
  className?: string;
}

export function ScoreBreakdown({
  score,
  breakdown,
  className = "",
}: ScoreBreakdownProps) {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
        title={t("discover.whyShown")}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
            }}
          />

          {/* Popup */}
          <div
            className="absolute bottom-full right-0 mb-2 w-72 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t("discover.whyShown")}
              </h4>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {/* Engagement */}
              <div className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {t("discover.engagement")}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {breakdown.engagement.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Source quality */}
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {t("discover.sourceQuality")}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    &times;{breakdown.sourceQuality.toFixed(1)}
                    {breakdown.sourceQuality > 1.0 && (
                      <span className="ml-1 text-blue-500">
                        (
                        {breakdown.sourceQuality >= 1.5
                          ? t("discover.sourceMinutes")
                          : breakdown.sourceQuality >= 1.3
                            ? t("discover.sourceRss")
                            : breakdown.sourceQuality >= 1.2
                              ? t("discover.sourceInstitution")
                              : t("discover.sourceVerified")}
                        )
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Freshness */}
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {t("discover.freshness")}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {(breakdown.freshness * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {t("discover.totalScore")}
                  </span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {score.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Learn more */}
              <a
                href="/tutustu/algoritmi"
                className="block text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 mt-1"
                onClick={(e) => e.stopPropagation()}
              >
                {t("discover.learnMore")} &rarr;
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
