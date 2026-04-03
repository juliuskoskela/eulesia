import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../common/LanguageSwitcher";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-8 px-4 mb-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-800 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">E</span>
            </div>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              Eulesia
            </span>
            <span className="text-gray-400 dark:text-gray-600">·</span>
            <LanguageSwitcher variant="compact" />
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link
              to="/about"
              className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              {t("footer.about")}
            </Link>
            <span className="text-gray-400 dark:text-gray-600">·</span>
            <Link
              to="/terms"
              className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              {t("footer.terms")}
            </Link>
            <span className="text-gray-400 dark:text-gray-600">·</span>
            <Link
              to="/privacy"
              className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              {t("footer.privacy")}
            </Link>
            <span className="text-gray-400 dark:text-gray-600">·</span>
            <span className="text-gray-500 dark:text-gray-400">
              {t("footer.openSource")}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 text-center">
          {t("footer.tagline")}
        </div>
      </div>
    </footer>
  );
}
