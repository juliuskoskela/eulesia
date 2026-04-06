import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Store,
  Calendar,
  BookOpen,
  Bus,
  Newspaper,
  Heart,
  ChevronRight,
  Info,
  X,
  ExternalLink,
} from "lucide-react";
import { Layout } from "../components/layout";
import { SEOHead } from "../components/SEOHead";
import { ContentEndMarker } from "../components/common";
import { services, getServiceCategories } from "../data";
// Demo service type — not an API type, only used for the services demo page
type Service = {
  id: string;
  name?: string;
  title?: string;
  description: string;
  category: string;
  provider?: string;
  url?: string;
  icon?: string;
  integrationDemoType?: string;
};

const categoryIcons: Record<string, React.ElementType> = {
  Recreation: Calendar,
  Community: Heart,
  Culture: BookOpen,
  Transport: Bus,
  Media: Newspaper,
};

function ServiceCard({
  service,
  onClick,
}: {
  service: Service;
  onClick: () => void;
}) {
  const Icon = categoryIcons[service.category] || Store;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {service.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {service.provider}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
            {service.description}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-2" />
      </div>
    </button>
  );
}

export function ServicesPage() {
  const { t } = useTranslation("services");
  const categories = getServiceCategories();
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const servicesByCategory = categories.reduce(
    (acc, category) => {
      acc[category] = services.filter((s) => s.category === category);
      return acc;
    },
    {} as Record<string, Service[]>,
  );

  return (
    <Layout>
      <SEOHead title={t("title")} path="/services" noIndex />
      {/* Page header */}
      <div className="bg-white dark:bg-gray-900 px-4 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-1">
          <Store className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {t("title")}
          </h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("subtitle")}
        </p>
      </div>

      {/* Explanation banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-900">{t("explanation")}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {categories.map((category) => (
          <div key={category}>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              {category}
            </h2>
            <div className="space-y-3">
              {servicesByCategory[category].map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onClick={() => setSelectedService(service)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* No attention economy note */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("noEngagement")}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t("noEngagementSub")}
          </p>
        </div>

        <ContentEndMarker message={t("allServicesShown")} />
      </div>

      {/* Service Detail Modal */}
      {selectedService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {selectedService.name}
              </h3>
              <button
                onClick={() => setSelectedService(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  {t("provider")}
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {selectedService.provider}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  {t("category")}
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {selectedService.category}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  {t("description")}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedService.description}
                </p>
              </div>
              {selectedService.url && (
                <a
                  href={selectedService.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t("visitService")}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
