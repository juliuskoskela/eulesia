import { useState } from 'react'
import DOMPurify from 'dompurify'
import { useTranslation } from 'react-i18next'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Users, ChevronDown, Lock } from 'lucide-react'
import { Layout } from '../components/layout'
import { ActorBadge, ContentEndMarker } from '../components/common'
import { CommentThread } from '../components/agora/CommentThread'
import { useClubThread, useAddClubComment } from '../hooks/useApi'
import { formatRelativeTime } from '../lib/formatTime'
import { transformAuthor, transformComment } from '../utils/transforms'

type CommentSort = 'best' | 'new' | 'old' | 'controversial'

export function ClubThreadPage() {
  const { t } = useTranslation(['clubs', 'agora', 'common'])
  const { clubId, threadId } = useParams<{ clubId: string; threadId: string }>()
  const [sort, setSort] = useState<CommentSort>('best')
  const [showSortMenu, setShowSortMenu] = useState(false)

  const sortOptions: { value: CommentSort; label: string }[] = [
    { value: 'best', label: t('agora:commentSort.best') },
    { value: 'new', label: t('agora:commentSort.new') },
    { value: 'old', label: t('agora:commentSort.old') },
    { value: 'controversial', label: t('agora:commentSort.controversial') }
  ]

  const { data: thread, isLoading, error } = useClubThread(clubId || '', threadId || '')
  const addCommentMutation = useAddClubComment(clubId || '', threadId || '')

  const [commentContent, setCommentContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmitComment = async () => {
    if (!commentContent.trim() || !threadId || !clubId) return

    setIsSubmitting(true)
    try {
      await addCommentMutation.mutateAsync({ content: commentContent })
      setCommentContent('')
    } catch (err) {
      console.error('Failed to post comment:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVote = async (_commentId: string, _value: number) => {
    // Club comments don't have voting yet
  }

  const handleReply = async (parentId: string, content: string) => {
    try {
      await addCommentMutation.mutateAsync({ content, parentId })
    } catch (err) {
      console.error('Failed to reply:', err)
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    )
  }

  if (error || !thread) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <p className="text-gray-500">{t('clubs:threadNotFound')}</p>
          <Link to={`/clubs/${clubId}`} className="text-blue-600 hover:underline mt-2 inline-block">
            {t('clubs:backToClub')}
          </Link>
        </div>
      </Layout>
    )
  }

  const author = transformAuthor(thread.author)
  const comments = thread.comments?.map(transformComment) || []

  return (
    <Layout>
      {/* Back navigation */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <Link
          to={`/clubs/${clubId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('clubs:backToClub')}
        </Link>
      </div>

      {/* Thread header */}
      <div className="px-4 py-6 bg-gradient-to-b from-purple-50 to-white">
        {/* Club indicator */}
        <div className="flex items-center gap-2 text-sm text-purple-700 mb-3">
          <Users className="w-4 h-4" />
          <span className="font-medium">{t('clubs:clubThread')}</span>
          <Lock className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-500">{t('clubs:membersOnly')}</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {thread.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
          <span>{t('clubs:published', { time: formatRelativeTime(thread.createdAt) })}</span>
        </div>

        {/* Author */}
        <div className="pt-4 border-t border-gray-200">
          <ActorBadge user={author} />
        </div>
      </div>

      {/* Main content area */}
      <div className="px-4 py-6 space-y-6">
        {/* Thread content */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          {thread.contentHtml ? (
            <div
              className="prose prose-gray max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(thread.contentHtml) }}
            />
          ) : (
            <div className="prose prose-gray max-w-none whitespace-pre-wrap">
              {thread.content}
            </div>
          )}
        </div>

        {/* Discussion section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('clubs:discussion', { count: comments.length })}
            </h2>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('clubs:sort', { label: sortOptions.find(o => o.value === sort)?.label })}
                <ChevronDown className="w-4 h-4" />
              </button>

              {showSortMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSortMenu(false)}
                  />
                  <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                    {sortOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSort(option.value)
                          setShowSortMenu(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          sort === option.value ? 'text-blue-600 font-medium' : 'text-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Comment input */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 mb-4">
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder={t('clubs:thread.writeComment')}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleSubmitComment}
                disabled={!commentContent.trim() || isSubmitting}
                className="bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t('clubs:submitting') : t('clubs:submitReply')}
              </button>
            </div>
          </div>

          {/* Comments */}
          {comments.length > 0 ? (
            <CommentThread
              comments={comments}
              onVote={handleVote}
              onReply={handleReply}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>{t('clubs:noReplies')}</p>
            </div>
          )}

          {/* End marker */}
          <ContentEndMarker message={t('clubs:endOfDiscussion')} />
        </div>
      </div>
    </Layout>
  )
}
