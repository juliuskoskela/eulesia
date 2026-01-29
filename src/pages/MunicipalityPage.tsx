import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Layout } from '../components/layout'
import { ThreadCard } from '../components/agora'
import { ContentEndMarker, FollowButton } from '../components/common'
import { useThreads, useMunicipalities } from '../hooks/useApi'
import type { Thread as ApiThread, UserSummary, Municipality } from '../lib/api'

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

export function MunicipalityPage() {
  const { municipalityId } = useParams<{ municipalityId: string }>()
  const { data: municipalitiesData } = useMunicipalities()
  const { data: threadsData, isLoading, error } = useThreads({ municipalityId })

  const municipality = useMemo(() => {
    return municipalitiesData?.find((m: Municipality) => m.id === municipalityId)
  }, [municipalitiesData, municipalityId])

  const threads = useMemo(() => {
    if (!threadsData?.items) return []
    return threadsData.items
      .map(transformThread)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [threadsData])

  return (
    <Layout>
      {/* Page header */}
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Link
              to="/kunnat"
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {municipality?.name || 'Kunta'}
              </h1>
              {municipality?.region && (
                <p className="text-sm text-gray-500">{municipality.region}</p>
              )}
            </div>
          </div>
          {municipalityId && (
            <FollowButton entityType="municipality" entityId={municipalityId} />
          )}
        </div>
        <p className="text-sm text-gray-600">
          {threads.length} keskustelua
        </p>
      </div>

      {/* Thread list */}
      <div className="px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-600">
            <p>Keskustelujen lataaminen epäonnistui</p>
            <p className="text-sm mt-1">{error instanceof Error ? error.message : 'Tuntematon virhe'}</p>
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
            <p>Ei keskusteluja tässä kunnassa</p>
            <Link
              to="/agora"
              className="mt-2 text-blue-600 hover:underline text-sm inline-block"
            >
              Siirry Agoraan
            </Link>
          </div>
        )}

        {/* End marker */}
        {!isLoading && threads.length > 0 && (
          <ContentEndMarker />
        )}
      </div>
    </Layout>
  )
}
