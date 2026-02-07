import { useState, useRef, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Globe, Send, Users, Settings, UserPlus, X, Trash2, Save } from 'lucide-react'
import { Layout } from '../components/layout'
import { ActorBadge } from '../components/common'
import { useRoom, useSendRoomMessage, useUpdateRoom, useDeleteRoom, useInviteToRoom } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import type { RoomMessage, UserSummary } from '../lib/api'

// Transform API user to component format
function transformUser(user: UserSummary) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    verified: true,
    avatarInitials: user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    institutionType: user.institutionType as 'municipality' | 'agency' | 'ministry' | undefined,
    institutionName: user.institutionName
  }
}

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Yesterday ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } else {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
           date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
}

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { data: roomData, isLoading, error } = useRoom(roomId || '')
  const sendMessageMutation = useSendRoomMessage(roomId || '')
  const updateRoomMutation = useUpdateRoom(roomId || '')
  const deleteRoomMutation = useDeleteRoom()
  const inviteToRoomMutation = useInviteToRoom(roomId || '')

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
  const [inviteUsername, setInviteUsername] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

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
    if (!roomId || !confirm('Are you sure you want to delete this room?')) return
    try {
      await deleteRoomMutation.mutateAsync(roomId)
      navigate('/home')
    } catch (err) {
      console.error('Failed to delete room:', err)
    }
  }

  const handleInvite = async () => {
    if (!inviteUsername.trim()) return
    try {
      await inviteToRoomMutation.mutateAsync(inviteUsername.trim())
      setInviteUsername('')
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
          <p className="text-red-600 mb-4">Failed to load room</p>
          <Link to="/home" className="text-teal-600 hover:underline">
            Back to Home
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
            <Link to="/home" className="p-2 -ml-2 hover:bg-white/10 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
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
                {owner.name}'s home • {visibility === 'public' ? 'Open to all' : 'Invite only'}
              </p>
            </div>
            {isOwner && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowInvite(true)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <UserPlus className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={handleOpenSettings}
                  className="p-2 hover:bg-white/10 rounded-lg"
                  ref={settingsRef}
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
              <span className="text-sm text-gray-600">{members.length + 1} members</span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No messages yet</p>
              <p className="text-sm mt-1">Be the first to say something!</p>
            </div>
          ) : (
            messages.map((msg: RoomMessage) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwnMessage={msg.author.id === currentUser?.id}
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
                placeholder="Write a message..."
                enterKeyHint="send"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                className="p-2 bg-teal-600 text-white rounded-full hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-shrink-0 bg-gray-100 border-t border-gray-200 px-4 py-3 text-center">
            <p className="text-sm text-gray-600">
              {currentUser ? 'You need an invitation to post here' : 'Sign in to participate'}
            </p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Room Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
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
                Delete Room
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={updateRoomMutation.isPending || !editName.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {updateRoomMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Invite to Room</h3>
              <button onClick={() => setShowInvite(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                placeholder="Enter username to invite"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-xs text-gray-500 mt-2">
                The user will receive an invitation they can accept or decline.
              </p>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviteToRoomMutation.isPending || !inviteUsername.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                {inviteToRoomMutation.isPending ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function MessageBubble({ message, isOwnMessage }: { message: RoomMessage; isOwnMessage: boolean }) {
  return (
    <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
      <div className="flex-shrink-0">
        <ActorBadge user={transformUser(message.author)} showName={false} size="sm" />
      </div>
      <div className={`max-w-[75%] ${isOwnMessage ? 'text-right' : ''}`}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-sm font-medium text-gray-900 ${isOwnMessage ? 'order-2' : ''}`}>
            {message.author.name}
          </span>
          <span className="text-xs text-gray-500">
            {formatMessageTime(message.createdAt)}
          </span>
        </div>
        <div
          className={`inline-block px-4 py-2 rounded-2xl ${
            isOwnMessage
              ? 'bg-teal-600 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-900 rounded-bl-md'
          }`}
        >
          {message.contentHtml ? (
            <div dangerouslySetInnerHTML={{ __html: message.contentHtml }} className="prose prose-sm max-w-none" />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      </div>
    </div>
  )
}
