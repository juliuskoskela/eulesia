import { useState, useMemo } from 'react'
import { Layout } from '../components/layout'
import { ThreadCard, AgoraFilters } from '../components/agora'
import { ContentEndMarker } from '../components/common'
import { useThreads, useTags } from '../hooks/useApi'
import type { Thread as ApiThread, UserSummary } from '../lib/api'

type Scope = 'municipal' | 'regional' | 'national'

// Transform API thread to component format
function transformThread(thread: ApiThread) {
  return {
    id: thread.id,
    title: thread.title,
    scope: thread.scope,
    municipalityId: thread.municipality?.id,
    tags: thread.tags,
    authorId: thread.author.id,
    content: thread.content,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    replyCount: thread.replyCount,
    institutionalContext: thread.institutionalContext
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
  const [selectedScope, setSelectedScope] = useState<Scope | 'all'>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const { data: tagsData } = useTags()
  const { data: threadsData, isLoading, error } = useThreads({
    scope: selectedScope === 'all' ? undefined : selectedScope,
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
  }

  return (
    <Layout>
      {/* Page header */}
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Agora</h1>
        <p className="text-sm text-gray-600 mt-1">
          Public civic discussions — sorted by most recent activity
        </p>
      </div>

      {/* Filters */}
      <AgoraFilters
        selectedScope={selectedScope}
        onScopeChange={setSelectedScope}
        selectedTags={selectedTags}
        availableTags={availableTags}
        onTagToggle={handleTagToggle}
        onClearFilters={handleClearFilters}
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
