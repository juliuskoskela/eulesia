import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGuide } from "../../hooks/useGuide";
import { guides } from "../../data/guides";

export function GuideHelpButton() {
  const { t } = useTranslation("guide");
  const { startGuide, hasCompletedGuide, isGuideActive } = useGuide();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Hide button while a guide is active
  if (isGuideActive) return null;

  const guideEntries = Object.values(guides);

  return (
    <div className="relative" ref={menuRef}>
      {/* Menu dropdown */}
      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t("selectGuide")}
            </p>
          </div>
          <div className="py-1">
            {guideEntries.map((guide) => {
              const completed = hasCompletedGuide(guide.id);
              return (
                <button
                  key={guide.id}
                  onClick={() => {
                    startGuide(guide.id);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="text-gray-700 dark:text-gray-300">
                    {t(guide.titleKey.replace("guide:", ""))}
                  </span>
                  {completed && (
                    <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
                      {t("completed")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Inline button for TopBar */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        aria-label={t("helpButton")}
      >
        <HelpCircle className="w-5 h-5" />
      </button>
    </div>
  );
}
