import { useState, useEffect } from 'react'
import { Shield, Bell, Eye, Database, LogOut, ChevronRight, Info, ExternalLink, Ticket, Plus, Copy, Check, Trash2, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout'
import { useAuth } from '../hooks/useAuth'
import { useUpdateProfile, useExportData } from '../hooks/useApi'
import { api, type InviteCode, type InvitedUser } from '../lib/api'

export function ProfilePage() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const updateProfileMutation = useUpdateProfile()
  const exportDataMutation = useExportData()

  const [notificationSettings, setNotificationSettings] = useState({
    replies: currentUser?.settings?.notificationReplies ?? true,
    mentions: currentUser?.settings?.notificationMentions ?? true,
    official: currentUser?.settings?.notificationOfficial ?? true
  })

  // Invite codes state
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [invitesRemaining, setInvitesRemaining] = useState(0)
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([])
  const [isLoadingInvites, setIsLoadingInvites] = useState(true)
  const [isCreatingInvite, setIsCreatingInvite] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Load invite data
  useEffect(() => {
    async function loadInvites() {
      try {
        const [invitesData, treeData] = await Promise.all([
          api.getInvites(),
          api.getInviteTree()
        ])
        setInviteCodes(invitesData.codes)
        setInvitesRemaining(invitesData.remaining)
        setInvitedUsers(treeData)
      } catch (err) {
        console.error('Failed to load invites:', err)
      } finally {
        setIsLoadingInvites(false)
      }
    }
    loadInvites()
  }, [])

  const handleCreateInvite = async () => {
    setIsCreatingInvite(true)
    try {
      const newCode = await api.createInvite()
      setInviteCodes(prev => [newCode, ...prev])
      setInvitesRemaining(prev => prev - 1)
    } catch (err) {
      console.error('Failed to create invite:', err)
    } finally {
      setIsCreatingInvite(false)
    }
  }

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleRevokeInvite = async (id: string) => {
    try {
      await api.revokeInvite(id)
      setInviteCodes(prev => prev.map(c => c.id === id ? { ...c, status: 'revoked' as const } : c))
      setInvitesRemaining(prev => prev + 1)
    } catch (err) {
      console.error('Failed to revoke invite:', err)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const handleNotificationChange = async (key: keyof typeof notificationSettings) => {
    const newValue = !notificationSettings[key]
    setNotificationSettings(prev => ({ ...prev, [key]: newValue }))

    const settingsKeyMap = {
      replies: 'notificationReplies',
      mentions: 'notificationMentions',
      official: 'notificationOfficial'
    } as const

    try {
      await updateProfileMutation.mutateAsync({
        settings: {
          ...currentUser?.settings,
          [settingsKeyMap[key]]: newValue
        }
      } as Parameters<typeof updateProfileMutation.mutateAsync>[0])
    } catch (err) {
      // Revert on error
      setNotificationSettings(prev => ({ ...prev, [key]: !newValue }))
      console.error('Failed to update notification settings:', err)
    }
  }

  const handleExportData = async () => {
    try {
      const data = await exportDataMutation.mutateAsync()
      // Download as JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'eulesia-my-data.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export data:', err)
    }
  }

  if (!currentUser) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <p className="text-gray-500">Please log in to view your profile</p>
        </div>
      </Layout>
    )
  }

  const avatarInitials = currentUser.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Layout>
      {/* Profile header */}
      <div className="bg-white px-4 py-6 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center">
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-white text-xl font-bold">{avatarInitials}</span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{currentUser.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
                <Shield className="w-3 h-3" />
                {currentUser.identityLevel === 'high' ? 'High Assurance Identity' :
                 currentUser.identityLevel === 'substantial' ? 'Substantial Identity' :
                 'Verified Identity'}
              </span>
              {currentUser.municipality && (
                <span className="text-xs text-gray-500">
                  {currentUser.municipality.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Identity section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              Identity
            </h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {currentUser.identityLevel === 'high' ? 'EUDI Wallet Connected' : 'Email Verified'}
                </p>
                <p className="text-xs text-gray-500">
                  {currentUser.identityLevel === 'high' ? 'European Digital Identity' : 'Magic Link Authentication'}
                </p>
              </div>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">Active</span>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {currentUser.identityLevel === 'high'
                  ? 'Your identity is verified through the EU Digital Identity framework. This ensures one-person-one-account in Eulesia.'
                  : 'Upgrade to EUDI Wallet when available for stronger identity verification.'}
              </p>
            </div>
          </div>
        </div>

        {/* Invite Codes */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Ticket className="w-4 h-4 text-green-600" />
              My Invites
            </h2>
          </div>
          <div className="p-4 space-y-4">
            {/* Create invite button */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {invitesRemaining} invite{invitesRemaining !== 1 ? 's' : ''} remaining
                </p>
                <p className="text-xs text-gray-500">
                  Share codes to invite others to Eulesia
                </p>
              </div>
              <button
                onClick={handleCreateInvite}
                disabled={isCreatingInvite || invitesRemaining <= 0}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingInvite ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create Code
              </button>
            </div>

            {/* List of invite codes */}
            {isLoadingInvites ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-green-600 rounded-full animate-spin" />
              </div>
            ) : inviteCodes.length > 0 ? (
              <div className="space-y-2">
                {inviteCodes.map(code => (
                  <div
                    key={code.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      code.status === 'available' ? 'bg-green-50 border-green-200' :
                      code.status === 'used' ? 'bg-gray-50 border-gray-200' :
                      'bg-red-50 border-red-200'
                    }`}
                  >
                    <div>
                      <p className={`font-mono text-sm ${code.status === 'available' ? 'text-green-700' : 'text-gray-500'}`}>
                        {code.code}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {code.status === 'available' && 'Available'}
                        {code.status === 'used' && code.usedBy && `Used by ${code.usedBy.name}`}
                        {code.status === 'revoked' && 'Revoked'}
                      </p>
                    </div>
                    {code.status === 'available' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopyCode(code.code)}
                          className="p-1.5 text-green-600 hover:bg-green-100 rounded"
                          title="Copy code"
                        >
                          {copiedCode === code.code ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleRevokeInvite(code.id)}
                          className="p-1.5 text-red-500 hover:bg-red-100 rounded"
                          title="Revoke code"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No invite codes yet. Create one to invite someone!
              </p>
            )}

            {/* People I've invited */}
            {invitedUsers.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-blue-600" />
                  People you invited ({invitedUsers.length})
                </h3>
                <div className="space-y-2">
                  {invitedUsers.map(user => (
                    <div key={user.id} className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center text-xs font-medium text-teal-700">
                        {user.name.charAt(0)}
                      </div>
                      <span className="text-gray-700">{user.name}</span>
                      <span className="text-gray-400 text-xs">@{user.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notification preferences */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              Notifications
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Replies to your posts</p>
                <p className="text-xs text-gray-500">When someone replies to your discussions</p>
              </div>
              <input
                type="checkbox"
                checked={notificationSettings.replies}
                onChange={() => handleNotificationChange('replies')}
                className="w-4 h-4 text-blue-600"
              />
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Direct mentions</p>
                <p className="text-xs text-gray-500">When someone mentions you</p>
              </div>
              <input
                type="checkbox"
                checked={notificationSettings.mentions}
                onChange={() => handleNotificationChange('mentions')}
                className="w-4 h-4 text-blue-600"
              />
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Official updates</p>
                <p className="text-xs text-gray-500">From institutions you follow</p>
              </div>
              <input
                type="checkbox"
                checked={notificationSettings.official}
                onChange={() => handleNotificationChange('official')}
                className="w-4 h-4 text-blue-600"
              />
            </div>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Info className="w-3 h-3" />
              No "growth" nudges. Only meaningful notifications.
            </p>
          </div>
        </div>

        {/* Privacy & Data */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              Privacy & Data
            </h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800 font-medium">Your data is not the product</p>
              <p className="text-xs text-green-700 mt-1">
                Eulesia does not collect behavioral data for advertising.
                We do not sell your data or use it to manipulate your attention.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">Data stored</span>
                </div>
                <Link to="/profile/data" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  View
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>• Profile information (name, municipality)</p>
                <p>• Your posts and comments</p>
                <p>• Club memberships</p>
                <p>• Notification preferences</p>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <button
                onClick={handleExportData}
                disabled={exportDataMutation.isPending}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 disabled:opacity-50"
              >
                <ExternalLink className="w-4 h-4" />
                {exportDataMutation.isPending ? 'Exporting...' : 'Export my data'}
              </button>
            </div>
          </div>
        </div>

        {/* About Eulesia */}
        <Link
          to="/about"
          className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-800 font-bold">E</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">About Eulesia</p>
                <p className="text-xs text-gray-500">Governance, foundation, open source</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 py-3"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </Layout>
  )
}
