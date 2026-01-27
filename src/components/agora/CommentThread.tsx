import { useState } from 'react'
import { ChevronUp, ChevronDown, MessageSquare, Minus, Plus } from 'lucide-react'
import { ActorBadge } from '../common/ActorBadge'

interface CommentAuthor {
  id: string
  name: string
  role: string
  verified?: boolean
  avatarInitials?: string
  institutionType?: 'municipality' | 'agency' | 'ministry'
  institutionName?: string
}

interface CommentWithAuthor {
  id: string
  threadId?: string
  authorId: string
  parentId?: string | null
  content: string
  contentHtml?: string
  score?: number
  depth?: number
  userVote?: number
  createdAt: string
  author: CommentAuthor
}

interface CommentItemProps {
  comment: CommentWithAuthor
  replies: CommentWithAuthor[]
  allComments: CommentWithAuthor[]
  depth: number
  onVote: (commentId: string, value: number) => void
  onReply: (commentId: string) => void
  replyingTo: string | null
  onSubmitReply: (parentId: string, content: string) => void
  onCancelReply: () => void
}

function formatCommentDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short'
  })
}

function CommentItem({
  comment,
  replies,
  allComments,
  depth,
  onVote,
  onReply,
  replyingTo,
  onSubmitReply,
  onCancelReply
}: CommentItemProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [replyContent, setReplyContent] = useState('')

  const author = comment.author
  if (!author) return null

  const isInstitution = author.role === 'institution'
  const score = comment.score || 0
  const userVote = comment.userVote || 0
  const maxVisualDepth = 6

  // Get replies to this comment
  const childReplies = allComments.filter(c => c.parentId === comment.id)

  const handleSubmitReply = () => {
    if (replyContent.trim()) {
      onSubmitReply(comment.id, replyContent)
      setReplyContent('')
    }
  }

  return (
    <div className={depth > 0 ? 'relative' : ''}>
      {/* Vertical line for nesting */}
      {depth > 0 && depth <= maxVisualDepth && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200 hover:bg-blue-400 cursor-pointer"
          style={{ marginLeft: -12 }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        />
      )}

      <div className={`${isCollapsed ? 'opacity-60' : ''}`}>
        {/* Vote column + content */}
        <div className="flex gap-2">
          {/* Vote buttons */}
          <div className="flex flex-col items-center gap-0.5 pt-1">
            <button
              onClick={() => onVote(comment.id, userVote === 1 ? 0 : 1)}
              className={`p-0.5 rounded hover:bg-gray-100 transition-colors ${
                userVote === 1 ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Upvote"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <span className={`text-xs font-medium min-w-[20px] text-center ${
              score > 0 ? 'text-orange-600' : score < 0 ? 'text-blue-600' : 'text-gray-500'
            }`}>
              {score}
            </span>
            <button
              onClick={() => onVote(comment.id, userVote === -1 ? 0 : -1)}
              className={`p-0.5 rounded hover:bg-gray-100 transition-colors ${
                userVote === -1 ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Downvote"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Comment content */}
          <div className="flex-1 min-w-0">
            {/* Collapsed state */}
            {isCollapsed ? (
              <div
                className="flex items-center gap-2 py-2 cursor-pointer hover:bg-gray-50 rounded"
                onClick={() => setIsCollapsed(false)}
              >
                <Plus className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">
                  {author.name} • {childReplies.length + 1} comments
                </span>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setIsCollapsed(true)}
                    className="p-0.5 hover:bg-gray-100 rounded"
                    title="Collapse"
                  >
                    <Minus className="w-3 h-3 text-gray-400" />
                  </button>
                  <ActorBadge user={author} size="sm" />
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">{formatCommentDate(comment.createdAt)}</span>
                </div>

                {/* Content */}
                <div className={`mt-1 rounded-lg ${
                  isInstitution ? 'bg-violet-50 p-3 border border-violet-100' : ''
                }`}>
                  {comment.contentHtml ? (
                    <div
                      className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: comment.contentHtml }}
                    />
                  ) : (
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {comment.content}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-1">
                  <button
                    onClick={() => onReply(comment.id)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 py-1 rounded transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Reply
                  </button>
                </div>

                {/* Reply form */}
                {replyingTo === comment.id && (
                  <div className="mt-3 ml-2 pl-3 border-l-2 border-blue-200">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Write a reply..."
                      className="w-full p-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleSubmitReply}
                        disabled={!replyContent.trim()}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reply
                      </button>
                      <button
                        onClick={onCancelReply}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Nested replies */}
        {!isCollapsed && childReplies.length > 0 && (
          <div className={`mt-2 ${depth < maxVisualDepth ? 'ml-6 pl-3' : 'ml-2'}`}>
            {childReplies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                replies={[]}
                allComments={allComments}
                depth={depth + 1}
                onVote={onVote}
                onReply={onReply}
                replyingTo={replyingTo}
                onSubmitReply={onSubmitReply}
                onCancelReply={onCancelReply}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface CommentThreadProps {
  comments: CommentWithAuthor[]
  onVote?: (commentId: string, value: number) => void
  onReply?: (parentId: string, content: string) => void
}

export function CommentThread({ comments, onVote, onReply }: CommentThreadProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  // Get top-level comments (no parent)
  const topLevel = comments.filter(c => !c.parentId)

  const handleVote = (commentId: string, value: number) => {
    if (onVote) {
      onVote(commentId, value)
    }
  }

  const handleReply = (commentId: string) => {
    setReplyingTo(commentId)
  }

  const handleSubmitReply = (parentId: string, content: string) => {
    if (onReply) {
      onReply(parentId, content)
    }
    setReplyingTo(null)
  }

  const handleCancelReply = () => {
    setReplyingTo(null)
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No comments yet. Be the first to contribute.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {topLevel.map(comment => (
        <CommentItem
          key={comment.id}
          comment={comment}
          replies={[]}
          allComments={comments}
          depth={0}
          onVote={handleVote}
          onReply={handleReply}
          replyingTo={replyingTo}
          onSubmitReply={handleSubmitReply}
          onCancelReply={handleCancelReply}
        />
      ))}
    </div>
  )
}
