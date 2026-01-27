import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Lock, Globe, Send, Users, Settings, UserPlus } from 'lucide-react'
import { Layout } from '../components/layout'
import { ActorBadge } from '../components/common'
import { useRoom, useSendRoomMessage } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
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
  const { currentUser } = useAuth()
  const { data: roomData, isLoading, error } = useRoom(roomId || '')
  const sendMessageMutation = useSendRoomMessage(roomId || '')
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
      {/* Header */}
      <div className={`px-4 py-4 ${visibility === 'public' ? 'bg-green-700' : 'bg-amber-700'}`}>
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
            <button className="p-2 hover:bg-white/10 rounded-lg">
              <Settings className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Room description */}
      {description && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      )}

      {/* Members (for private rooms) */}
      {visibility === 'private' && members.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{members.length + 1} members</span>
          </div>
          {isOwner && (
            <button className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1">
              <UserPlus className="w-4 h-4" />
              Invite
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ minHeight: '300px', maxHeight: 'calc(100vh - 350px)' }}>
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
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Write a message..."
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
        <div className="sticky bottom-0 bg-gray-100 border-t border-gray-200 px-4 py-3 text-center">
          <p className="text-sm text-gray-600">
            {currentUser ? 'You need an invitation to post here' : 'Sign in to participate'}
          </p>
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
