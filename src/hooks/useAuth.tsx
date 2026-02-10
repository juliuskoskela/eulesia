import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import i18n from '../lib/i18n'
import { api } from '../lib/api'
import type { User } from '../lib/api'

interface SanctionInfo {
  sanctionType: 'suspension' | 'ban'
  reason: string | null
  expiresAt: string | null
}

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  currentUser: User | null
  sanction: SanctionInfo | null
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
  const [sanction, setSanction] = useState<SanctionInfo | null>(null)
  const queryClient = useQueryClient()

  const checkAuth = useCallback(async () => {
    try {
      const user = await api.getCurrentUser()
      setCurrentUser(user)
      setIsAuthenticated(true)
      setSanction(null)
      // Sync user's locale preference to i18next
      if (user.settings?.locale && user.settings.locale !== i18n.language) {
        i18n.changeLanguage(user.settings.locale)
      }
    } catch (err: any) {
      setCurrentUser(null)
      setIsAuthenticated(false)
      // Check if the error is a ban/suspension response
      if (err?.message?.includes('banned') || err?.message?.includes('suspended')) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/auth/me`, {
            credentials: 'include'
          })
          if (response.status === 403) {
            const data = await response.json()
            if (data.sanctionType) {
              setSanction({
                sanctionType: data.sanctionType,
                reason: data.reason,
                expiresAt: data.expiresAt
              })
            }
          }
        } catch {
          // Ignore secondary fetch errors
        }
      }
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
    if (user.settings?.locale) {
      i18n.changeLanguage(user.settings.locale)
    }
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
      sanction,
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
