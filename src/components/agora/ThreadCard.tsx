import { MessageSquare, Clock, Building2, Bot, FileText, Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Thread, User } from '../../types'
import { ActorBadge } from '../common/ActorBadge'
import { FollowButton } from '../common/FollowButton'
import { ScopeBadge } from '../common/ScopeBadge'
import { TagList } from '../common/TagList'
import { ThreadVoteButtons } from './ThreadVoteButtons'
import { ThreadCardMedia } from './ThreadCardMedia'
import { formatRelativeTime } from '../../lib/formatTime'

interface ThreadCardProps {
  thread: Thread & { score?: number; userVote?: number }
  author: User
  onVote?: (threadId: string, value: number) => void
  isVoting?: boolean
}

export function ThreadCard({ thread, author, onVote, isVoting = false }: ThreadCardProps) {
  const { t } = useTranslation('agora')
  const isInstitutional = author.role === 'institution'
  const isAiGenerated = thread.aiGenerated || thread.source === 'minutes_import'
  const isBotSummary = isAiGenerated && thread.source === 'rss_import'
  const isMinutesSummary = isAiGenerated && thread.source === 'minutes_import'
  const showVoting = typeof thread.score === 'number'
  // Source institution name from the resolved join, or from institutionalContext
  const sourceInstitutionName = thread.sourceInstitutionName
    || (thread.institutionalContext as any)?.institution

  const handleVote = (value: number) => {
    if (onVote) {
      onVote(thread.id, value)
    }
  }

  return (
    <div
      className={`bg-white rounded-xl hover:shadow-md transition-shadow border ${
        isAiGenerated ? 'border-purple-200' : isInstitutional ? 'border-violet-200' : 'border-gray-200'
      }`}
    >
      <div className="flex">
        {/* Vote buttons column */}
        {showVoting && (
          <div className="flex-shrink-0 py-4 pl-3 pr-2">
            <ThreadVoteButtons
              threadId={thread.id}
              score={thread.score ?? 0}
              userVote={thread.userVote ?? 0}
              onVote={handleVote}
              isLoading={isVoting}
              size="sm"
            />
          </div>
        )}

        {/* Content column */}
        <Link
          to={`/agora/thread/${thread.id}`}
          className={`flex-grow p-4 ${showVoting ? 'pl-2' : ''}`}
        >
          {/* Bot RSS import summary indicator */}
          {isBotSummary && (
            <div className="flex items-center flex-wrap gap-1.5 text-xs text-purple-700 mb-2">
              <Bot className="w-3.5 h-3.5" />
              <span className="font-medium">
                {sourceInstitutionName ? t('aiSummarySource', { source: sourceInstitutionName }) : t('aiSummary')}
              </span>
              {thread.sourceInstitutionId && (
                <FollowButton entityType="user" entityId={thread.sourceInstitutionId} size="sm" variant="ghost" />
              )}
              {thread.sourceUrl && (
                <a
                  href={thread.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-1 flex items-center gap-0.5 text-purple-500 hover:text-purple-700 underline"
                >
                  <FileText className="w-3 h-3" />
                  {t('original')}
                </a>
              )}
            </div>
          )}

          {/* Minutes import summary indicator */}
          {isMinutesSummary && (
            <div className="flex items-center flex-wrap gap-1.5 text-xs text-purple-700 mb-2">
              <Bot className="w-3.5 h-3.5" />
              <span className="font-medium">
                {sourceInstitutionName ? t('aiSummarySource', { source: sourceInstitutionName }) : t('minutesSummary')}
              </span>
              {thread.sourceInstitutionId && (
                <FollowButton entityType="user" entityId={thread.sourceInstitutionId} size="sm" variant="ghost" />
              )}
              {thread.sourceUrl && (
                <a
                  href={thread.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-1 flex items-center gap-0.5 text-purple-500 hover:text-purple-700 underline"
                >
                  <FileText className="w-3 h-3" />
                  {t('original')}
                </a>
              )}
            </div>
          )}

          {/* Institutional own post indicator */}
          {isInstitutional && !isAiGenerated && (
            <div className="flex items-center gap-1.5 text-xs text-violet-700 mb-2">
              <Building2 className="w-3.5 h-3.5" />
              <span className="font-medium">{t('officialInfo', { name: author.institutionName || author.name })}</span>
            </div>
          )}

          {/* Header: scope + meta */}
          <div className="flex items-center justify-between mb-2">
            <ScopeBadge
              scope={thread.scope}
              municipalityId={thread.municipalityId}
              municipalityName={thread.municipalityName}
            />
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatRelativeTime(thread.updatedAt)}
              </span>
            </div>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-gray-900 mb-2 leading-snug">
            {thread.title}
          </h3>

          {/* Preview content */}
          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
            {thread.content.split('\n')[0].replace(/[*#]/g, '')}
          </p>

          {/* Embedded media preview (YouTube, images, link previews) */}
          {thread.contentHtml && (
            <ThreadCardMedia contentHtml={thread.contentHtml} />
          )}

          {/* Tags */}
          <div className="mb-3">
            <TagList tags={(thread.tags || []).slice(0, 3)} />
          </div>

          {/* Footer: author + replies + share */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <ActorBadge user={author} size="sm" />

            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                {t('replies', { count: thread.replyCount })}
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const url = `${window.location.origin}/agora/thread/${thread.id}`
                  if (navigator.share) {
                    navigator.share({ title: thread.title, url })
                  } else {
                    navigator.clipboard.writeText(url)
                  }
                }}
                className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
                title={t('common:share.share')}
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </Link>
      </div>
    </div>
  )
}
