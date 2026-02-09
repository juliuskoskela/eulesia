import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layout } from '../components/layout'
import { ThreadCard, FeedFilters, FeedOnboarding, InlineThreadForm } from '../components/agora'
import { ContentEndMarker } from '../components/common'
import { MapPin, Building2, Globe, Users } from 'lucide-react'
import { useThreads, useTags, useMunicipalities, useVoteThread, useSubscriptions } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { useGuide } from '../hooks/useGuide'
import type { Thread as ApiThread, UserSummary, FeedScope, SortBy, TopPeriod } from '../lib/api'

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
    score: thread.score,
    userVote: thread.userVote,
    institutionalContext: thread.institutionalContext,
    source: thread.source,
    sourceUrl: thread.sourceUrl,
    aiGenerated: thread.aiGenerated,
    sourceInstitutionId: thread.sourceInstitutionId,
    sourceInstitutionName: thread.sourceInstitutionName
  }
}

// Transform API user to component format
function transformAuthor(author: UserSummary) {
  return {
    id: author.id,
    name: author.name,
    role: author.role,
    verified: true,
    avatarUrl: author.avatarUrl,
    avatarInitials: author.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    institutionType: author.institutionType as 'municipality' | 'agency' | 'ministry' | undefined,
    institutionName: author.institutionName
  }
}

