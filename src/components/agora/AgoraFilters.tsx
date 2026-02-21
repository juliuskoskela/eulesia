import { Filter, MapPin, Building2, Globe, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Scope } from "../../types";
import type { Municipality } from "../../lib/api";

interface AgoraFiltersProps {
  selectedScope: Scope | "all";
  onScopeChange: (scope: Scope | "all") => void;
  selectedTags: string[];
  availableTags: string[];
  onTagToggle: (tag: string) => void;
  onClearFilters: () => void;
  municipalities?: Municipality[];
  selectedMunicipality?: string;
  onMunicipalityChange?: (municipalityId: string | undefined) => void;
}

export function AgoraFilters({
  selectedScope,
  onScopeChange,
  selectedTags,
  availableTags,
  onTagToggle,
  onClearFilters,
  municipalities,
  selectedMunicipality,
  onMunicipalityChange,
}: AgoraFiltersProps) {
  const { t } = useTranslation("agora");

  const scopeOptions: {
    value: Scope | "all";
    label: string;
    icon: React.ElementType;
  }[] = [
    { value: "all", label: t("filters.scope.all"), icon: Filter },
    { value: "local", label: t("filters.scope.local"), icon: MapPin },
    { value: "national", label: t("filters.scope.national"), icon: Building2 },
    { value: "european", label: t("filters.scope.european"), icon: Globe },
  ];

  const hasActiveFilters =
    selectedScope !== "all" ||
    selectedTags.length > 0 ||
    !!selectedMunicipality;

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-14 z-40">
      <div className="px-4 py-3">
        {/* Scope filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {scopeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => {
                onScopeChange(value);
                // Clear municipality when switching away from local
                if (value !== "local" && selectedMunicipality) {
                  onMunicipalityChange?.(undefined);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedScope === value
                  ? "bg-blue-800 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
              aria-pressed={selectedScope === value}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Municipality chips - show when Local scope is selected */}
        {selectedScope === "local" &&
          municipalities &&
          municipalities.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-hide">
              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                {t("filters.municipalityLabel")}
              </span>
              <button
                onClick={() => onMunicipalityChange?.(undefined)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  !selectedMunicipality
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {t("filters.allMunicipalities")}
              </button>
              {municipalities.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onMunicipalityChange?.(m.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedMunicipality === m.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

        {/* Topic tags */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 scrollbar-hide">
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            {t("filters.topicsLabel")}
          </span>
          {availableTags.slice(0, 8).map((tag) => (
            <button
              key={tag}
              onClick={() => onTagToggle(tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedTags.includes(tag)
                  ? "bg-teal-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
              aria-pressed={selectedTags.includes(tag)}
            >
              {tag.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-3 h-3" />
            {t("filters.clearFilters")}
          </button>
        )}
      </div>
    </div>
  );
}
