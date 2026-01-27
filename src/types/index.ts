// Eulesia Type Definitions
// Based on prototype plan data model

export type UserRole = 'citizen' | 'institution' | 'admin'
export type InstitutionType = 'municipality' | 'agency' | 'ministry'
export type Scope = 'municipal' | 'regional' | 'national'

export interface User {
  id: string
  name: string
  role: UserRole
  verified: boolean // Always true in Eulesia
  municipality?: string
  avatarInitials: string
  institutionType?: InstitutionType
  institutionName?: string
}

export interface InstitutionalContext {
  docs?: { title: string; url: string }[]
  timeline?: { date: string; event: string }[]
  faq?: { q: string; a: string }[]
  contact?: string
}

export interface Thread {
  id: string
  title: string
  scope: Scope
  municipalityId?: string
  municipalityName?: string
  tags: string[]
  authorId: string
  institutionalContext?: InstitutionalContext
  content: string
  createdAt: string
  updatedAt: string
  replyCount: number
  // AI/Import source tracking
  source?: 'user' | 'minutes_import' | 'rss_import'
  sourceUrl?: string
  aiGenerated?: boolean
}

export interface Comment {
  id: string
  threadId: string
  authorId: string
  parentId?: string
  content: string
  createdAt: string
}

export interface Club {
  id: string
  name: string
  description: string
  rules: string[]
  moderators: string[]
  memberCount: number
  threads: string[]
  pinnedThreadId?: string
  category: string
}

export interface ClubThread {
  id: string
  clubId: string
  title: string
  authorId: string
  content: string
  createdAt: string
  updatedAt: string
  replyCount: number
  isPinned: boolean
}

export interface Service {
  id: string
  name: string
  category: string
  provider: string
  description: string
  integrationDemoType: 'booking' | 'events' | 'volunteering' | 'media'
  url?: string
}

export interface Message {
  id: string
  senderId: string
  recipientId?: string
  groupId?: string
  content: string
  createdAt: string
  isEncrypted: boolean
}

export interface MessageGroup {
  id: string
  name: string
  members: string[]
  isPrivate: boolean
}

// App state types
export interface AuthState {
  isAuthenticated: boolean
  currentUser: User | null
}

export interface FilterState {
  scope: Scope | 'all'
  tags: string[]
  followedActors: string[]
}
