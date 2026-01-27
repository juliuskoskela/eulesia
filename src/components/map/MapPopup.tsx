import { Link } from 'react-router-dom'
import { Landmark, Users, MapPin, Building2, MessageCircle, ChevronRight } from 'lucide-react'
import type { MapPoint } from '../../lib/api'

interface MapPopupProps {
  point: MapPoint
  onViewDetails?: () => void
}

const typeConfig = {
  municipality: { icon: Building2, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  thread: { icon: Landmark, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  club: { icon: Users, color: 'text-green-600', bgColor: 'bg-green-100' },
  place: { icon: MapPin, color: 'text-orange-600', bgColor: 'bg-orange-100' }
}

export function MapPopup({ point, onViewDetails }: MapPopupProps) {
  const config = typeConfig[point.type]
  const Icon = config.icon

  const getLink = () => {
    switch (point.type) {
      case 'thread':
        return `/agora/thread/${point.id}`
      case 'club':
        return `/clubs/${point.id}`
      default:
        return null
    }
  }

  const link = getLink()

  return (
    <div className="min-w-[200px] max-w-[280px]">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{point.name}</h3>
          <p className="text-xs text-gray-500 capitalize">{point.type}</p>
        </div>
      </div>

      {/* Meta info */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {point.meta.threadCount !== undefined && (
          <span className="flex items-center gap-1 text-gray-600">
            <MessageCircle className="w-3.5 h-3.5" />
            {point.meta.threadCount} threads
          </span>
        )}
        {point.meta.memberCount !== undefined && (
          <span className="flex items-center gap-1 text-gray-600">
            <Users className="w-3.5 h-3.5" />
            {point.meta.memberCount} members
          </span>
        )}
        {point.meta.category && (
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {point.meta.category}
          </span>
        )}
        {point.meta.scope && (
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize">
            {point.meta.scope}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
        {link ? (
          <Link
            to={link}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            View <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <button
            onClick={onViewDetails}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            Details <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
