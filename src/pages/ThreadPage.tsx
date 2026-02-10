import { useState } from 'react'
import DOMPurify from 'dompurify'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Building2, ChevronDown } from 'lucide-react'
import { Layout } from '../components/layout'
import { ActorBadge, ScopeBadge, TagList, ContentEndMarker, ReportButton } from '../components/common'
import { InstitutionalContextBox } from '../components/agora/InstitutionalContextBox'
import { CommentThread } from '../components/agora/CommentThread'
import { ThreadVoteButtons } from '../components/agora/ThreadVoteButtons'
import { useThread, useAddComment, useVoteComment, useVoteThread, type CommentSort } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { formatRelativeTime } from '../lib/formatTime'
import { transformAuthor, transformComment } from '../utils/transforms'

export function ThreadPage() {
  const { t } = useTranslation(['agora', 'common'])
  const { threadId } = useParams<{ threadId: string }>()
  const { currentUser } = useAuth()
  const [sort, setSort] = useState<CommentSort>('best')
  const [showSortMenu, setShowSortMenu] = useState(false)

  const sortOptions: { value: CommentSort; label: string }[] = [
    { value: 'best', label: t('commentSort.best') },
    { value: 'new', label: t('commentSort.new') },
    { value: 'old', label: t('commentSort.old') },
    { value: 'controversial', label: t('commentSort.controversial') }
  ]

  const { data: thread, isLoading, error } = useThread(threadId || '', sort)
  const addCommentMutation = useAddComment(threadId || '', sort)
  const voteCommentMutation = useVoteComment(threadId || '', sort)
  const voteThreadMutation = useVoteThread()

  const [commentContent, setCommentContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleThreadVote = (value: number) => {
    if (!currentUser || !threadId) return
    voteThreadMutation.mutate({ threadId, value })
  }

  const handleSubmitComment = async () => {
    if (!commentContent.trim() || !threadId) return

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

  const handleVote = async (commentId: string, value: number) => {
    try {
      await voteCommentMutation.mutateAsync({ commentId, value })
    } catch (err) {
      console.error('Failed to vote:', err)
    }
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
          <p className="text-gray-500">{t('thread.notFound')}</p>
          <Link to="/agora" className="text-blue-600 hover:underline mt-2 inline-block">
            {t('thread.returnToAgora')}
          </Link>
        </div>
      </Layout>
    )
  }

  const author = transformAuthor(thread.author)
  const isInstitutional = thread.author.role === 'institution'
  const comments = thread.comments?.map(transformComment) || []

  return (
    <Layout>
      {/* Back navigation */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <Link
          to="/agora"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('thread.backToAgora')}
        </Link>
      </div>

      {/* Thread header */}
      <div className={`px-4 py-6 ${isInstitutional ? 'bg-violet-50' : 'bg-white'}`}>
        {/* Institutional indicator */}
        {isInstitutional && (
          <div className="flex items-center gap-1.5 text-sm text-violet-700 mb-3">
            <Building2 className="w-4 h-4" />
            <span className="font-medium">{t('thread.officialChannel')}</span>
          </div>
        )}

        {/* Scope and meta */}
        <div className="flex items-center gap-3 mb-3">
          <ScopeBadge
            scope={thread.scope}
            municipalityName={thread.municipality?.name}
          />
          <span className="text-xs text-gray-500">
            {t('thread.posted', { time: formatRelativeTime(thread.createdAt) })}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {thread.title}
        </h1>

        {/* Tags */}
        <div className="mb-4">
          <TagList tags={thread.tags} size="md" />
        </div>

        {/* Author + Report */}
        <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
          <ActorBadge user={author} />
          {threadId && <ReportButton contentType="thread" contentId={threadId} />}
        </div>
      </div>

      {/* Main content area */}
      <div className="px-4 py-6 space-y-6">
        {/* Institutional context box - if applicable */}
        {thread.institutionalContext && (
          <InstitutionalContextBox
            context={thread.institutionalContext}
            isAiGenerated={thread.aiGenerated}
            sourceInstitutionName={thread.sourceInstitutionName}
            sourceUrl={thread.sourceUrl}
          />
        )}

        {/* Thread content */}
        <div className="bg-white rounded-xl border border-gray-200 flex">
          {/* Vote buttons */}
          <div className="flex-shrink-0 p-4 border-r border-gray-100">
            <ThreadVoteButtons
              threadId={thread.id}
              score={thread.score ?? 0}
              userVote={thread.userVote ?? 0}
              onVote={handleThreadVote}
              isLoading={voteThreadMutation.isPending}
              size="md"
            />
          </div>

          {/* Content */}
          <div className="flex-grow p-6">
            {thread.contentHtml ? (
              <div
                className="prose prose-gray max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(thread.contentHtml) }}
              />
            ) : (
              <div className="prose prose-gray max-w-none">
                {thread.content.split('\n').map((paragraph, i) => {
                  if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                    return (
                      <h3 key={i} className="font-semibold text-gray-900 mt-4 first:mt-0">
                        {paragraph.replace(/\*\*/g, '')}
                      </h3>
                    )
                  }
                  if (paragraph.startsWith('- ')) {
                    return (
                      <li key={i} className="ml-4 text-gray-700">
                        {paragraph.replace('- ', '')}
                      </li>
                    )
                  }
                  if (paragraph.trim() === '') {
                    return <br key={i} />
                  }
                  return (
                    <p key={i} className="text-gray-700 leading-relaxed">
                      {paragraph}
                    </p>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Discussion section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('thread.discussion')} ({t('replies', { count: comments.length })})
            </h2>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('thread.sort')} {sortOptions.find(o => o.value === sort)?.label}
                <ChevronDown className="w-4 h-4" />
              </button>

              {showSortMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSortMenu(false)}
                  />
                  <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
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
              placeholder={t('thread.shareThoughts')}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleSubmitComment}
                disabled={!commentContent.trim() || isSubmitting}
                className="bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t('thread.posting') : t('thread.postReply')}
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
              <p>{t('thread.noReplies')}</p>
            </div>
          )}

          {/* End marker */}
          <ContentEndMarker message={t('thread.endOfDiscussion')} />
        </div>
      </div>
    </Layout>
  )
}
