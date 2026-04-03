import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { MapFilterState } from "./types";
import { DEFAULT_FILTERS } from "./types";

interface MapAdvancedFiltersProps {
  filters: MapFilterState;
  onFiltersChange: (filters: MapFilterState) => void;
  onClose: () => void;
}

const scopeOptions = [
  { value: "local" as const, labelKey: "scopes.local" },
  { value: "national" as const, labelKey: "scopes.national" },
  { value: "european" as const, labelKey: "scopes.european" },
];

const languageOptions = [
  { value: "fi", label: "Suomi" },
  { value: "en", label: "English" },
  { value: "sv", label: "Svenska" },
];

export function MapAdvancedFilters({
  filters,
  onFiltersChange,
  onClose,
}: MapAdvancedFiltersProps) {
  const { t } = useTranslation("map");
  const [localFilters, setLocalFilters] = useState<MapFilterState>({
    ...filters,
  });

  const handleScopeToggle = (scope: "local" | "national" | "european") => {
    const current = localFilters.scopes || [];
    const updated = current.includes(scope)
      ? current.filter((s) => s !== scope)
      : [...current, scope];
    setLocalFilters({
      ...localFilters,
      scopes: updated.length > 0 ? updated : undefined,
    });
  };

  const handleLanguageToggle = (lang: string) => {
    const current = localFilters.languages || [];
    const updated = current.includes(lang)
      ? current.filter((l) => l !== lang)
      : [...current, lang];
    setLocalFilters({
      ...localFilters,
      languages: updated.length > 0 ? updated : undefined,
    });
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleReset = () => {
    onFiltersChange(DEFAULT_FILTERS);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-black/30">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {t("filters.advanced")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Custom date range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("filters.dateFrom")} / {t("filters.dateTo")}
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={localFilters.dateFrom || ""}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    dateFrom: e.target.value || undefined,
                    timePreset: "all",
                  })
                }
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              />
              <input
                type="date"
                value={localFilters.dateTo || ""}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    dateTo: e.target.value || undefined,
                    timePreset: "all",
                  })
                }
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Scope filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("filters.scope")}
            </label>
            <div className="flex flex-wrap gap-2">
              {scopeOptions.map(({ value, labelKey }) => {
                const isActive = localFilters.scopes?.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => handleScopeToggle(value)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("filters.language")}
            </label>
            <div className="flex flex-wrap gap-2">
              {languageOptions.map(({ value, label }) => {
                const isActive = localFilters.languages?.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => handleLanguageToggle(value)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("filters.tags")}
            </label>
            <input
              type="text"
              placeholder="koulutus, liikenne..."
              value={localFilters.tags?.join(", ") || ""}
              onChange={(e) => {
                const tags = e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
                setLocalFilters({
                  ...localFilters,
                  tags: tags.length > 0 ? tags : undefined,
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {t("filters.reset")}
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            {t("filters.apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
