import { useTranslation } from "react-i18next";

interface GuideTooltipProps {
  title: string;
  description: string;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isFirst: boolean;
  isLast: boolean;
  position: { top: number; left: number };
  placement: "top" | "bottom" | "left" | "right";
}

export function GuideTooltip({
  title,
  description,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  isFirst,
  isLast,
  position,
  placement,
}: GuideTooltipProps) {
  const { t } = useTranslation("guide");

  // Arrow classes based on placement
  const arrowClasses: Record<string, string> = {
    bottom:
      "absolute -top-2 left-6 w-4 h-4 bg-white rotate-45 border-l border-t border-gray-200",
    top: "absolute -bottom-2 left-6 w-4 h-4 bg-white rotate-45 border-r border-b border-gray-200",
    left: "absolute top-4 -right-2 w-4 h-4 bg-white rotate-45 border-t border-r border-gray-200",
    right:
      "absolute top-4 -left-2 w-4 h-4 bg-white rotate-45 border-b border-l border-gray-200",
  };

  return (
    <div
      className="fixed bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 w-72 sm:w-80"
      style={{
        top: position.top,
        left: position.left,
        zIndex: 60,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Arrow */}
      <div className={arrowClasses[placement] || arrowClasses.bottom} />

      {/* Content */}
      <div className="relative">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {description}
        </p>

        {/* Step indicator and controls */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
          <span className="text-xs text-gray-400">
            {t("stepOf", { current: currentStep, total: totalSteps })}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onSkip}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 rounded transition-colors"
            >
              {t("skip")}
            </button>

            {!isFirst && (
              <button
                onClick={onPrev}
                className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                {t("prev")}
              </button>
            )}

            <button
              onClick={onNext}
              className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              {isLast ? t("finish") : t("next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
