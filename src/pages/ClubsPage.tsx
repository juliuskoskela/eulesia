import { useState, useMemo } from 'react'
import { Search, Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout'
import { ClubCard } from '../components/clubs'
import { ContentEndMarker } from '../components/common'
import { useClubs, useClubCategories, useCreateClub } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
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
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newClubName, setNewClubName] = useState('')
  const [newClubDescription, setNewClubDescription] = useState('')
  const [newClubCategory, setNewClubCategory] = useState('')

  const { data: categoriesData } = useClubCategories()
  const createClubMutation = useCreateClub()
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

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClubName.trim()) return

    try {
      const club = await createClubMutation.mutateAsync({
        name: newClubName.trim(),
        description: newClubDescription.trim() || undefined,
        category: newClubCategory.trim() || 'General'
      })
      setNewClubName('')
      setNewClubDescription('')
      setNewClubCategory('')
      setShowCreateForm(false)
      navigate(`/clubs/${club.slug}`)
    } catch (err) {
      console.error('Failed to create club:', err)
    }
  }

  return (
    <Layout>
      {/* Page header */}
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Clubs</h1>
            <p className="text-sm text-gray-600 mt-1">
              Community spaces for shared interests — citizen self-organization
            </p>
          </div>
          {currentUser && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Club
            </button>
          )}
        </div>
      </div>

      {/* Create Club Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Create New Club</h3>
              <button onClick={() => setShowCreateForm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreateClub} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Club Name *</label>
                <input
                  type="text"
                  value={newClubName}
                  onChange={(e) => setNewClubName(e.target.value)}
                  placeholder="e.g., Helsinki Urban Gardeners"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newClubDescription}
                  onChange={(e) => setNewClubDescription(e.target.value)}
                  placeholder="What is this club about?"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newClubCategory}
                  onChange={(e) => setNewClubCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createClubMutation.isPending || !newClubName.trim()}
                  className="flex-1 bg-teal-600 text-white py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createClubMutation.isPending ? 'Creating...' : 'Create Club'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
