import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, MapPin, Loader2, Check, X } from "lucide-react";
import { useLocationSearch } from "../../hooks/useApi";
import type { LocationResult } from "../../lib/api";

interface LocationSearchProps {
  value: LocationResult | null;
  onChange: (location: LocationResult | null) => void;
  country?: string; // ISO 3166-1 alpha-2 (default: FI)
  types?: string[]; // Filter by type: 'municipality', 'village', 'city', etc.
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function LocationSearch({
  value,
  onChange,
  country = "FI",
  types,
  placeholder,
  disabled = false,
  className = "",
}: LocationSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Search locations
  const { data, isLoading } = useLocationSearch(debouncedQuery, {
    country,
    types,
    limit: 10,
    includeNominatim: true,
  });

  const results = data?.results || [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (location: LocationResult) => {
      onChange(location);
      setQuery("");
      setIsOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(null);
    setQuery("");
    inputRef.current?.focus();
  }, [onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (value) {
      onChange(null);
    }
    setIsOpen(true);
  };

  // Format location type for display
  const formatLocationType = (type: string) => {
    const typeMap: Record<string, string> = {
      country: t("location.types.country"),
      region: t("location.types.region"),
      municipality: t("location.types.municipality"),
      village: t("location.types.village"),
      city: t("location.types.city"),
      district: t("location.types.district"),
    };
    return typeMap[type] || type;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Input field */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={value ? value.name : query}
          onChange={handleInputChange}
          onFocus={() => !value && setIsOpen(true)}
          placeholder={placeholder ?? t("location.searchPlaceholder")}
          disabled={disabled}
          className={`
            w-full pl-9 pr-10 py-2.5 border border-gray-200 dark:border-gray-800 rounded-lg text-sm
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-50 disabled:text-gray-500
            dark:bg-gray-900 dark:text-gray-100
            ${value ? "bg-blue-50 border-blue-200" : ""}
          `}
        />
        {/* Loading indicator */}
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 animate-spin" />
        )}
        {/* Clear button when value is selected */}
        {value && !disabled && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !value && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 max-h-64 overflow-y-auto"
        >
          {results.length === 0 && debouncedQuery.length >= 2 && !isLoading && (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              {t("location.noResults")}
            </div>
          )}

          {results.length === 0 && debouncedQuery.length < 2 && (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              {t("location.minChars")}
            </div>
          )}

          {results.map((location) => (
            <button
              key={`${location.osmType}-${location.osmId}`}
              onClick={() => handleSelect(location)}
              className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {location.name}
                  </span>
                  {/* Status badge */}
                  {location.status === "active" && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                      <Check className="w-3 h-3" />
                      {t("search.discussions", {
                        count: location.contentCount,
                      })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{formatLocationType(location.type)}</span>
                  {location.parent && (
                    <>
                      <span className="text-gray-300">&bull;</span>
                      <span>{location.parent.name}</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}

          {/* Source indicator */}
          {results.length > 0 && data?.source && (
            <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
              {data.source === "cache" && t("location.source.cache")}
              {data.source === "nominatim" && t("location.source.nominatim")}
              {data.source === "mixed" && t("location.source.mixed")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
