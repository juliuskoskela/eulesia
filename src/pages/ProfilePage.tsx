import { useState, useEffect, useRef } from 'react'
import { Shield, Bell, Eye, Database, LogOut, ChevronRight, Info, ExternalLink, Ticket, Plus, Copy, Check, Trash2, Users, Camera, Loader2, Globe, HelpCircle, AlertTriangle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layout } from '../components/layout'
import { LanguageSwitcher } from '../components/common/LanguageSwitcher'
import { AppealButton } from '../components/common/AppealButton'
import { useAuth } from '../hooks/useAuth'
import { useMySanctions } from '../hooks/useAdminApi'
import { useGuide } from '../hooks/useGuide'
import { useUpdateProfile, useExportData } from '../hooks/useApi'
import { guides } from '../data/guides'
import { api, type InviteCode, type InvitedUser } from '../lib/api'

export function ProfilePage() {
  const { t } = useTranslation(['profile', 'common', 'auth'])
  const { currentUser, logout, refreshUser, sanction } = useAuth()
  const { data: mySanctions } = useMySanctions()
  const navigate = useNavigate()
  const updateProfileMutation = useUpdateProfile()
  const exportDataMutation = useExportData()
  const { startGuide, hasCompletedGuide, resetAllGuides } = useGuide()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [notificationSettings, setNotificationSettings] = useState({
    replies: currentUser?.settings?.notificationReplies ?? true,
    mentions: currentUser?.settings?.notificationMentions ?? true,
    official: currentUser?.settings?.notificationOfficial ?? true
  })

  // Avatar upload state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

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

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setAvatarError(t('avatar.allowedFormats'))
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(t('avatar.maxSize'))
      return
    }

    setIsUploadingAvatar(true)
    setAvatarError(null)

    try {
      await api.uploadAvatar(file)
      // Refresh user to get new avatar URL
      await refreshUser()
    } catch (err) {
      setAvatarError(t('avatar.uploadFailed'))
      console.error('Avatar upload failed:', err)
    } finally {
      setIsUploadingAvatar(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true)
    setAvatarError(null)

    try {
      await api.deleteAvatar()
      await refreshUser()
    } catch (err) {
      setAvatarError(t('avatar.removeFailed'))
      console.error('Avatar delete failed:', err)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  if (!currentUser) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <p className="text-gray-500">{t('auth:pleaseLogin')}</p>
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
      {/* Active sanctions */}
      {mySanctions && mySanctions.length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-4">
          <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
            <AlertTriangle className="w-4 h-4" />
            {t('profile:sanctions.active')}
          </div>
          {mySanctions.filter(s => !s.revokedAt).map(s => (
            <div key={s.id} className="bg-white rounded-lg p-3 border border-red-200 mb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-red-800 capitalize">{s.sanctionType}</span>
                {s.expiresAt && (
                  <span className="text-xs text-red-600">
                    {t('profile:sanctions.expiresAt', { date: new Date(s.expiresAt).toLocaleDateString() })}
                  </span>
                )}
              </div>
              {s.reason && <p className="text-xs text-red-700 mt-1">{s.reason}</p>}
              <div className="mt-2">
                <AppealButton sanctionId={s.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile header */}
      <div className="bg-white px-4 py-6 border-b border-gray-200">
        <div className="flex items-center gap-4">
          {/* Avatar with upload */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              onClick={handleAvatarClick}
              disabled={isUploadingAvatar}
              className="w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center relative group overflow-hidden disabled:cursor-not-allowed"
            >
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-white text-xl font-bold">{avatarInitials}</span>
              )}
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                {isUploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
            </button>
            {/* Remove avatar button */}
            {currentUser.avatarUrl && !isUploadingAvatar && (
              <button
                onClick={handleRemoveAvatar}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-sm"
                title={t('avatar.removeTitle')}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{currentUser.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
                <Shield className="w-3 h-3" />
                {currentUser.identityLevel === 'high' ? t('identity.highAssurance') :
                 currentUser.identityLevel === 'substantial' ? t('identity.substantial') :
                 t('identity.verified')}
              </span>
              {currentUser.municipality && (
                <span className="text-xs text-gray-500">
                  {currentUser.municipality.name}
                </span>
              )}
            </div>
            {avatarError && (
              <p className="text-xs text-red-600 mt-1">{avatarError}</p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Identity section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              {t('identity.title')}
            </h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {currentUser.identityLevel === 'high' ? t('identity.eudiConnected') : t('identity.emailVerified')}
                </p>
                <p className="text-xs text-gray-500">
                  {currentUser.identityLevel === 'high' ? t('identity.eudiDescription') : t('identity.magicLink')}
                </p>
              </div>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">{t('identity.active')}</span>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {currentUser.identityLevel === 'high'
                  ? t('identity.eudiInfo')
                  : t('identity.upgradeInfo')}
              </p>
            </div>
          </div>
        </div>

        {/* Invite Codes */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Ticket className="w-4 h-4 text-green-600" />
              {t('invites.title')}
            </h2>
          </div>
          <div className="p-4 space-y-4">
            {/* Create invite button */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {t('invites.remaining', { count: invitesRemaining })}
                </p>
                <p className="text-xs text-gray-500">
                  {t('invites.shareInfo')}
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
                {t('invites.createCode')}
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
                        {code.status === 'available' && t('invites.available')}
                        {code.status === 'used' && code.usedBy && t('invites.usedBy', { name: code.usedBy.name })}
                        {code.status === 'revoked' && t('invites.revoked')}
                      </p>
                    </div>
                    {code.status === 'available' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopyCode(code.code)}
                          className="p-1.5 text-green-600 hover:bg-green-100 rounded"
                          title={t('common:actions.copyCode')}
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
                          title={t('common:actions.revokeCode')}
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
                {t('invites.noCodesYet')}
              </p>
            )}

            {/* People I've invited */}
            {invitedUsers.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-blue-600" />
                  {t('invites.peopleInvited', { count: invitedUsers.length })}
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
              {t('notifications.title')}
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('notifications.replies')}</p>
                <p className="text-xs text-gray-500">{t('notifications.repliesDesc')}</p>
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
                <p className="text-sm font-medium text-gray-900">{t('notifications.mentions')}</p>
                <p className="text-xs text-gray-500">{t('notifications.mentionsDesc')}</p>
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
                <p className="text-sm font-medium text-gray-900">{t('notifications.official')}</p>
                <p className="text-xs text-gray-500">{t('notifications.officialDesc')}</p>
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
              {t('notifications.noGrowthNudges')}
            </p>
          </div>
        </div>

        {/* Privacy & Data */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              {t('privacy.title')}
            </h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800 font-medium">{t('privacy.notProduct')}</p>
              <p className="text-xs text-green-700 mt-1">
                {t('privacy.notProductDesc')}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{t('privacy.dataStored')}</span>
                </div>
                <Link to="/profile/data" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  {t('common:actions.view')}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>• {t('privacy.dataList.profile')}</p>
                <p>• {t('privacy.dataList.posts')}</p>
                <p>• {t('privacy.dataList.clubs')}</p>
                <p>• {t('privacy.dataList.notifications')}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <button
                onClick={handleExportData}
                disabled={exportDataMutation.isPending}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 disabled:opacity-50"
              >
                <ExternalLink className="w-4 h-4" />
                {exportDataMutation.isPending ? t('privacy.exporting') : t('privacy.exportData')}
              </button>
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              {t('language.title')}
            </h2>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-3">{t('language.description')}</p>
            <LanguageSwitcher />
          </div>
        </div>

        {/* Guides */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              {t('guide:guidesSection')}
            </h2>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-600">{t('guide:guidesDescription')}</p>
            <div className="space-y-2">
              {Object.values(guides).map(guide => {
                const completed = hasCompletedGuide(guide.id)
                return (
                  <div
                    key={guide.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm text-gray-700">
                      {t(guide.titleKey.replace('guide:', ''), { ns: 'guide' })}
                    </span>
                    <div className="flex items-center gap-2">
                      {completed && (
                        <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                          {t('guide:completed')}
                        </span>
                      )}
                      <button
                        onClick={() => startGuide(guide.id)}
                        className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        {t('guide:viewGuide')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              onClick={resetAllGuides}
              className="text-xs text-gray-500 hover:text-gray-700 mt-2"
            >
              {t('guide:resetAll')}
            </button>
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
                <p className="font-medium text-gray-900">{t('aboutEulesia')}</p>
                <p className="text-xs text-gray-500">{t('aboutDesc')}</p>
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
          <span>{t('signOut')}</span>
        </button>
      </div>
    </Layout>
  )
}