export function AgoraPage() {
  const { t } = useTranslation('agora')
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  // Feed state
  const [feedScope, setFeedScope] = useState<FeedScope>('all')
  const [feedScopeInitialized, setFeedScopeInitialized] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('recent')
  const [topPeriod, setTopPeriod] = useState<TopPeriod>('week')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | undefined>()
  const [showOnboarding, setShowOnboarding] = useState(false)

  const { hasCompletedGuide, startGuide, isGuideActive } = useGuide()

  const { data: tagsData } = useTags()
  const { data: municipalitiesData } = useMunicipalities()
  const { data: subscriptionsData } = useSubscriptions()

  // Build filters for the API
  const filters = useMemo(() => ({
    feedScope,
    sortBy,
    topPeriod: sortBy === 'top' ? topPeriod : undefined,
    municipalityId: selectedMunicipality,
    tags: selectedTags.length > 0 ? selectedTags : undefined
  }), [feedScope, sortBy, topPeriod, selectedMunicipality, selectedTags])

  const { data: threadsData, isLoading, error } = useThreads(filters)
  const voteThreadMutation = useVoteThread(filters)

  // Determine if user has subscriptions
  const hasSubscriptions = useMemo(() => {
    if (!subscriptionsData) return false
    return subscriptionsData.length > 0
  }, [subscriptionsData])

  // Set default feed scope based on subscriptions (only once on initial load)
  useEffect(() => {
    if (!feedScopeInitialized && currentUser && subscriptionsData !== undefined) {
      if (hasSubscriptions) {
        setFeedScope('following')
      } else {
        setFeedScope('all')
      }
      setFeedScopeInitialized(true)
    }
  }, [currentUser, subscriptionsData, hasSubscriptions, feedScopeInitialized])

  // Show onboarding when following feed is empty
  useEffect(() => {
    if (
      feedScope === 'following' &&
      !isLoading &&
      threadsData?.hasSubscriptions === false
    ) {
      setShowOnboarding(true)
    }
  }, [feedScope, isLoading, threadsData?.hasSubscriptions])

  // Auto-trigger agora guide on first visit
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasCompletedGuide('agora') && !isGuideActive) {
        startGuide('agora')
      }
    }, 800)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const availableTags = useMemo(() => {
    return tagsData?.map(t => t.tag) || []
  }, [tagsData])

  const threads = useMemo(() => {
    if (!threadsData?.items) return []
    return threadsData.items.map(transformThread)
  }, [threadsData])

  // Is this a personalized scope with no subscriptions?
  const isPersonalizedScope = ['local', 'national', 'european'].includes(feedScope)
  const showScopeHint = isPersonalizedScope && !isLoading && !hasSubscriptions && threads.length === 0

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleVote = (threadId: string, value: number) => {
    if (!currentUser) return
    voteThreadMutation.mutate({ threadId, value })
  }

  const handleThreadCreated = (threadId: string) => {
    navigate(`/agora/thread/${threadId}`)
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
  }

  return (
    <Layout>
      {/* Page header */}
      <div className="bg-white px-4 py-4 border-b border-gray-200" data-guide="agora-header">
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-600 mt-1">
          {t('subtitle')}
        </p>
      </div>

      {/* Filters */}
      <FeedFilters
        feedScope={feedScope}
        onFeedScopeChange={setFeedScope}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        topPeriod={topPeriod}
        onTopPeriodChange={setTopPeriod}
        selectedTags={selectedTags}
        availableTags={availableTags}
        onTagToggle={handleTagToggle}
        municipalities={municipalitiesData}
        selectedMunicipality={selectedMunicipality}
        onMunicipalityChange={setSelectedMunicipality}
        hasSubscriptions={hasSubscriptions}
      />

      {/* Thread list */}
      <div className="px-4 py-4 space-y-4">
        {/* Inline thread creation */}
        {currentUser && (
          <div data-guide="agora-newthread">
            <InlineThreadForm onSuccess={handleThreadCreated} />
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-600">
            <p>{t('loadError')}</p>
            <p className="text-sm mt-1">{error instanceof Error ? error.message : t('common:errors.unknown')}</p>
          </div>
        )}

        {/* Onboarding for empty following feed */}
        {!isLoading && !error && showOnboarding && feedScope === 'following' && (
          <div className="py-8">
            <FeedOnboarding onComplete={handleOnboardingComplete} />
          </div>
        )}

        {/* Thread list */}
        {!isLoading && !error && !showOnboarding && threads.length > 0 && (
          <div className="space-y-3">
            {threadsData?.items.map((thread, index) => (
              <div key={thread.id} {...(index === 0 ? { 'data-guide': 'agora-threadcard' } : {})}>
                <ThreadCard
                  thread={transformThread(thread)}
                  author={transformAuthor(thread.author)}
                  onVote={handleVote}
                  isVoting={voteThreadMutation.isPending}
                />
              </div>
            ))}
          </div>
        )}

        {/* Scope-specific hint when no subscriptions */}
        {!isLoading && !error && showScopeHint && (
          <div className="max-w-md mx-auto py-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 bg-gray-100">
                {feedScope === 'local' && <MapPin className="w-6 h-6 text-blue-600" />}
                {feedScope === 'national' && <Building2 className="w-6 h-6 text-blue-600" />}
                {feedScope === 'european' && <Globe className="w-6 h-6 text-blue-600" />}
              </div>
              <p className="text-gray-700 text-sm mb-2">
                {t(`emptyScope.${feedScope}`)}
              </p>
              <p className="text-gray-400 text-xs mb-4">
                {t('emptyScope.hint')}
              </p>
              <button
                onClick={() => {
                  setFeedScope('following')
                  setShowOnboarding(true)
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Users className="w-4 h-4" />
                {t('emptyScope.startFollowing')}
              </button>
            </div>
          </div>
        )}

        {/* Empty state (not onboarding, not scope hint) */}
        {!isLoading && !error && !showOnboarding && !showScopeHint && threads.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>{t('noThreads')}</p>
            {feedScope === 'following' && (
              <button
                onClick={() => setShowOnboarding(true)}
                className="mt-2 text-blue-600 hover:underline text-sm"
              >
                {t('editSubscriptions')}
              </button>
            )}
          </div>
        )}

        {/* End marker */}
        {!isLoading && !showOnboarding && threads.length > 0 && (
          <ContentEndMarker />
        )}
      </div>
    </Layout>
  )
}
