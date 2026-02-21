import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { Layout } from "../components/layout/Layout";
import { SEOHead } from "../components/SEOHead";
import { MapPin } from "lucide-react";

export function NotFoundPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const content = (
    <>
      <SEOHead title="404" path="" noIndex />
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-10 h-10 text-blue-300" />
          </div>
          <h1 className="text-6xl font-bold text-gray-200 dark:text-gray-700 mb-2">
            404
          </h1>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t("errorPages.notFound.title")}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            {t("errorPages.notFound.description")}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to={isAuthenticated ? "/agora" : "/"}
              className="px-6 py-2.5 bg-blue-800 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {isAuthenticated
                ? t("errorPages.backToAgora")
                : t("errorPages.backToHome")}
            </Link>
          </div>
        </div>
      </div>
    </>
  );

  if (isAuthenticated) {
    return <Layout>{content}</Layout>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800/50">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-800 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            Eulesia
          </span>
        </Link>
      </div>
      {content}
    </div>
  );
}
