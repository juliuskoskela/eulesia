import { Link } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { Layout } from '../components/layout'
import { useConversations } from '../hooks/useApi'
import type { Conversation } from '../lib/api'

function formatTime(dateString: string | undefined): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Eilen'
  } else if (diffDays < 7) {
    return date.toLocaleDateString('fi-FI', { weekday: 'short' })
  } else {
    return date.toLocaleDateString('fi-FI', { day: 'numeric', month: 'short' })
  }
}

function getAvatarInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function ConversationItem({ conversation }: { conversation: Conversation }) {
  const { otherUser, lastMessage, unreadCount, updatedAt } = conversation

  if (!otherUser) return null

  return (
    <Link
      to={`/messages/${conversation.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
    >
      {/* Avatar */}
      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
        {otherUser.avatarUrl ? (
          <img src={otherUser.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          <span className="text-white text-sm font-bold">
            {getAvatarInitials(otherUser.name)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm truncate ${unreadCount > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>
            {otherUser.name}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
            {formatTime(lastMessage?.createdAt || updatedAt)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className={`text-sm truncate ${unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            {lastMessage
              ? lastMessage.content.substring(0, 80)
              : 'Ei viestejä vielä'
            }
          </p>
          {unreadCount > 0 && (
            <span className="ml-2 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export function MessagesPage() {
  const { data: conversations, isLoading } = useConversations()

  return (
    <Layout>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">Viestit</h1>
      </div>

      {/* Conversations list */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : conversations && conversations.length > 0 ? (
        <div className="bg-white">
          {conversations.map(conv => (
            <ConversationItem key={conv.id} conversation={conv} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-4">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Ei viestejä vielä</h2>
          <p className="text-sm text-gray-500">
            Aloita keskustelu käyttäjän profiilisivulta.
          </p>
        </div>
      )}
    </Layout>
  )
}
