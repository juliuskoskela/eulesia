import { Filter, MapPin, Map, Globe, X, Building, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Scope } from '../../types'
import type { Municipality } from '../../lib/api'

interface AgoraFiltersProps {
  selectedScope: Scope | 'all'
  onScopeChange: (scope: Scope | 'all') => void
  selectedTags: string[]
  availableTags: string[]
  onTagToggle: (tag: string) => void
  onClearFilters: () => void
  municipalities?: Municipality[]
  selectedMunicipality?: string
  onMunicipalityChange?: (municipalityId: string | undefined) => void
}

const scopeOptions: { value: Scope | 'all'; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: Filter },
  { value: 'municipal', label: 'Municipal', icon: MapPin },
  { value: 'regional', label: 'Regional', icon: Map },
  { value: 'national', label: 'National', icon: Globe }
]

export function AgoraFilters({
  selectedScope,
  onScopeChange,
  selectedTags,
  availableTags,
  onTagToggle,
  onClearFilters,
  municipalities,
  selectedMunicipality,
  onMunicipalityChange
}: AgoraFiltersProps) {
  const [showMunicipalityDropdown, setShowMunicipalityDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const hasActiveFilters = selectedScope !== 'all' || selectedTags.length > 0 || !!selectedMunicipality

  const selectedMunicipalityData = municipalities?.find(m => m.id === selectedMunicipality)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMunicipalityDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="bg-white border-b border-gray-200 sticky top-14 z-40">
      <div className="px-4 py-3">
        {/* Scope filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {scopeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onScopeChange(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedScope === value
                  ? 'bg-blue-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}

          {/* Municipality selector */}
          {municipalities && municipalities.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowMunicipalityDropdown(!showMunicipalityDropdown)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedMunicipality
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Building className="w-4 h-4" />
                {selectedMunicipalityData?.name || 'Kunta'}
                <ChevronDown className="w-3 h-3" />
              </button>

              {showMunicipalityDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] max-h-[300px] overflow-y-auto z-50">
                  {selectedMunicipality && (
                    <button
                      onClick={() => {
                        onMunicipalityChange?.(undefined)
                        setShowMunicipalityDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                    >
                      Kaikki kunnat
                    </button>
                  )}
                  {municipalities.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        onMunicipalityChange?.(m.id)
                        setShowMunicipalityDropdown(false)
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                        selectedMunicipality === m.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <span>{m.name}</span>
                      {m.region && <span className="text-xs text-gray-400">{m.region}</span>}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <Link
                      to="/kunnat"
                      onClick={() => setShowMunicipalityDropdown(false)}
                      className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-1"
                    >
                      Selaa kaikkia kuntia →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Topic tags */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 scrollbar-hide">
          <span className="text-xs text-gray-500 flex-shrink-0">Topics:</span>
          {availableTags.slice(0, 8).map(tag => (
            <button
              key={tag}
              onClick={() => onTagToggle(tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tag.replace('-', ' ')}
            </button>
          ))}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="w-3 h-3" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
