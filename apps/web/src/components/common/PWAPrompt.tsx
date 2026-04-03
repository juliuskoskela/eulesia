import { useState } from "react";
import { RefreshCw, Download, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePWA } from "../../hooks/usePWA";

export function PWAUpdatePrompt() {
  const { t } = useTranslation();
  const { needRefresh, updateServiceWorker } = usePWA();

  if (!needRefresh) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-50 px-4 py-2 animate-in slide-in-from-top duration-300">
      <div className="max-w-lg mx-auto bg-blue-800 text-white rounded-xl shadow-lg p-3 flex items-center gap-3">
        <RefreshCw className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm flex-1">{t("pwa.updateAvailable")}</p>
        <button
          onClick={updateServiceWorker}
          className="px-3 py-1.5 bg-white text-blue-800 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors"
        >
          {t("pwa.update")}
        </button>
      </div>
    </div>
  );
}

export function PWAInstallBanner() {
  const { t } = useTranslation();
  const { canInstall, installApp } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  // Don't show if user already dismissed in this session
  const dismissKey = "eulesia_pwa_install_dismissed";
  if (sessionStorage.getItem(dismissKey)) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(dismissKey, "1");
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4 pb-4 animate-in slide-in-from-bottom duration-500 sm:bottom-4">
      <div className="max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-800 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">E</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t("pwa.installTitle")}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t("pwa.installDesc")}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={installApp}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-800 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {t("pwa.install")}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                {t("pwa.notNow")}
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
