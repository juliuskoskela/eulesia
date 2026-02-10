import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { AdminLayout } from '../../components/admin'
import { useModLog } from '../../hooks/useAdminApi'
import { formatRelativeTime } from '../../lib/formatTime'

export function AdminModLogPage() {
  const { t } = useTranslation('admin')
  const [page, setPage] = useState(1)
  const [actionTypeFilter, setActionTypeFilter] = useState('')

  const { data, isLoading } = useModLog({
    page,
    limit: 30,
    actionType: actionTypeFilter || undefined
  })

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('modlog.title')}</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={actionTypeFilter}
          onChange={(e) => { setActionTypeFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">{t('modlog.allActions')}</option>
          <option value="content_removed">{t('modlog.contentRemoved')}</option>
          <option value="content_restored">{t('modlog.contentRestored')}</option>
          <option value="user_warned">{t('modlog.userWarned')}</option>
          <option value="user_suspended">{t('modlog.userSuspended')}</option>
          <option value="user_banned">{t('modlog.userBanned')}</option>
          <option value="user_unbanned">{t('modlog.userUnbanned')}</option>
          <option value="report_dismissed">{t('modlog.reportDismissed')}</option>
          <option value="report_resolved">{t('modlog.reportResolved')}</option>
          <option value="role_changed">{t('modlog.roleChanged')}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('modlog.action')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('modlog.target')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('modlog.admin')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('modlog.reason')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('modlog.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.items?.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <ActionBadge type={entry.actionType} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                      {entry.targetType.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{entry.adminName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{entry.reason}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatRelativeTime(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.items?.length && (
              <div className="text-center py-12 text-gray-500">{t('modlog.noEntries')}</div>
            )}
          </div>

          {data && data.total > 30 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500">
                {t('modlog.showing', { from: (page - 1) * 30 + 1, to: Math.min(page * 30, data.total), total: data.total })}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(p => p + 1)} disabled={!data.hasMore} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  )
}

function ActionBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    content_removed: 'bg-red-100 text-red-800',
    content_restored: 'bg-green-100 text-green-800',
    user_warned: 'bg-yellow-100 text-yellow-800',
    user_suspended: 'bg-orange-100 text-orange-800',
    user_banned: 'bg-red-100 text-red-800',
    user_unbanned: 'bg-green-100 text-green-800',
    report_dismissed: 'bg-gray-100 text-gray-800',
    report_resolved: 'bg-blue-100 text-blue-800',
    role_changed: 'bg-purple-100 text-purple-800'
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
      {type.replace(/_/g, ' ')}
    </span>
  )
}
