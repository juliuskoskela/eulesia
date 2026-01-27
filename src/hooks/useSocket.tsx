import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { queryKeys } from './useApi'
import type { RoomMessage, RoomWithMessages } from '../lib/api'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  sendRoomMessage: (roomId: string, content: string) => void
  joinRoom: (roomId: string) => void
  leaveRoom: (roomId: string) => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { isAuthenticated, currentUser } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
      return
    }

    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling']
    })

    newSocket.on('connect', () => {
      setIsConnected(true)
      console.log('Socket connected')
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
      console.log('Socket disconnected')
    })

    newSocket.on('error', (error) => {
      console.error('Socket error:', error)
    })

    // Handle new room message events
    newSocket.on('new_room_message', (data: { roomId: string; message: RoomMessage }) => {
      // Update the room messages in the cache
      queryClient.setQueryData(
        queryKeys.room(data.roomId),
        (old: RoomWithMessages | undefined) => {
          if (!old) return old
          return {
            ...old,
            messages: [...old.messages, data.message]
          }
        }
      )
    })

    // Handle typing indicators
    newSocket.on('user_typing', (data: { roomId: string; userId: string; userName: string }) => {
      console.log(`${data.userName} is typing in room ${data.roomId}`)
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [isAuthenticated, currentUser, queryClient])

  const sendRoomMessage = useCallback((roomId: string, content: string) => {
    if (!socket || !isConnected) return

    socket.emit('send_room_message', {
      roomId,
      content
    })
  }, [socket, isConnected])

  const joinRoom = useCallback((roomId: string) => {
    if (!socket || !isConnected) return
    socket.emit('join_room', { roomId })
  }, [socket, isConnected])

  const leaveRoom = useCallback((roomId: string) => {
    if (!socket || !isConnected) return
    socket.emit('leave_room', { roomId })
  }, [socket, isConnected])

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      sendRoomMessage,
      joinRoom,
      leaveRoom
    }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
