import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { Layout } from '../components/layout'
import { ActorBadge } from '../components/common'
import { useConversation, useSendDM, useMarkRead } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import type { DirectMessage, UserSummary } from '../lib/api'

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
    return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Eilen ' + date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
  } else {
    return date.toLocaleDateString('fi-FI', { day: 'numeric', month: 'short' }) + ' ' +
           date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
  }
}

function getAvatarInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function MessageBubble({ message, isOwnMessage }: { message: DirectMessage; isOwnMessage: boolean }) {
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

export function DMConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const { currentUser } = useAuth()
  const { joinDm, leaveDm } = useSocket()
  const { data: conversationData, isLoading, error } = useConversation(conversationId || '')
  const sendMessageMutation = useSendDM(conversationId || '')
  const markReadMutation = useMarkRead(conversationId || '')

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
          <p className="text-red-600 mb-4">Keskustelua ei voitu ladata</p>
          <Link to="/messages" className="text-teal-600 hover:underline">
            Takaisin viesteihin
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
            <Link to="/messages" className="p-2 -ml-2 hover:bg-white/10 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            {otherUser && (
              <Link to={`/user/${otherUser.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  {otherUser.avatarUrl ? (
                    <img src={otherUser.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
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
              <p>Ei viestejä vielä</p>
              <p className="text-sm mt-1">Lähetä ensimmäinen viesti!</p>
            </div>
          ) : (
            messages.map((msg: DirectMessage) => (
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
        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Kirjoita viesti..."
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
      </div>
    </Layout>
  )
}
