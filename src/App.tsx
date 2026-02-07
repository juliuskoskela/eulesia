import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { SocketProvider } from './hooks/useSocket'
import {
  LoginPage,
  AgoraPage,
  ThreadPage,
  ClubsPage,
  ClubViewPage,
  ClubThreadPage,
  MapPage,
  HomePage,
  RoomPage,
  ProfilePage,
  ServicesPage,
  AboutPage,
  MunicipalitiesPage,
  MunicipalityPage,
  UserProfilePage,
  TagPage,
  TopicsPage,
  MessagesPage,
  DMConversationPage,
  UserHomePage
} from './pages'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-blue-800 font-bold text-3xl">E</span>
        </div>
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/agora" replace /> : <LoginPage />}
      />
      <Route
        path="/auth/verify/:token"
        element={<MagicLinkVerify />}
      />
      <Route
        path="/auth/callback"
        element={<AuthCallback />}
      />

      {/* Protected routes */}
      <Route
        path="/agora"
        element={
          <ProtectedRoute>
            <AgoraPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agora/thread/:threadId"
        element={
          <ProtectedRoute>
            <ThreadPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agora/tag/:tagName"
        element={
          <ProtectedRoute>
            <TagPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/kunnat"
        element={
          <ProtectedRoute>
            <MunicipalitiesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kunnat/:municipalityId"
        element={
          <ProtectedRoute>
            <MunicipalityPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/clubs"
        element={
          <ProtectedRoute>
            <ClubsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clubs/:clubId"
        element={
          <ProtectedRoute>
            <ClubViewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clubs/:clubId/thread/:threadId"
        element={
          <ProtectedRoute>
            <ClubThreadPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/map"
        element={
          <ProtectedRoute>
            <MapPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/home/room/:roomId"
        element={
          <ProtectedRoute>
            <RoomPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/home/:userId"
        element={
          <ProtectedRoute>
            <UserHomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <MessagesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages/:conversationId"
        element={
          <ProtectedRoute>
            <DMConversationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/services"
        element={
          <ProtectedRoute>
            <ServicesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/about"
        element={
          <ProtectedRoute>
            <AboutPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/aiheet"
        element={
          <ProtectedRoute>
            <TopicsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/user/:userId"
        element={
          <ProtectedRoute>
            <UserProfilePage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// Auth callback - handles redirect from API after successful magic link verification
function AuthCallback() {
  const { checkAuth } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search)
      if (params.get('success') === 'true') {
        await checkAuth()
        navigate('/agora')
      } else {
        navigate('/?error=auth_failed')
      }
    }
    handleCallback()
  }, [checkAuth, navigate])

  return <LoadingScreen />
}

// Magic link verification component (for direct frontend verification)
function MagicLinkVerify() {
  const { checkAuth } = useAuth()
  const navigate = useNavigate()
  const { token } = useParams<{ token: string }>()

  useEffect(() => {
    async function verify() {
      if (!token) {
        navigate('/')
        return
      }

      try {
        // The backend will set the session cookie when we visit this URL
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/auth/verify/${token}`,
          { credentials: 'include' }
        )

        if (response.ok) {
          await checkAuth()
          navigate('/agora')
        } else {
          navigate('/?error=invalid_link')
        }
      } catch {
        navigate('/?error=verification_failed')
      }
    }

    verify()
  }, [token, checkAuth, navigate])

  return <LoadingScreen />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
