import { useTranslation } from 'react-i18next'
import { Users, ChevronRight, MapPin, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Club } from '../../lib/api'

interface ClubCardProps {
  club: Club
}

export function ClubCard({ club }: ClubCardProps) {
  const { t } = useTranslation('clubs')

  return (
    <Link
      to={`/clubs/${club.id}`}
      className="block bg-white rounded-xl overflow-hidden hover:shadow-md transition-shadow border border-gray-200"
    >
      {/* Cover image or gradient placeholder */}
      {club.coverImageUrl ? (
        <div className="h-28 bg-gray-100">
          <img
            src={club.coverImageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="h-16 bg-gradient-to-r from-teal-400 to-cyan-500" />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Category and visibility badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {club.category && (
                <span className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                  {club.category}
                </span>
              )}
              {!club.isPublic && (
                <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {t('closedClub')}
                </span>
              )}
            </div>

            {/* Name */}
            <h3 className="font-semibold text-gray-900 mt-2 mb-1">
              {club.name}
            </h3>

            {/* Description */}
            {club.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                {club.description}
              </p>
            )}

            {/* Location + member count */}
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{t('members', { count: club.memberCount })}</span>
              </div>
              {club.address && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[180px]">{club.address}</span>
                </div>
              )}
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-6" />
        </div>
      </div>
    </Link>
  )
}
