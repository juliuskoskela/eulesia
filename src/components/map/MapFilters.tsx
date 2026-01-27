import { Landmark, Users, MapPin, Building2 } from 'lucide-react'

export type MapFilterType = 'municipalities' | 'agora' | 'clubs' | 'places'

interface MapFiltersProps {
  activeFilters: MapFilterType[]
  onToggleFilter: (filter: MapFilterType) => void
}

const filters: { type: MapFilterType; icon: typeof Landmark; label: string; color: string }[] = [
  { type: 'municipalities', icon: Building2, label: 'Cities', color: 'bg-blue-600' },
  { type: 'agora', icon: Landmark, label: 'Agora', color: 'bg-purple-600' },
  { type: 'clubs', icon: Users, label: 'Clubs', color: 'bg-green-600' },
  { type: 'places', icon: MapPin, label: 'Places', color: 'bg-orange-600' }
]

export function MapFilters({ activeFilters, onToggleFilter }: MapFiltersProps) {
  return (
    <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-2 flex gap-1">
      {filters.map(({ type, icon: Icon, label, color }) => {
        const isActive = activeFilters.includes(type)
        return (
          <button
            key={type}
            onClick={() => onToggleFilter(type)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? `${color} text-white`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
