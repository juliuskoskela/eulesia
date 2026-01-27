const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include' // Include cookies
    })

    const data: ApiResponse<T> = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Request failed')
    }

    return data.data as T
  }

  // Auth
  async requestMagicLink(email: string): Promise<{ message: string }> {
    return this.request('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email })
    })
  }

  async login(username: string, password: string): Promise<User> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
  }

  async register(data: { inviteCode: string; username: string; password: string; name: string }): Promise<User> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' })
  }

  async getCurrentUser(): Promise<User> {
    return this.request('/auth/me')
  }

  // Invites
  async getInvites(): Promise<InvitesData> {
    return this.request('/invites')
  }

  async createInvite(): Promise<InviteCode> {
    return this.request('/invites', { method: 'POST' })
  }

  async validateInviteCode(code: string): Promise<InviteValidation> {
    return this.request(`/invites/validate/${code}`)
  }

  async revokeInvite(id: string): Promise<void> {
    await this.request(`/invites/${id}`, { method: 'DELETE' })
  }

  async getInviteTree(): Promise<InvitedUser[]> {
    return this.request('/invites/tree')
  }

  // Users
  async getUser(id: string): Promise<User> {
    return this.request(`/users/${id}`)
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    return this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  }

  async exportData(): Promise<unknown> {
    return this.request('/users/me/data')
  }

  // Agora - Threads
  async getThreads(params?: ThreadFilters): Promise<PaginatedResponse<Thread>> {
    const searchParams = new URLSearchParams()
    if (params?.scope) searchParams.set('scope', params.scope)
    if (params?.municipalityId) searchParams.set('municipalityId', params.municipalityId)
    if (params?.tags?.length) searchParams.set('tags', params.tags.join(','))
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    return this.request(`/agora/threads${query ? `?${query}` : ''}`)
  }

  async getThread(id: string, sort?: 'best' | 'new' | 'old' | 'controversial'): Promise<ThreadWithComments> {
    const query = sort ? `?sort=${sort}` : ''
    return this.request(`/agora/threads/${id}${query}`)
  }

  async voteComment(commentId: string, value: number): Promise<{ commentId: string; score: number; userVote: number }> {
    return this.request(`/agora/comments/${commentId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ value })
    })
  }

  async createThread(data: CreateThreadData): Promise<Thread> {
    return this.request('/agora/threads', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async addComment(threadId: string, data: CreateCommentData): Promise<Comment> {
    return this.request(`/agora/threads/${threadId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getTags(): Promise<{ tag: string; count: number }[]> {
    return this.request('/agora/tags')
  }

  // Clubs
  async getClubs(params?: ClubFilters): Promise<PaginatedResponse<Club>> {
    const searchParams = new URLSearchParams()
    if (params?.category) searchParams.set('category', params.category)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    return this.request(`/clubs${query ? `?${query}` : ''}`)
  }

  async getClub(id: string): Promise<ClubWithThreads> {
    return this.request(`/clubs/${id}`)
  }

  async createClub(data: CreateClubData): Promise<Club> {
    return this.request('/clubs', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async joinClub(clubId: string): Promise<void> {
    await this.request(`/clubs/${clubId}/join`, { method: 'POST' })
  }

  async leaveClub(clubId: string): Promise<void> {
    await this.request(`/clubs/${clubId}/leave`, { method: 'POST' })
  }

  async createClubThread(clubId: string, data: CreateClubThreadData): Promise<ClubThread> {
    return this.request(`/clubs/${clubId}/threads`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getClubThread(clubId: string, threadId: string): Promise<ClubThreadWithComments> {
    return this.request(`/clubs/${clubId}/threads/${threadId}`)
  }

  async addClubComment(clubId: string, threadId: string, data: CreateCommentData): Promise<ClubComment> {
    return this.request(`/clubs/${clubId}/threads/${threadId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getClubCategories(): Promise<{ category: string; count: number }[]> {
    return this.request('/clubs/meta/categories')
  }

  // Home
  async getHome(userId: string): Promise<HomeData> {
    return this.request(`/home/${userId}`)
  }

  async createRoom(data: CreateRoomData): Promise<Room> {
    return this.request('/home/rooms', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getRoom(roomId: string): Promise<RoomWithMessages> {
    return this.request(`/home/rooms/${roomId}`)
  }

  async updateRoom(roomId: string, data: Partial<CreateRoomData>): Promise<Room> {
    return this.request(`/home/rooms/${roomId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.request(`/home/rooms/${roomId}`, { method: 'DELETE' })
  }

  async sendRoomMessage(roomId: string, content: string): Promise<RoomMessage> {
    return this.request(`/home/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    })
  }

  async inviteToRoom(roomId: string, username: string): Promise<RoomInvitation> {
    return this.request(`/home/rooms/${roomId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ username })
    })
  }

  async getInvitations(): Promise<RoomInvitationWithDetails[]> {
    return this.request('/home/invitations')
  }

  async acceptInvitation(invitationId: string): Promise<void> {
    await this.request(`/home/invitations/${invitationId}/accept`, { method: 'POST' })
  }

  async declineInvitation(invitationId: string): Promise<void> {
    await this.request(`/home/invitations/${invitationId}/decline`, { method: 'POST' })
  }

  async leaveRoom(roomId: string): Promise<void> {
    await this.request(`/home/rooms/${roomId}/members/me`, { method: 'DELETE' })
  }

  // Map
  async getMapPoints(bounds: MapBounds): Promise<{ points: MapPoint[] }> {
    const searchParams = new URLSearchParams()
    searchParams.set('north', bounds.north.toString())
    searchParams.set('south', bounds.south.toString())
    searchParams.set('east', bounds.east.toString())
    searchParams.set('west', bounds.west.toString())
    if (bounds.types) searchParams.set('types', bounds.types)
    if (bounds.categories) searchParams.set('categories', bounds.categories)

    return this.request(`/map/points?${searchParams.toString()}`)
  }

  async getLocationDetails(type: string, id: string): Promise<LocationDetails> {
    return this.request(`/map/location/${type}/${id}`)
  }

  async getPlaces(params?: {
    type?: string
    category?: string
    municipalityId?: string
    search?: string
    page?: number
    limit?: number
  }): Promise<PaginatedResponse<Place>> {
    const searchParams = new URLSearchParams()
    if (params?.type) searchParams.set('type', params.type)
    if (params?.category) searchParams.set('category', params.category)
    if (params?.municipalityId) searchParams.set('municipalityId', params.municipalityId)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    return this.request(`/map/places${query ? `?${query}` : ''}`)
  }

  async createPlace(data: CreatePlaceData): Promise<Place> {
    return this.request('/map/places', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getPlaceCategories(): Promise<{ category: string; count: number }[]> {
    return this.request('/map/places/categories')
  }

  async getMunicipalities(): Promise<Municipality[]> {
    return this.request('/map/municipalities')
  }
}

// Types
export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: 'citizen' | 'institution' | 'admin'
  institutionType?: 'municipality' | 'agency' | 'ministry'
  institutionName?: string
  municipality?: Municipality
  identityVerified: boolean
  identityLevel: 'basic' | 'substantial' | 'high'
  settings?: {
    notificationReplies: boolean
    notificationMentions: boolean
    notificationOfficial: boolean
    locale: string
  }
  createdAt: string
}

export interface Municipality {
  id: string
  name: string
  nameFi?: string
  nameSv?: string
  region?: string
}

export interface Thread {
  id: string
  title: string
  content: string
  contentHtml?: string
  scope: 'municipal' | 'regional' | 'national'
  tags: string[]
  author: UserSummary
  municipality?: Municipality
  institutionalContext?: InstitutionalContext
  replyCount: number
  createdAt: string
  updatedAt: string
}

export interface ThreadWithComments extends Thread {
  comments: Comment[]
}

export interface Comment {
  id: string
  content: string
  contentHtml?: string
  author: UserSummary
  parentId?: string | null
  score?: number
  depth?: number
  userVote?: number
  createdAt: string
}

export interface UserSummary {
  id: string
  name: string
  avatarUrl?: string
  role: 'citizen' | 'institution' | 'admin'
  institutionType?: string
  institutionName?: string
}

export interface InstitutionalContext {
  docs?: { title: string; url: string }[]
  timeline?: { date: string; event: string }[]
  faq?: { q: string; a: string }[]
  contact?: string
}

export interface Club {
  id: string
  name: string
  slug: string
  description?: string
  rules?: string[]
  category?: string
  memberCount: number
  creator: UserSummary
  isMember: boolean
  createdAt: string
}

export interface ClubWithThreads extends Club {
  moderators: UserSummary[]
  threads: ClubThread[]
  memberRole?: string
}

export interface ClubThread {
  id: string
  title: string
  content: string
  contentHtml?: string
  author: UserSummary
  isPinned: boolean
  replyCount: number
  createdAt: string
  updatedAt: string
}

export interface ClubThreadWithComments extends ClubThread {
  comments: ClubComment[]
}

export interface ClubComment extends Comment {}

// Home types
export interface Room {
  id: string
  name: string
  description?: string
  visibility: 'public' | 'private'
  isPinned: boolean
  messageCount: number
  createdAt: string
  updatedAt: string
  canAccess?: boolean
}

export interface RoomWithMessages extends Room {
  owner: UserSummary
  members: UserSummary[]
  messages: RoomMessage[]
  isOwner: boolean
  canPost: boolean
}

export interface RoomMessage {
  id: string
  content: string
  contentHtml?: string
  author: UserSummary
  createdAt: string
  updatedAt: string
}

export interface RoomInvitation {
  id: string
  roomId: string
  inviterId: string
  inviteeId: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: string
}

export interface RoomInvitationWithDetails extends RoomInvitation {
  room: { id: string; name: string; description?: string }
  inviter: UserSummary
}

export interface HomeData {
  owner: UserSummary
  rooms: Room[]
  recentActivity: {
    threads: { id: string; title: string; scope: string; createdAt: string }[]
    clubs: { id: string; name: string; slug: string }[]
  }
  isOwnHome: boolean
}

// Filter types
export interface ThreadFilters {
  scope?: 'municipal' | 'regional' | 'national'
  municipalityId?: string
  tags?: string[]
  page?: number
  limit?: number
}

export interface ClubFilters {
  category?: string
  search?: string
  page?: number
  limit?: number
}

// Create types
export interface CreateThreadData {
  title: string
  content: string
  scope: 'municipal' | 'regional' | 'national'
  municipalityId?: string
  tags?: string[]
  institutionalContext?: InstitutionalContext
}

export interface CreateCommentData {
  content: string
  parentId?: string
}

export interface CreateClubData {
  name: string
  slug: string
  description?: string
  rules?: string[]
  category?: string
}

export interface CreateClubThreadData {
  title: string
  content: string
}

export interface CreateRoomData {
  name: string
  description?: string
  visibility?: 'public' | 'private'
}

// Map types
export interface MapPoint {
  id: string
  type: 'municipality' | 'place' | 'thread' | 'club'
  name: string
  latitude: number
  longitude: number
  meta: {
    threadCount?: number
    memberCount?: number
    category?: string
    scope?: string
    placeType?: string
  }
}

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
  types?: string
  categories?: string
}

export interface Place {
  id: string
  name: string
  nameFi?: string
  nameSv?: string
  description?: string
  latitude?: string
  longitude?: string
  radiusKm?: string
  geojson?: unknown
  type: 'poi' | 'area' | 'route' | 'landmark'
  category?: string
  municipalityId?: string
  municipality?: Municipality
  createdAt: string
}

export interface CreatePlaceData {
  name: string
  nameFi?: string
  nameSv?: string
  description?: string
  latitude?: number
  longitude?: number
  radiusKm?: number
  geojson?: unknown
  type: 'poi' | 'area' | 'route' | 'landmark'
  category?: string
  municipalityId?: string
}

export interface LocationDetails {
  id: string
  name: string
  latitude?: string
  longitude?: string
  threads?: Thread[]
  clubs?: Club[]
  municipality?: Municipality
  place?: Place
}

// Invite types
export interface InviteCode {
  id: string
  code: string
  status: 'available' | 'used' | 'revoked'
  usedAt?: string
  createdAt: string
  usedBy?: { name: string } | null
}

export interface InviteValidation {
  valid: boolean
  reason?: string
  invitedBy?: string
}

export interface InvitesData {
  codes: InviteCode[]
  remaining: number
}

export interface InvitedUser {
  id: string
  name: string
  username: string
  createdAt: string
}

// Export singleton instance
export const api = new ApiClient(API_URL)
