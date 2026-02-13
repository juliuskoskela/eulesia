import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminLayout } from '../../components/admin'
import { useAdminSettings, useUpdateAdminSettings } from '../../hooks/useAdminApi'
import { TicketCheck, Users, ShieldCheck, Loader2, Save, Info } from 'lucide-react'

function ToggleSwitch({
  enabled,
  onChange,
  disabled
}: {
  enabled: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        enabled ? 'bg-blue-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export function AdminSettingsPage() {
  const { t } = useTranslation('admin')
  const { data: settings, isLoading } = useAdminSettings()
  const updateSettings = useUpdateAdminSettings()

  const [invitesEnabled, setInvitesEnabled] = useState(true)
  const [defaultInviteCount, setDefaultInviteCount] = useState(5)
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [hasChanges, setHasChanges] = useState(false)

  // Sync from server
  useEffect(() => {
    if (settings) {
      setInvitesEnabled(settings.invitesEnabled)
      setDefaultInviteCount(settings.defaultInviteCount)
      setRegistrationOpen(settings.registrationOpen)
      setHasChanges(false)
    }
  }, [settings])

  const handleSave = () => {
    updateSettings.mutate({
      invitesEnabled,
      defaultInviteCount,
      registrationOpen
    }, {
      onSuccess: () => setHasChanges(false)
    })
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {updateSettings.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t('settings.save')}
          </button>
        )}
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Invite system */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <TicketCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{t('settings.inviteSystem')}</h2>
              <p className="text-xs text-gray-500">{t('settings.inviteSystemDesc')}</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Invite toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('settings.invitesEnabled')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('settings.invitesEnabledDesc')}</p>
              </div>
              <ToggleSwitch
                enabled={invitesEnabled}
                onChange={(val) => {
                  setInvitesEnabled(val)
                  setHasChanges(true)
                }}
              />
            </div>

            {/* Default invite count */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('settings.defaultInviteCount')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('settings.defaultInviteCountDesc')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (defaultInviteCount > 0) {
                      setDefaultInviteCount(defaultInviteCount - 1)
                      setHasChanges(true)
                    }
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  −
                </button>
                <span className="w-10 text-center font-semibold text-gray-900">{defaultInviteCount}</span>
                <button
                  onClick={() => {
                    if (defaultInviteCount < 50) {
                      setDefaultInviteCount(defaultInviteCount + 1)
                      setHasChanges(true)
                    }
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Registration */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{t('settings.registration')}</h2>
              <p className="text-xs text-gray-500">{t('settings.registrationDesc')}</p>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('settings.registrationOpen')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('settings.registrationOpenDesc')}</p>
              </div>
              <ToggleSwitch
                enabled={registrationOpen}
                onChange={(val) => {
                  setRegistrationOpen(val)
                  setHasChanges(true)
                }}
              />
            </div>
          </div>
        </div>

        {/* DSA compliance info */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{t('settings.platformSettings')}</h2>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg flex items-start gap-3">
              <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-gray-700">{t('settings.dsaCompliance')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('settings.dsaDescription')}</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg flex items-start gap-3">
              <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-gray-700">{t('settings.moderationPolicy')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('settings.moderationDescription')}</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg flex items-start gap-3">
              <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-gray-700">{t('settings.autoModeration')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('settings.autoModerationDescription')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
