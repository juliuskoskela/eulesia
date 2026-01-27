import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type {
  ThreadFilters,
  ClubFilters,
  CreateThreadData,
  CreateCommentData,
  CreateClubData,
  CreateClubThreadData,
  CreateRoomData
} from '../lib/api'

export type CommentSort = 'best' | 'new' | 'old' | 'controversial'

// Query keys
export const queryKeys = {
  // Auth
  currentUser: ['currentUser'] as const,

  // Threads
  threads: (filters?: ThreadFilters) => ['threads', filters] as const,
  thread: (id: string, sort?: CommentSort) => ['thread', id, sort] as const,
  tags: ['tags'] as const,

  // Clubs
  clubs: (filters?: ClubFilters) => ['clubs', filters] as const,
  club: (id: string) => ['club', id] as const,
  clubThread: (clubId: string, threadId: string) => ['clubThread', clubId, threadId] as const,
  clubCategories: ['clubCategories'] as const,

  // Home
  home: (userId: string) => ['home', userId] as const,
  room: (id: string) => ['room', id] as const,
  invitations: ['invitations'] as const
}

// Auth hooks
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: () => api.getCurrentUser(),
    retry: false,
    staleTime: 1000 * 60 * 10 // 10 minutes
  })
}

export function useRequestMagicLink() {
  return useMutation({
    mutationFn: (email: string) => api.requestMagicLink(email)
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      queryClient.clear()
    }
  })
}

// Thread hooks
export function useThreads(filters?: ThreadFilters) {
  return useQuery({
    queryKey: queryKeys.threads(filters),
    queryFn: () => api.getThreads(filters)
  })
}

export function useThread(id: string, sort: CommentSort = 'best') {
  return useQuery({
    queryKey: queryKeys.thread(id, sort),
    queryFn: () => api.getThread(id, sort),
    enabled: !!id
  })
}

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: () => api.getTags()
  })
}

export function useCreateThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateThreadData) => api.createThread(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] })
    }
  })
}

export function useAddComment(threadId: string, sort?: CommentSort) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCommentData) => api.addComment(threadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.thread(threadId, sort) })
      queryClient.invalidateQueries({ queryKey: ['threads'] })
    }
  })
}

export function useVoteComment(threadId: string, sort?: CommentSort) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ commentId, value }: { commentId: string; value: number }) =>
      api.voteComment(commentId, value),
    onSuccess: (data) => {
      // Update the thread cache with new score
      queryClient.setQueryData(
        queryKeys.thread(threadId, sort),
        (old: any) => {
          if (!old) return old
          return {
            ...old,
            comments: old.comments.map((c: any) =>
              c.id === data.commentId
                ? { ...c, score: data.score, userVote: data.userVote }
                : c
            )
          }
        }
      )
    }
  })
}

// Club hooks
export function useClubs(filters?: ClubFilters) {
  return useQuery({
    queryKey: queryKeys.clubs(filters),
    queryFn: () => api.getClubs(filters)
  })
}

export function useClub(id: string) {
  return useQuery({
    queryKey: queryKeys.club(id),
    queryFn: () => api.getClub(id),
    enabled: !!id
  })
}

export function useClubCategories() {
  return useQuery({
    queryKey: queryKeys.clubCategories,
    queryFn: () => api.getClubCategories()
  })
}

export function useCreateClub() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateClubData) => api.createClub(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
    }
  })
}

export function useJoinClub() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (clubId: string) => api.joinClub(clubId),
    onSuccess: (_, clubId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.club(clubId) })
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
    }
  })
}

export function useLeaveClub() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (clubId: string) => api.leaveClub(clubId),
    onSuccess: (_, clubId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.club(clubId) })
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
    }
  })
}

export function useClubThread(clubId: string, threadId: string) {
  return useQuery({
    queryKey: queryKeys.clubThread(clubId, threadId),
    queryFn: () => api.getClubThread(clubId, threadId),
    enabled: !!clubId && !!threadId
  })
}

export function useCreateClubThread(clubId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateClubThreadData) => api.createClubThread(clubId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.club(clubId) })
    }
  })
}

export function useAddClubComment(clubId: string, threadId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCommentData) => api.addClubComment(clubId, threadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clubThread(clubId, threadId) })
    }
  })
}

// Home hooks
export function useHome(userId: string) {
  return useQuery({
    queryKey: queryKeys.home(userId),
    queryFn: () => api.getHome(userId),
    enabled: !!userId
  })
}

export function useRoom(roomId: string) {
  return useQuery({
    queryKey: queryKeys.room(roomId),
    queryFn: () => api.getRoom(roomId),
    enabled: !!roomId
  })
}

export function useInvitations() {
  return useQuery({
    queryKey: queryKeys.invitations,
    queryFn: () => api.getInvitations()
  })
}

export function useCreateRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateRoomData) => api.createRoom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home'] })
    }
  })
}

export function useUpdateRoom(roomId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<CreateRoomData>) => api.updateRoom(roomId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) })
      queryClient.invalidateQueries({ queryKey: ['home'] })
    }
  })
}

export function useDeleteRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (roomId: string) => api.deleteRoom(roomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home'] })
    }
  })
}

export function useSendRoomMessage(roomId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (content: string) => api.sendRoomMessage(roomId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) })
    }
  })
}

export function useInviteToRoom(roomId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => api.inviteToRoom(roomId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) })
    }
  })
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invitationId: string) => api.acceptInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations })
      queryClient.invalidateQueries({ queryKey: ['home'] })
    }
  })
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invitationId: string) => api.declineInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations })
    }
  })
}

// User hooks
export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Parameters<typeof api.updateProfile>[0]) => api.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser })
    }
  })
}

export function useExportData() {
  return useMutation({
    mutationFn: () => api.exportData()
  })
}
