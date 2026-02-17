import { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layout } from '../components/layout'
import { ThreadCard, FeedFilters, FeedOnboarding, InlineThreadForm } from '../components/agora'
import { ContentEndMarker } from '../components/common'
import { MapPin, Building2, Globe, Users } from 'lucide-react'
import { useThreads, useVoteThread, useSubscriptions, useCompleteOnboarding } from '../hooks/useApi'
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
    contentHtml: thread.contentHtml,
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
    verified: author.identityVerified ?? false,
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
  const [selectedTags] = useState<string[]>([])
  const [selectedMunicipality] = useState<string | undefined>()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const onboardingDone = !!currentUser?.onboardingCompletedAt
  const completeOnboardingMutation = useCompleteOnboarding()

  const { hasCompletedGuide, startGuide, isGuideActive } = useGuide()

  const { data: subscriptionsData } = useSubscriptions()

  const [page, setPage] = useState(1)
  const [allThreads, setAllThreads] = useState<{ thread: ReturnType<typeof transformThread>; author: ReturnType<typeof transformAuthor> }[]>([])

  // Build filters for the API
  const filters = useMemo(() => ({
    feedScope,
    sortBy,
    topPeriod: sortBy === 'top' ? topPeriod : undefined,
    municipalityId: selectedMunicipality,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    page
  }), [feedScope, sortBy, topPeriod, selectedMunicipality, selectedTags, page])

  const { data: threadsData, isLoading, error } = useThreads(filters)
  const voteThreadMutation = useVoteThread(filters)

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1)
    setAllThreads([])
  }, [feedScope, sortBy, topPeriod, selectedMunicipality, selectedTags]) // eslint-disable-line react-hooks/exhaustive-deps

  // Determine if user has subscriptions
  const hasSubscriptions = useMemo(() => {
    if (!subscriptionsData) return false
    return subscriptionsData.length > 0
  }, [subscriptionsData])

  // Set default feed scope based on subscriptions (only once on initial load)
  useEffect(() => {
    if (feedScopeInitialized) return
    if (!currentUser) {
      // Unauthenticated: always show 'all' feed
      setFeedScope('all')
      setFeedScopeInitialized(true)
      return
    }
    if (subscriptionsData !== undefined) {
      if (hasSubscriptions) {
        setFeedScope('following')
      } else {
        setFeedScope('all')
      }
      setFeedScopeInitialized(true)
    }
  }, [currentUser, subscriptionsData, hasSubscriptions, feedScopeInitialized])

  // Show onboarding when following feed is empty AND user hasn't completed it before
  useEffect(() => {
    if (
      feedScope === 'following' &&
      !isLoading &&
      threadsData?.hasSubscriptions === false &&
      !onboardingDone
    ) {
      setShowOnboarding(true)
    }
  }, [feedScope, isLoading, threadsData?.hasSubscriptions, onboardingDone])

  // Auto-trigger agora guide on first visit
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasCompletedGuide('agora') && !isGuideActive) {
        startGuide('agora')
      }
    }, 800)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


  // Accumulate threads across pages
  useEffect(() => {
    if (!threadsData?.items) return
    const newItems = threadsData.items.map(item => ({
      thread: transformThread(item),
      author: transformAuthor(item.author)
    }))
    if (page === 1) {
      setAllThreads(newItems)
    } else {
      setAllThreads(prev => {
        const existingIds = new Set(prev.map(t => t.thread.id))
        const unique = newItems.filter(t => !existingIds.has(t.thread.id))
        return [...prev, ...unique]
      })
    }
  }, [threadsData, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const threads = allThreads

  // Infinite scroll with IntersectionObserver
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const hasMore = threadsData?.hasMore ?? false

  const loadNextPage = useCallback(() => {
    if (!isLoading && hasMore) {
      setPage(p => p + 1)
    }
  }, [isLoading, hasMore])

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadNextPage()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadNextPage])

  // Is this a personalized scope with no subscriptions?
  // Show as compact banner above content (content is now always shown as fallback)
  const isPersonalizedScope = ['local', 'national', 'european'].includes(feedScope)
  const showScopeHint = isPersonalizedScope && !isLoading && !hasSubscriptions

  const handleVote = (threadId: string, value: number) => {
    if (!currentUser) return
    voteThreadMutation.mutate({ threadId, value })
  }

  // --- Scroll position save/restore ---
  const scrollRestored = useRef(false)
  const SCROLL_KEY = 'agora_scroll_y'

  // Save scroll position on scroll (debounced)
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(() => {
          sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
          ticking = false
        })
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Restore scroll position after threads have loaded (only once per visit)
  useLayoutEffect(() => {
    if (scrollRestored.current) return
    if (threads.length === 0) return

    const saved = sessionStorage.getItem(SCROLL_KEY)
    if (saved) {
      const y = parseInt(saved, 10)
      if (y > 0) {
        // Small delay to let the DOM render the thread cards first
        requestAnimationFrame(() => {
          window.scrollTo(0, y)
        })
      }
    }
    scrollRestored.current = true
  }, [threads.length])

  // Clear saved scroll when filters change (starting fresh)
  useEffect(() => {
    sessionStorage.removeItem(SCROLL_KEY)
    scrollRestored.current = false
  }, [feedScope, sortBy, topPeriod, selectedMunicipality, selectedTags]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleThreadCreated = (threadId: string) => {
    navigate(`/agora/thread/${threadId}`)
  }

  const handleOnboardingComplete = () => {
    completeOnboardingMutation.mutate()
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

      {/* Thread list */}
      <div className="px-4 py-4 space-y-4">
        {/* Inline thread creation */}
        {currentUser && (
          <div data-guide="agora-newthread">
            <InlineThreadForm onSuccess={handleThreadCreated} />
          </div>
        )}

        {/* Scope tabs + sort */}
        <FeedFilters
          feedScope={feedScope}
          onFeedScopeChange={setFeedScope}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          topPeriod={topPeriod}
          onTopPeriodChange={setTopPeriod}
        />

        {isLoading && page === 1 && (
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

        {/* Scope-specific banner when no subscriptions — shown above fallback content */}
        {!isLoading && !error && showScopeHint && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
            <div className="flex-shrink-0">
              {feedScope === 'local' && <MapPin className="w-5 h-5 text-blue-600" />}
              {feedScope === 'national' && <Building2 className="w-5 h-5 text-blue-600" />}
              {feedScope === 'european' && <Globe className="w-5 h-5 text-blue-600" />}
            </div>
            <p className="text-sm text-blue-800 flex-1">
              {t('emptyScope.hint')}
            </p>
            <button
              onClick={() => {
                setFeedScope('following')
                setShowOnboarding(true)
              }}
              className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              {t('emptyScope.startFollowing')}
            </button>
          </div>
        )}

        {/* Thread list */}
        {!isLoading && !error && !showOnboarding && threads.length > 0 && (
          <div className="space-y-3">
            {threads.map((item, index) => (
              <div key={item.thread.id} {...(index === 0 ? { 'data-guide': 'agora-threadcard' } : {})}>
                <ThreadCard
                  thread={item.thread}
                  author={item.author}
                  onVote={handleVote}
                  isVoting={voteThreadMutation.isPending}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty state (not onboarding, not scope hint) */}
        {!isLoading && !error && !showOnboarding && threads.length === 0 && (
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

        {/* Infinite scroll trigger / End marker */}
        {!showOnboarding && threads.length > 0 && (
          hasMore ? (
            <>
              <div ref={loadMoreRef} className="py-4" />
              {isLoading && page > 1 && (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          ) : (
            !isLoading && <ContentEndMarker />
          )
        )}
      </div>
    </Layout>
  )
}
