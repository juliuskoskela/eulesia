import { useTranslation } from 'react-i18next'
import { AdminLayout } from '../../components/admin'

export function AdminSettingsPage() {
  const { t } = useTranslation('admin')

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('settings.title')}</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl">
        <h2 className="font-semibold text-gray-900 mb-4">{t('settings.platformSettings')}</h2>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700">{t('settings.dsaCompliance')}</h3>
            <p className="text-xs text-gray-500 mt-1">{t('settings.dsaDescription')}</p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700">{t('settings.moderationPolicy')}</h3>
            <p className="text-xs text-gray-500 mt-1">{t('settings.moderationDescription')}</p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700">{t('settings.autoModeration')}</h3>
            <p className="text-xs text-gray-500 mt-1">{t('settings.autoModerationDescription')}</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
