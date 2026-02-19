import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Landmark, Users, MapPin, Building2, Settings, SlidersHorizontal, X } from 'lucide-react'
import type { MapFilterState, MapFilterType, TimePreset } from './types'
import { MapAdvancedFilters } from './MapAdvancedFilters'

interface MapFiltersProps {
  filters: MapFilterState
  onFiltersChange: (filters: MapFilterState) => void
}

const typeFilters: { type: MapFilterType; icon: typeof Landmark; labelKey: string; color: string }[] = [
  { type: 'municipalities', icon: Building2, labelKey: 'filters.cities', color: 'bg-blue-600' },
  { type: 'agora', icon: Landmark, labelKey: 'filters.agora', color: 'bg-purple-600' },
  { type: 'clubs', icon: Users, labelKey: 'filters.clubs', color: 'bg-green-600' },
  { type: 'places', icon: MapPin, labelKey: 'filters.places', color: 'bg-orange-600' }
]

const timePresets: { value: TimePreset; labelKey: string }[] = [
  { value: 'week', labelKey: 'filters.week' },
  { value: 'month', labelKey: 'filters.month' },
  { value: 'year', labelKey: 'filters.year' },
  { value: 'all', labelKey: 'filters.all' }
]

export function MapFilters({ filters, onFiltersChange }: MapFiltersProps) {
  const { t } = useTranslation('map')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showMobilePanel, setShowMobilePanel] = useState(false)

  const handleToggleType = (type: MapFilterType) => {
    const types = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type]
    onFiltersChange({ ...filters, types })
  }

  const handleTimePreset = (preset: TimePreset) => {
    onFiltersChange({
      ...filters,
      timePreset: preset,
      dateFrom: undefined,
      dateTo: undefined
    })
  }

  // Count active non-default filters for badge
  const activeFilterCount = (
    (filters.types.length < 4 ? 1 : 0) +
    (filters.timePreset !== 'all' ? 1 : 0) +
    (filters.scopes?.length ? 1 : 0) +
    (filters.languages?.length ? 1 : 0) +
    (filters.tags?.length ? 1 : 0) +
    (filters.dateFrom ? 1 : 0)
  )

  return (
    <>
      {/* Desktop: centered horizontal bar */}
      <div className="hidden sm:flex absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white dark:bg-gray-900 rounded-lg shadow-lg p-2 items-center gap-2">
        {/* Type toggles */}
        <div className="flex gap-1">
          {typeFilters.map(({ type, icon: Icon, labelKey, color }) => {
            const isActive = filters.types.includes(type)
            return (
              <button
                key={type}
                onClick={() => handleToggleType(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? `${color} text-white`
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                title={t(labelKey)}
              >
                <Icon className="w-4 h-4" />
                <span>{t(labelKey)}</span>
              </button>
            )
          })}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

        {/* Time presets */}
        <div className="flex gap-1">
          {timePresets.map(({ value, labelKey }) => {
            const isActive = filters.timePreset === value && !filters.dateFrom && !filters.dateTo
            return (
              <button
                key={value}
                onClick={() => handleTimePreset(value)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {t(labelKey)}
              </button>
            )
          })}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

        {/* Advanced filters button */}
        <button
          onClick={() => setShowAdvanced(true)}
          className={`p-1.5 rounded-md transition-colors ${
            (filters.scopes?.length || filters.languages?.length || filters.tags?.length || filters.dateFrom)
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title={t('filters.advanced')}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile: single filter button (top-right, below loading indicator area) */}
      <div className="sm:hidden absolute top-3 right-3 z-[1000]">
        <button
          onClick={() => setShowMobilePanel(true)}
          className="relative bg-white dark:bg-gray-900 rounded-lg shadow-lg p-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          aria-label={t('filters.title', { defaultValue: 'Filters' })}
        >
          <SlidersHorizontal className="w-5 h-5" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile: filter panel (slide-up sheet) */}
      {showMobilePanel && (
        <div className="sm:hidden fixed inset-0 z-[1001]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowMobilePanel(false)}
          />

          {/* Panel */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {t('filters.title', { defaultValue: 'Suodattimet' })}
              </h3>
              <button
                onClick={() => setShowMobilePanel(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Type toggles */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {t('filters.showOnMap', { defaultValue: 'Näytä kartalla' })}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {typeFilters.map(({ type, icon: Icon, labelKey, color }) => {
                    const isActive = filters.types.includes(type)
                    return (
                      <button
                        key={type}
                        onClick={() => handleToggleType(type)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? `${color} text-white`
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{t(labelKey)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Time presets */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {t('filters.timePeriod', { defaultValue: 'Aikaväli' })}
                </label>
                <div className="flex gap-2">
                  {timePresets.map(({ value, labelKey }) => {
                    const isActive = filters.timePreset === value && !filters.dateFrom && !filters.dateTo
                    return (
                      <button
                        key={value}
                        onClick={() => handleTimePreset(value)}
                        className={`flex-1 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {t(labelKey)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Advanced filters link */}
              <button
                onClick={() => {
                  setShowMobilePanel(false)
                  setShowAdvanced(true)
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Settings className="w-4 h-4" />
                {t('filters.advanced')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdvanced && (
        <MapAdvancedFilters
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClose={() => setShowAdvanced(false)}
        />
      )}
    </>
  )
}
