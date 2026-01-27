import { useState, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout'
import { ThreadCard, AgoraFilters } from '../components/agora'
import { ContentEndMarker } from '../components/common'
import { useThreads, useTags, useCreateThread, useMunicipalities } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import type { Thread as ApiThread, UserSummary, Municipality } from '../lib/api'

type Scope = 'municipal' | 'regional' | 'national'

// Transform API thread to component format
function transformThread(thread: ApiThread) {
  return {
    id: thread.id,
    title: thread.title,
    scope: thread.scope,
    municipalityId: thread.municipality?.id,
    municipalityName: thread.municipality?.name,
    tags: thread.tags,
    authorId: thread.author.id,
    content: thread.content,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    replyCount: thread.replyCount,
    institutionalContext: thread.institutionalContext,
    source: thread.source,
    sourceUrl: thread.sourceUrl,
    aiGenerated: thread.aiGenerated
  }
}

// Transform API user to component format
function transformAuthor(author: UserSummary) {
  return {
    id: author.id,
    name: author.name,
    role: author.role,
    verified: true,
    avatarInitials: author.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    institutionType: author.institutionType as 'municipality' | 'agency' | 'ministry' | undefined,
    institutionName: author.institutionName
  }
}

export function AgoraPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [selectedScope, setSelectedScope] = useState<Scope | 'all'>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | undefined>()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newThreadTitle, setNewThreadTitle] = useState('')
  const [newThreadContent, setNewThreadContent] = useState('')
  const [newThreadScope, setNewThreadScope] = useState<Scope>('municipal')
  const [newThreadMunicipality, setNewThreadMunicipality] = useState('')

  const { data: tagsData } = useTags()
  const { data: municipalitiesData } = useMunicipalities()
  const createThreadMutation = useCreateThread()
  const { data: threadsData, isLoading, error } = useThreads({
    scope: selectedScope === 'all' ? undefined : selectedScope,
    municipalityId: selectedMunicipality,
    tags: selectedTags.length > 0 ? selectedTags : undefined
  })

  const availableTags = useMemo(() => {
    return tagsData?.map(t => t.tag) || []
  }, [tagsData])

  const threads = useMemo(() => {
    if (!threadsData?.items) return []
    return threadsData.items
      .map(transformThread)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [threadsData])

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleClearFilters = () => {
    setSelectedScope('all')
    setSelectedTags([])
    setSelectedMunicipality(undefined)
  }

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newThreadTitle.trim() || !newThreadContent.trim()) return

    try {
      const thread = await createThreadMutation.mutateAsync({
        title: newThreadTitle.trim(),
        content: newThreadContent.trim(),
        scope: newThreadScope,
        municipalityId: newThreadScope === 'municipal' && newThreadMunicipality ? newThreadMunicipality : undefined
      })
      setNewThreadTitle('')
      setNewThreadContent('')
      setNewThreadScope('municipal')
      setNewThreadMunicipality('')
      setShowCreateForm(false)
      navigate(`/agora/${thread.id}`)
    } catch (err) {
      console.error('Failed to create thread:', err)
    }
  }

  return (
    <Layout>
      {/* Page header */}
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Agora</h1>
            <p className="text-sm text-gray-600 mt-1">
              Public civic discussions — sorted by most recent activity
            </p>
          </div>
          {currentUser && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Discussion
            </button>
          )}
        </div>
      </div>

      {/* Create Thread Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Start New Discussion</h3>
              <button onClick={() => setShowCreateForm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreateThread} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={newThreadTitle}
                  onChange={(e) => setNewThreadTitle(e.target.value)}
                  placeholder="What would you like to discuss?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                <textarea
                  value={newThreadContent}
                  onChange={(e) => setNewThreadContent(e.target.value)}
                  placeholder="Share your thoughts, questions, or proposals..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                <select
                  value={newThreadScope}
                  onChange={(e) => setNewThreadScope(e.target.value as Scope)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="municipal">Municipal</option>
                  <option value="regional">Regional</option>
                  <option value="national">National</option>
                </select>
              </div>
              {newThreadScope === 'municipal' && municipalitiesData && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Municipality</label>
                  <select
                    value={newThreadMunicipality}
                    onChange={(e) => setNewThreadMunicipality(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select municipality</option>
                    {municipalitiesData.map((m: Municipality) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
                  disabled={createThreadMutation.isPending || !newThreadTitle.trim() || !newThreadContent.trim()}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createThreadMutation.isPending ? 'Posting...' : 'Post Discussion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <AgoraFilters
        selectedScope={selectedScope}
        onScopeChange={setSelectedScope}
        selectedTags={selectedTags}
        availableTags={availableTags}
        onTagToggle={handleTagToggle}
        onClearFilters={handleClearFilters}
        municipalities={municipalitiesData}
        selectedMunicipality={selectedMunicipality}
        onMunicipalityChange={setSelectedMunicipality}
      />

      {/* Thread list */}
      <div className="px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-600">
            <p>Failed to load discussions</p>
            <p className="text-sm mt-1">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        )}

        {!isLoading && !error && threads.length > 0 && (
          <div className="space-y-3">
            {threadsData?.items.map(thread => (
              <ThreadCard
                key={thread.id}
                thread={transformThread(thread)}
                author={transformAuthor(thread.author)}
              />
            ))}
          </div>
        )}

        {!isLoading && !error && threads.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No discussions match your filters</p>
            <button
              onClick={handleClearFilters}
              className="mt-2 text-blue-600 hover:underline text-sm"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* End marker - no infinite scroll */}
        {!isLoading && threads.length > 0 && (
          <ContentEndMarker />
        )}
      </div>
    </Layout>
  )
}
