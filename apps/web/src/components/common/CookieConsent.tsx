import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";

const COOKIE_CONSENT_KEY = "eulesia_cookie_consent";

export function CookieConsent() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash immediately on load
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const reject = () => {
    // "Reject" means only essential cookies — since Eulesia only uses essential
    // cookies anyway, this has the same effect. We record the explicit choice.
    localStorage.setItem(COOKIE_CONSENT_KEY, "essential_only");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4 pb-4 animate-in slide-in-from-bottom duration-500 sm:bottom-4">
      <div className="max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mt-0.5">
            <Cookie className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {t("cookies.message")}{" "}
              <Link
                to="/privacy"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                {t("cookies.learnMore")}
              </Link>
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={accept}
                className="px-4 py-1.5 bg-blue-800 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t("cookies.accept")}
              </button>
              <button
                onClick={reject}
                className="px-4 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t("cookies.essentialOnly")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
