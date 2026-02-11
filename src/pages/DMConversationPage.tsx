import { useState, useRef, useEffect } from 'react'
import { sanitizeContent } from '../utils/sanitize'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Pencil, Trash2, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Layout } from '../components/layout'
import { ActorBadge, EditedIndicator, ConfirmDeleteDialog } from '../components/common'
import { useConversation, useSendDM, useMarkRead, useEditDirectMessage, useDeleteDirectMessage } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import { formatRelativeTime } from '../lib/formatTime'
import type { DirectMessage } from '../lib/api'
import { transformAuthor, getAvatarInitials } from '../utils/transforms'

interface DMMessageBubbleProps {
  message: DirectMessage
  isOwnMessage: boolean
  onEdit: (messageId: string, content: string) => void
  onDelete: (messageId: string) => void
}

function MessageBubble({ message, isOwnMessage, onEdit, onDelete }: DMMessageBubbleProps) {
  const { t } = useTranslation('messages')
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleStartEdit = () => {
    setEditContent(message.content)
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      onEdit(message.id, editContent.trim())
      setIsEditing(false)
    }
  }

  return (
    <div className={`group flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
      <div className="flex-shrink-0">
        <ActorBadge user={transformAuthor(message.author)} showName={false} size="sm" />
      </div>
      <div className={`max-w-[75%] ${isOwnMessage ? 'text-right' : ''}`}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-sm font-medium text-gray-900 ${isOwnMessage ? 'order-2' : ''}`}>
            {message.author.name}
          </span>
          <span className="text-xs text-gray-500">
            {formatRelativeTime(message.createdAt)}
          </span>
          {message.editedAt && (
            <EditedIndicator editedAt={message.editedAt} />
          )}
        </div>
        {isEditing ? (
          <div className="text-left">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleSaveEdit}
                disabled={!editContent.trim()}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50"
              >
                <Check className="w-3 h-3" />
                {t('common:actions.save')}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                {t('common:actions.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative inline-block">
            <div
              className={`px-4 py-2 rounded-2xl ${
                isOwnMessage
                  ? 'bg-teal-600 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-900 rounded-bl-md'
              }`}
            >
              {message.contentHtml ? (
                <div dangerouslySetInnerHTML={{ __html: sanitizeContent(message.contentHtml) }} className="prose prose-sm max-w-none" />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
            {/* Hover actions - only own messages */}
            {isOwnMessage && (
              <div className="absolute top-0 left-0 -translate-x-full pr-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                <button
                  onClick={handleStartEdit}
                  className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                  title={t('common:actions.edit')}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-600"
                  title={t('common:actions.delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <ConfirmDeleteDialog
        open={showDeleteConfirm}
        type="message"
        onConfirm={() => { onDelete(message.id); setShowDeleteConfirm(false) }}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}

export function DMConversationPage() {
  const { t } = useTranslation('messages')
  const navigate = useNavigate()
  const { conversationId } = useParams<{ conversationId: string }>()
  const { currentUser } = useAuth()
  const { joinDm, leaveDm } = useSocket()
  const { data: conversationData, isLoading, error } = useConversation(conversationId || '')
  const sendMessageMutation = useSendDM(conversationId || '')
  const markReadMutation = useMarkRead(conversationId || '')
  const editMessageMutation = useEditDirectMessage(conversationId || '')
  const deleteMessageMutation = useDeleteDirectMessage(conversationId || '')

  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Join/leave socket room
  useEffect(() => {
    if (conversationId) {
      joinDm(conversationId)
      return () => { leaveDm(conversationId) }
    }
  }, [conversationId, joinDm, leaveDm])

  // Mark as read when conversation loads
  useEffect(() => {
    if (conversationId && conversationData) {
      markReadMutation.mutate()
    }
  }, [conversationId, conversationData?.id])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversationData?.messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !conversationId) return

    try {
      await sendMessageMutation.mutateAsync(newMessage.trim())
      setNewMessage('')
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    )
  }

  if (error || !conversationData) {
    return (
      <Layout>
        <div className="px-4 py-12 text-center">
          <p className="text-red-600 mb-4">{t('loadError')}</p>
          <Link to="/messages" className="text-teal-600 hover:underline">
            {t('backToMessages')}
          </Link>
        </div>
      </Layout>
    )
  }

  const { otherUser, messages } = conversationData

  return (
    <Layout>
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 3.5rem - 5rem)' }}>
        {/* Header */}
        <div className="bg-teal-700 px-4 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/10 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            {otherUser && (
              <Link to={`/user/${otherUser.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  {otherUser.avatarUrl ? (
                    <img src={otherUser.avatarUrl} alt={otherUser.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-white text-sm font-bold">
                      {getAvatarInitials(otherUser.name)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold text-white truncate">{otherUser.name}</h1>
                  {otherUser.institutionName && (
                    <p className="text-sm text-white/70 truncate">{otherUser.institutionName}</p>
                  )}
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>{t('noMessagesYet')}</p>
              <p className="text-sm mt-1">{t('sendFirstMessage')}</p>
            </div>
          ) : (
            messages.map((msg: DirectMessage) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwnMessage={msg.author.id === currentUser?.id}
                onEdit={(messageId, content) => editMessageMutation.mutate({ messageId, content })}
                onDelete={(messageId) => deleteMessageMutation.mutate(messageId)}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t('writeMessage')}
              enterKeyHint="send"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
              className="p-2 bg-teal-600 text-white rounded-full hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t('sendMessage')}
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}
