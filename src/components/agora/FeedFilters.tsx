import { Users, MapPin, Building2, Globe, ChevronDown, Clock, TrendingUp, Sparkles } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { FeedScope, SortBy, TopPeriod, Municipality } from '../../lib/api'

interface FeedFiltersProps {
  feedScope: FeedScope
  onFeedScopeChange: (scope: FeedScope) => void
  sortBy: SortBy
  onSortByChange: (sort: SortBy) => void
  topPeriod: TopPeriod
  onTopPeriodChange: (period: TopPeriod) => void
  selectedTags: string[]
  availableTags: string[]
  onTagToggle: (tag: string) => void
  municipalities?: Municipality[]
  selectedMunicipality?: string
  onMunicipalityChange?: (municipalityId: string | undefined) => void
  hasSubscriptions?: boolean
}

const feedScopeOptions: { value: FeedScope; tKey: string; icon: React.ElementType }[] = [
  { value: 'following', tKey: 'scope.all', icon: Users },
  { value: 'local', tKey: 'scope.local', icon: MapPin },
  { value: 'national', tKey: 'scope.national', icon: Building2 },
  { value: 'european', tKey: 'scope.european', icon: Globe }
]

const sortByOptions: { value: SortBy; tKey: string; icon: React.ElementType }[] = [
  { value: 'recent', tKey: 'feed.sort.recent', icon: Clock },
  { value: 'new', tKey: 'feed.sort.newest', icon: Sparkles },
  { value: 'top', tKey: 'feed.sort.top', icon: TrendingUp }
]

const topPeriodOptions: { value: TopPeriod; tKey: string }[] = [
  { value: 'day', tKey: 'feed.period.day' },
  { value: 'week', tKey: 'feed.period.week' },
  { value: 'month', tKey: 'feed.period.month' },
  { value: 'year', tKey: 'feed.period.year' }
]

export function FeedFilters({
  feedScope,
  onFeedScopeChange,
  sortBy,
  onSortByChange,
  topPeriod,
  onTopPeriodChange,
  selectedTags,
  availableTags,
  onTagToggle,
  // These props are kept for API compatibility but not currently used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  municipalities: _municipalities,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  selectedMunicipality: _selectedMunicipality,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onMunicipalityChange: _onMunicipalityChange
}: FeedFiltersProps) {
  const { t } = useTranslation()
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)
  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const periodDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false)
      }
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setShowPeriodDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentSort = sortByOptions.find(o => o.value === sortBy)
  const currentPeriod = topPeriodOptions.find(o => o.value === topPeriod)

  return (
    <div className="bg-white border-b border-gray-200 sticky top-14 z-40">
      <div className="px-4 py-3 space-y-3">
        {/* Feed scope tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {feedScopeOptions.map(({ value, tKey, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onFeedScopeChange(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                feedScope === value
                  ? 'bg-blue-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              aria-pressed={feedScope === value}
            >
              <Icon className="w-4 h-4" />
              {t(tKey)}
            </button>
          ))}
        </div>

        {/* Sort and time period */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort dropdown */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              {currentSort && <currentSort.icon className="w-4 h-4" />}
              <span>{currentSort && t(currentSort.tKey)}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showSortDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px] z-50">
                {sortByOptions.map(({ value, tKey, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => {
                      onSortByChange(value)
                      setShowSortDropdown(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                      sortBy === value
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t(tKey)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Time period dropdown (only show when sortBy is 'top') */}
          {sortBy === 'top' && (
            <div className="relative" ref={periodDropdownRef}>
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                <span>{currentPeriod && t(currentPeriod.tKey)}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showPeriodDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px] z-50">
                  {topPeriodOptions.map(({ value, tKey }) => (
                    <button
                      key={value}
                      onClick={() => {
                        onTopPeriodChange(value)
                        setShowPeriodDropdown(false)
                      }}
                      className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                        topPeriod === value
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {t(tKey)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Note: Municipality filtering removed - users subscribe to specific municipalities */}

        {/* Topic tags */}
        {availableTags.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-hide">
            <span className="text-xs text-gray-500 flex-shrink-0">{t('feed.topics')}</span>
            {availableTags.slice(0, 8).map(tag => (
              <button
                key={tag}
                onClick={() => onTagToggle(tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                aria-pressed={selectedTags.includes(tag)}
              >
                {tag.replace(/-/g, ' ')}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
