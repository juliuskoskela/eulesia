import { MessageSquare, Clock, Building2, Bot, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Thread, User } from '../../types'
import { ActorBadge } from '../common/ActorBadge'
import { ScopeBadge } from '../common/ScopeBadge'
import { TagList } from '../common/TagList'

interface ThreadCardProps {
  thread: Thread
  author: User
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      return `${diffMins}m ago`
    }
    return `${diffHours}h ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
}

export function ThreadCard({ thread, author }: ThreadCardProps) {
  const isInstitutional = author.role === 'institution'
  const hasInstitutionalContext = !!thread.institutionalContext
  const isAiGenerated = thread.aiGenerated || thread.source === 'minutes_import'

  return (
    <Link
      to={`/agora/thread/${thread.id}`}
      className={`block bg-white rounded-xl p-4 hover:shadow-md transition-shadow border ${
        isAiGenerated ? 'border-purple-200' : isInstitutional ? 'border-violet-200' : 'border-gray-200'
      }`}
    >
      {/* AI/Minutes indicator */}
      {isAiGenerated && (
        <div className="flex items-center gap-1.5 text-xs text-purple-700 mb-2">
          <Bot className="w-3.5 h-3.5" />
          <span className="font-medium">Pöytäkirjayhteenveto</span>
          {thread.sourceUrl && (
            <a
              href={thread.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ml-1 flex items-center gap-0.5 text-purple-500 hover:text-purple-700 underline"
            >
              <FileText className="w-3 h-3" />
              Alkuperäinen
            </a>
          )}
        </div>
      )}

      {/* Institutional indicator */}
      {isInstitutional && !isAiGenerated && (
        <div className="flex items-center gap-1.5 text-xs text-violet-700 mb-2">
          <Building2 className="w-3.5 h-3.5" />
          <span className="font-medium">Official channel</span>
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
            {formatDate(thread.updatedAt)}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 mb-2 leading-snug">
        {thread.title}
      </h3>

      {/* Preview content */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {thread.content.split('\n')[0].replace(/[*#]/g, '')}
      </p>

      {/* Tags */}
      <div className="mb-3">
        <TagList tags={thread.tags.slice(0, 3)} />
      </div>

      {/* Footer: author + replies */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <ActorBadge user={author} size="sm" />

        <div className="flex items-center gap-1 text-sm text-gray-500">
          <MessageSquare className="w-4 h-4" />
          <span>{thread.replyCount} replies</span>
        </div>
      </div>

      {/* Institutional context indicator */}
      {hasInstitutionalContext && (
        <div className="mt-3 pt-3 border-t border-violet-100 text-xs text-violet-600 flex items-center gap-1">
          <span>📋</span>
          <span>Includes official documents, timeline & FAQ</span>
        </div>
      )}
    </Link>
  )
}
