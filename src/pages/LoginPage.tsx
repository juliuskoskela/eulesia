import { useState } from 'react'
import { Shield, Fingerprint, CheckCircle, Lock, Users, Building2, UserPlus, LogIn, ArrowRight, ArrowLeft, Ticket } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'

type LoginStep = 'initial' | 'login' | 'register' | 'invite-check'

export function LoginPage() {
  const { login, register } = useAuth()
  const [step, setStep] = useState<LoginStep>('initial')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Login form
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form
  const [inviteCode, setInviteCode] = useState('')
  const [inviteValid, setInviteValid] = useState(false)
  const [invitedBy, setInvitedBy] = useState<string | null>(null)
  const [regUsername, setRegUsername] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regName, setRegName] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await login(loginUsername, loginPassword)
      // Navigation handled by App.tsx
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await api.validateInviteCode(inviteCode)
      if (result.valid) {
        setInviteValid(true)
        setInvitedBy(result.invitedBy || null)
        setStep('register')
      } else {
        setError(result.reason || 'Invalid invite code')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate invite code')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await register({
        inviteCode,
        username: regUsername,
        password: regPassword,
        name: regName
      })
      // Navigation handled by App.tsx
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 flex flex-col">
      {/* Header */}
      <header className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <span className="text-blue-800 font-bold text-xl">E</span>
          </div>
          <span className="text-white font-semibold text-2xl">Eulesia</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col justify-center px-6 pb-12">
        <div className="max-w-md mx-auto w-full">
          {/* Tagline */}
          <h1 className="text-white text-3xl font-bold mb-3">
            Civic space for the digital age
          </h1>
          <p className="text-blue-200 text-lg mb-8">
            Public infrastructure, not private platform. Real identity, not anonymity.
            Deliberation, not distraction.
          </p>

          {/* Login/Register card */}
          <div className="bg-white rounded-2xl p-6 shadow-xl">
            {step === 'initial' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Fingerprint className="w-6 h-6 text-blue-800" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Welcome to Eulesia</h2>
                    <p className="text-sm text-gray-500">Invite-only beta</p>
                  </div>
                </div>

                <button
                  onClick={() => setStep('login')}
                  className="w-full bg-blue-800 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 mb-3"
                >
                  <LogIn className="w-5 h-5" />
                  Sign In
                </button>

                <button
                  onClick={() => setStep('invite-check')}
                  className="w-full bg-white text-blue-800 border-2 border-blue-800 py-3 px-4 rounded-xl font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Ticket className="w-5 h-5" />
                  I have an invite code
                </button>

                {/* Future: EUDI Wallet button */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    disabled
                    className="w-full bg-gray-100 text-gray-400 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <Shield className="w-5 h-5" />
                    EUDI Wallet (Coming 2026)
                  </button>
                </div>
              </>
            )}

            {step === 'login' && (
              <form onSubmit={handleLogin}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <LogIn className="w-6 h-6 text-blue-800" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Sign In</h2>
                    <p className="text-sm text-gray-500">Enter your credentials</p>
                  </div>
                </div>

                <div className="space-y-4 mb-4">
                  <div>
                    <label htmlFor="login-username" className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      id="login-username"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="your_username"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      autoFocus
                      autoComplete="username"
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      id="login-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !loginUsername || !loginPassword}
                  className="w-full bg-blue-800 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('initial'); setError(null) }}
                  className="w-full mt-3 text-gray-500 text-sm hover:text-gray-700 flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              </form>
            )}

            {step === 'invite-check' && (
              <form onSubmit={handleCheckInvite}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Ticket className="w-6 h-6 text-green-700" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Enter Invite Code</h2>
                    <p className="text-sm text-gray-500">You need an invite to join</p>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="invite-code" className="block text-sm font-medium text-gray-700 mb-1">
                    Invite Code
                  </label>
                  <input
                    type="text"
                    id="invite-code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="EULESIA-XXXXXX"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-center text-lg tracking-wider"
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !inviteCode}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('initial'); setError(null); setInviteCode('') }}
                  className="w-full mt-3 text-gray-500 text-sm hover:text-gray-700 flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              </form>
            )}

            {step === 'register' && inviteValid && (
              <form onSubmit={handleRegister}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <UserPlus className="w-6 h-6 text-green-700" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Create Account</h2>
                    {invitedBy && (
                      <p className="text-sm text-gray-500">Invited by {invitedBy}</p>
                    )}
                  </div>
                </div>

                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-2 text-green-700 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Invite code: <span className="font-mono font-medium">{inviteCode}</span></span>
                  </div>
                </div>

                <div className="space-y-4 mb-4">
                  <div>
                    <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="reg-name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Your Name"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      autoFocus
                      autoComplete="name"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-username" className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      id="reg-username"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="your_username"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      autoComplete="username"
                      pattern="[a-z0-9_]+"
                    />
                    <p className="text-xs text-gray-500 mt-1">Letters, numbers, and underscores only</p>
                  </div>

                  <div>
                    <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      id="reg-password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-gray-500 mt-1">At least 6 characters</p>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !regUsername || !regPassword || !regName}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('invite-check'); setError(null); setInviteValid(false) }}
                  className="w-full mt-3 text-gray-500 text-sm hover:text-gray-700 flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              </form>
            )}
          </div>

          {/* Identity explanation */}
          <div className="mt-6 bg-blue-800/50 rounded-xl p-4 border border-blue-700">
            <h3 className="text-white font-medium flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4" />
              Invite-only beta
            </h3>
            <p className="text-blue-200 text-sm">
              Eulesia grows through personal invitations. Each member can invite 5 others,
              building a trust network of engaged citizens.
            </p>
          </div>
        </div>
      </main>

      {/* Feature highlights */}
      <div className="bg-white px-6 py-8">
        <div className="max-w-md mx-auto">
          <h3 className="text-gray-900 font-semibold mb-4 text-center">
            What makes Eulesia different
          </h3>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-green-700" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 text-sm">No attention economy</h4>
                <p className="text-gray-500 text-sm">
                  No algorithmic feed, no infinite scroll, no engagement metrics. Your time is yours.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-violet-700" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 text-sm">Institutions as participants</h4>
                <p className="text-gray-500 text-sm">
                  Public institutions join as civic actors, not advertisers or "verified brands."
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-teal-700" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 text-sm">Social, not surveillance</h4>
                <p className="text-gray-500 text-sm">
                  Connect with communities and neighbors. No data harvesting, no ad targeting.
                </p>
              </div>
            </div>
          </div>

          {/* EU alignment */}
          <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-center gap-2 text-sm text-gray-500">
            <span className="text-lg">🇪🇺</span>
            <span>European Digital Public Infrastructure</span>
          </div>
        </div>
      </div>
    </div>
  )
}
