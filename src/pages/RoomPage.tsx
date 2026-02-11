import { useState, useRef, useEffect, useCallback } from 'react'
import { sanitizeContent } from '../utils/sanitize'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Globe, Send, Users, Settings, UserPlus, X, Trash2, Save, Search, Pencil, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Layout } from '../components/layout'
import { ActorBadge, EditedIndicator, ConfirmDeleteDialog } from '../components/common'
import { useRoom, useSendRoomMessage, useUpdateRoom, useDeleteRoom, useInviteToRoom, useEditRoomMessage, useDeleteRoomMessage } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import { formatRelativeTime } from '../lib/formatTime'
import { api } from '../lib/api'
import type { RoomMessage, SearchUserResult } from '../lib/api'
import { transformAuthor } from '../utils/transforms'

export function RoomPage() {
  const { t } = useTranslation('home')
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { data: roomData, isLoading, error } = useRoom(roomId || '')
  const sendMessageMutation = useSendRoomMessage(roomId || '')
  const updateRoomMutation = useUpdateRoom(roomId || '')
  const deleteRoomMutation = useDeleteRoom()
  const inviteToRoomMutation = useInviteToRoom(roomId || '')
  const editMessageMutation = useEditRoomMessage(roomId || '')
  const deleteMessageMutation = useDeleteRoomMessage(roomId || '')

  const { joinRoom, leaveRoom } = useSocket()

  // Join/leave socket room for real-time updates
  useEffect(() => {
    if (roomId) {
      joinRoom(roomId)
      return () => { leaveRoom(roomId) }
    }
  }, [roomId, joinRoom, leaveRoom])

  const [newMessage, setNewMessage] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [inviteSearch, setInviteSearch] = useState('')
  const [inviteResults, setInviteResults] = useState<SearchUserResult[]>([])
  const [selectedUser, setSelectedUser] = useState<SearchUserResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [roomData?.messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !roomId) return

    try {
      await sendMessageMutation.mutateAsync(newMessage.trim())
      setNewMessage('')
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }

  const handleOpenSettings = () => {
    if (roomData) {
      setEditName(roomData.name)
      setEditDescription(roomData.description || '')
    }
    setShowSettings(true)
  }

  const handleSaveSettings = async () => {
    if (!editName.trim()) return
    try {
      await updateRoomMutation.mutateAsync({
        name: editName.trim(),
        description: editDescription.trim() || undefined
      })
      setShowSettings(false)
    } catch (err) {
      console.error('Failed to update room:', err)
    }
  }

  const handleDeleteRoom = async () => {
    if (!roomId || !confirm(t('room.confirmDelete'))) return
    try {
      await deleteRoomMutation.mutateAsync(roomId)
      navigate('/home')
    } catch (err) {
      console.error('Failed to delete room:', err)
    }
  }

  const handleInviteSearch = useCallback((query: string) => {
    setInviteSearch(query)
    setSelectedUser(null)

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    if (query.trim().length < 2) {
      setInviteResults([])
      return
    }

    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await api.searchUsers(query.trim(), 5)
        // Filter out current user and existing members
        const memberIds = new Set([
          currentUser?.id,
          ...roomData?.members.map(m => m.id) || [],
          roomData?.owner.id
        ])
        setInviteResults(results.filter(u => !memberIds.has(u.id)))
      } catch {
        setInviteResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [currentUser?.id, roomData?.members, roomData?.owner.id])

  const handleInvite = async () => {
    if (!selectedUser) return
    try {
      await inviteToRoomMutation.mutateAsync(selectedUser.id)
      setInviteSearch('')
      setInviteResults([])
      setSelectedUser(null)
      setShowInvite(false)
    } catch (err) {
      console.error('Failed to send invitation:', err)
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

  if (error || !roomData) {
    return (
      <Layout>
        <div className="px-4 py-12 text-center">
          <p className="text-red-600 mb-4">{t('room.loadError')}</p>
          <Link to="/home" className="text-teal-600 hover:underline">
            {t('room.backToHome')}
          </Link>
        </div>
      </Layout>
    )
  }

  const { owner, members, messages, isOwner, canPost, visibility, name, description } = roomData

  return (
    <Layout>
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 3.5rem - 5rem)' }}>
        {/* Header */}
        <div className={`px-4 py-4 flex-shrink-0 ${visibility === 'public' ? 'bg-green-700' : 'bg-amber-700'}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/10 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {visibility === 'public' ? (
                  <Globe className="w-4 h-4 text-white/80" />
                ) : (
                  <Lock className="w-4 h-4 text-white/80" />
                )}
                <h1 className="text-lg font-bold text-white">{name}</h1>
              </div>
              <p className="text-sm text-white/70">
                {t('room.ownerHome', { name: owner.name })} &bull; {visibility === 'public' ? t('room.public') : t('room.private')}
              </p>
            </div>
            {isOwner && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowInvite(true)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                  aria-label={t('room.inviteTitle')}
                >
                  <UserPlus className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={handleOpenSettings}
                  className="p-2 hover:bg-white/10 rounded-lg"
                  ref={settingsRef}
                  aria-label={t('room.settings')}
                >
                  <Settings className="w-5 h-5 text-white" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Room description */}
        {description && (
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        )}

        {/* Members info (for private rooms) */}
        {visibility === 'private' && (
          <div className="px-4 py-3 border-b border-gray-200 flex items-center flex-shrink-0">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">{t('rooms.members', { count: members.length + 1 })}</span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>{t('room.noMessages')}</p>
              <p className="text-sm mt-1">{t('room.noMessagesHint')}</p>
            </div>
          ) : (
            messages.map((msg: RoomMessage) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwnMessage={msg.author?.id === currentUser?.id}
                isOwnerOrAdmin={isOwner || currentUser?.role === 'admin'}
                onEdit={(messageId, content) => editMessageMutation.mutate({ messageId, content })}
                onDelete={(messageId) => deleteMessageMutation.mutate(messageId)}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        {canPost ? (
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={t('room.writeMessage')}
                enterKeyHint="send"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                className="p-2 bg-teal-600 text-white rounded-full hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t('room.sendMessage')}
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-shrink-0 bg-gray-100 border-t border-gray-200 px-4 py-3 text-center">
            <p className="text-sm text-gray-600">
              {currentUser ? t('room.needInvitation') : t('room.signInToPost')}
            </p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="room-settings-title">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 id="room-settings-title" className="font-semibold text-gray-900">{t('room.settings')}</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded" aria-label={t('common:actions.close')}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('room.editName')}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('room.editDescription')}</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={handleDeleteRoom}
                disabled={deleteRoomMutation.isPending}
                className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {t('room.deleteRoom')}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {t('common:actions.cancel')}
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={updateRoomMutation.isPending || !editName.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {updateRoomMutation.isPending ? t('room.saving') : t('common:actions.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="room-invite-title">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 id="room-invite-title" className="font-semibold text-gray-900">{t('room.inviteTitle')}</h3>
              <button onClick={() => { setShowInvite(false); setInviteSearch(''); setInviteResults([]); setSelectedUser(null) }} className="p-1 hover:bg-gray-100 rounded" aria-label={t('common:actions.close')}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('room.inviteSearchLabel')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={inviteSearch}
                  onChange={(e) => handleInviteSearch(e.target.value)}
                  placeholder={t('room.invitePlaceholder')}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  autoFocus
                />
              </div>

              {/* Search results */}
              {inviteSearch.trim().length >= 2 && (
                <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                  {isSearching ? (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      {t('room.inviteSearching')}
                    </div>
                  ) : inviteResults.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      {t('room.inviteNoResults')}
                    </div>
                  ) : (
                    inviteResults.map(user => (
                      <button
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                          selectedUser?.id === user.id ? 'bg-teal-50 border-l-2 border-teal-600' : ''
                        }`}
                      >
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                          {user.institutionName && (
                            <p className="text-xs text-gray-500 truncate">{user.institutionName}</p>
                          )}
                          {user.municipalityName && !user.institutionName && (
                            <p className="text-xs text-gray-500 truncate">{user.municipalityName}</p>
                          )}
                        </div>
                        {selectedUser?.id === user.id && (
                          <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              <p className="text-xs text-gray-500 mt-2">
                {t('room.inviteHint')}
              </p>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => { setShowInvite(false); setInviteSearch(''); setInviteResults([]); setSelectedUser(null) }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {t('common:actions.cancel')}
              </button>
              <button
                onClick={handleInvite}
                disabled={inviteToRoomMutation.isPending || !selectedUser}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                {inviteToRoomMutation.isPending ? t('room.inviteSending') : t('room.inviteSend')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

interface MessageBubbleProps {
  message: RoomMessage
  isOwnMessage: boolean
  isOwnerOrAdmin: boolean
  onEdit: (messageId: string, content: string) => void
  onDelete: (messageId: string) => void
}

function MessageBubble({ message, isOwnMessage, isOwnerOrAdmin, onEdit, onDelete }: MessageBubbleProps) {
  const { t } = useTranslation(['home', 'common'])
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Deleted message placeholder
  if (message.isHidden) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-gray-400 italic">{t('common:messageDeleted')}</span>
      </div>
    )
  }

  const canEdit = isOwnMessage
  const canDelete = isOwnMessage || isOwnerOrAdmin

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
        {message.author && <ActorBadge user={transformAuthor(message.author)} showName={false} size="sm" />}
      </div>
      <div className={`max-w-[75%] ${isOwnMessage ? 'text-right' : ''}`}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-sm font-medium text-gray-900 ${isOwnMessage ? 'order-2' : ''}`}>
            {message.author?.name}
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
            {/* Hover actions */}
            {(canEdit || canDelete) && (
              <div className={`absolute top-0 ${isOwnMessage ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5`}>
                {canEdit && (
                  <button
                    onClick={handleStartEdit}
                    className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                    title={t('common:actions.edit')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-600"
                    title={t('common:actions.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
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
