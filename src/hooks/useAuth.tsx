import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { User } from '../lib/api'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  currentUser: User | null
  login: (username: string, password: string) => Promise<void>
  register: (data: { inviteCode: string; username: string; password: string; name: string }) => Promise<void>
  requestMagicLink: (email: string) => Promise<{ message: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const queryClient = useQueryClient()

  const checkAuth = useCallback(async () => {
    try {
      const user = await api.getCurrentUser()
      setCurrentUser(user)
      setIsAuthenticated(true)
    } catch {
      setCurrentUser(null)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = async (username: string, password: string) => {
    const user = await api.login(username, password)
    setCurrentUser(user)
    setIsAuthenticated(true)
  }

  const register = async (data: { inviteCode: string; username: string; password: string; name: string }) => {
    const user = await api.register(data)
    setCurrentUser(user)
    setIsAuthenticated(true)
  }

  const requestMagicLink = async (email: string) => {
    return api.requestMagicLink(email)
  }

  const logout = async () => {
    try {
      await api.logout()
    } catch {
      // Ignore logout errors
    } finally {
      setCurrentUser(null)
      setIsAuthenticated(false)
      queryClient.clear()
    }
  }

  const refreshUser = async () => {
    try {
      const user = await api.getCurrentUser()
      setCurrentUser(user)
    } catch {
      // Ignore refresh errors - user might have been logged out
    }
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      currentUser,
      login,
      register,
      requestMagicLink,
      logout,
      checkAuth,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
