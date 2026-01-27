import { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer as LeafletMap, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api, type MapPoint, type MapBounds } from '../../lib/api'
import { MapFilters, type MapFilterType } from './MapFilters'
import { MapPopup } from './MapPopup'

// Custom marker icons
const createIcon = (color: string) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    background-color: ${color};
    width: 24px;
    height: 24px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24]
})

const icons = {
  municipality: createIcon('#2563eb'), // blue-600
  thread: createIcon('#9333ea'),       // purple-600
  club: createIcon('#16a34a'),         // green-600
  place: createIcon('#ea580c')         // orange-600
}

// Component to handle map events
function MapEventHandler({ onBoundsChange }: { onBoundsChange: (bounds: MapBounds) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds()
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      })
    },
    zoomend: () => {
      const bounds = map.getBounds()
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      })
    }
  })

  // Trigger initial bounds on mount
  useEffect(() => {
    const bounds = map.getBounds()
    onBoundsChange({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    })
  }, [map, onBoundsChange])

  return null
}

// Component to update map center
function MapCenterUpdater({ center }: { center: [number, number] | null }) {
  const map = useMap()

  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom())
    }
  }, [center, map])

  return null
}

interface EulesiaMapProps {
  initialCenter?: [number, number]
  initialZoom?: number
  onPointClick?: (point: MapPoint) => void
}

export function EulesiaMap({
  initialCenter = [61.4978, 23.7610], // Default: Tampere, Finland
  initialZoom = 6,
  onPointClick
}: EulesiaMapProps) {
  const [points, setPoints] = useState<MapPoint[]>([])
  const [activeFilters, setActiveFilters] = useState<MapFilterType[]>(['municipalities', 'agora', 'clubs', 'places'])
  const [isLoading, setIsLoading] = useState(false)
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const boundsRef = useRef<MapBounds | null>(null)

  const fetchPoints = useCallback(async (bounds: MapBounds) => {
    setIsLoading(true)
    try {
      const response = await api.getMapPoints({
        ...bounds,
        types: activeFilters.join(',')
      })
      setPoints(response.points)
    } catch (error) {
      console.error('Failed to fetch map points:', error)
    } finally {
      setIsLoading(false)
    }
  }, [activeFilters])

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    boundsRef.current = bounds
    fetchPoints(bounds)
  }, [fetchPoints])

  // Refetch when filters change
  useEffect(() => {
    if (boundsRef.current) {
      fetchPoints(boundsRef.current)
    }
  }, [activeFilters, fetchPoints])

  const handleToggleFilter = (filter: MapFilterType) => {
    setActiveFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    )
  }

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter([position.coords.latitude, position.coords.longitude])
        },
        () => {
          // Geolocation denied or failed, use default center
        }
      )
    }
  }, [])

  return (
    <div className="relative w-full h-full">
      <LeafletMap
        center={initialCenter}
        zoom={initialZoom}
        className="w-full h-full"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEventHandler onBoundsChange={handleBoundsChange} />
        <MapCenterUpdater center={mapCenter} />

        {points.map((point) => (
          <Marker
            key={`${point.type}-${point.id}`}
            position={[point.latitude, point.longitude]}
            icon={icons[point.type]}
            eventHandlers={{
              click: () => onPointClick?.(point)
            }}
          >
            <Popup>
              <MapPopup point={point} />
            </Popup>
          </Marker>
        ))}
      </LeafletMap>

      <MapFilters
        activeFilters={activeFilters}
        onToggleFilter={handleToggleFilter}
      />

      {isLoading && (
        <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600">Loading...</span>
        </div>
      )}
    </div>
  )
}
