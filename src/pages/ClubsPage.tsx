import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Layout } from '../components/layout'
import { ClubCard } from '../components/clubs'
import { ContentEndMarker } from '../components/common'
import { useClubs, useClubCategories } from '../hooks/useApi'
import type { Club as ApiClub } from '../lib/api'

// Transform API club to component format
function transformClub(club: ApiClub) {
  return {
    id: club.id,
    name: club.name,
    description: club.description || '',
    rules: club.rules || [],
    moderators: [],
    memberCount: club.memberCount,
    threads: [],
    category: club.category || 'General'
  }
}

export function ClubsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const { data: categoriesData } = useClubCategories()
  const { data: clubsData, isLoading, error } = useClubs({
    category: selectedCategory || undefined,
    search: searchQuery || undefined
  })

  const categories = useMemo(() => {
    return categoriesData?.map(c => c.category) || []
  }, [categoriesData])

  const clubs = useMemo(() => {
    if (!clubsData?.items) return []
    return clubsData.items.map(transformClub)
  }, [clubsData])

  return (
    <Layout>
      {/* Page header */}
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Clubs</h1>
        <p className="text-sm text-gray-600 mt-1">
          Community spaces for shared interests — citizen self-organization
        </p>
      </div>

      {/* Search and filters */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-14 z-40">
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clubs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === null
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Club list */}
      <div className="px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-600">
            <p>Failed to load clubs</p>
            <p className="text-sm mt-1">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        )}

        {!isLoading && !error && clubs.length > 0 && (
          <div className="space-y-3">
            {clubs.map(club => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        )}

        {!isLoading && !error && clubs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No clubs match your search</p>
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedCategory(null)
              }}
              className="mt-2 text-teal-600 hover:underline text-sm"
            >
              Clear filters
            </button>
          </div>
        )}

        {!isLoading && clubs.length > 0 && (
          <ContentEndMarker message="All clubs shown" />
        )}
      </div>
    </Layout>
  )
}
