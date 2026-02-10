import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { AdminLayout } from '../../components/admin'
import { useAdminReports } from '../../hooks/useAdminApi'
import { formatRelativeTime } from '../../lib/formatTime'

export function AdminReportsPage() {
  const { t } = useTranslation('admin')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')

  const { data, isLoading } = useAdminReports({
    page,
    limit: 20,
    status: statusFilter || undefined,
    reason: reasonFilter || undefined
  })

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('reports.title')}</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">{t('reports.allStatuses')}</option>
          <option value="pending">{t('reports.pending')}</option>
          <option value="reviewing">{t('reports.reviewing')}</option>
          <option value="resolved">{t('reports.resolved')}</option>
          <option value="dismissed">{t('reports.dismissed')}</option>
        </select>
        <select
          value={reasonFilter}
          onChange={(e) => { setReasonFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">{t('reports.allReasons')}</option>
          <option value="illegal">{t('reports.illegal')}</option>
          <option value="harassment">{t('reports.harassment')}</option>
          <option value="spam">{t('reports.spam')}</option>
          <option value="misinformation">{t('reports.misinformation')}</option>
          <option value="other">{t('reports.other')}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data?.items?.map(report => (
              <Link
                key={report.id}
                to={`/admin/reports/${report.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 capitalize">{report.reason}</span>
                    <span className="text-xs text-gray-500">·</span>
                    <span className="text-xs text-gray-500 capitalize">{report.contentType.replace('_', ' ')}</span>
                  </div>
                  <StatusBadge status={report.status} />
                </div>
                {report.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">{report.description}</p>
                )}
                <div className="text-xs text-gray-500">
                  {t('reports.reportedBy', { name: report.reporterName })} · {formatRelativeTime(report.createdAt)}
                </div>
              </Link>
            ))}
            {!data?.items?.length && (
              <div className="text-center py-12 text-gray-500">{t('reports.noReports')}</div>
            )}
          </div>

          {data && data.total > 20 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500">
                {t('reports.showing', { from: (page - 1) * 20 + 1, to: Math.min(page * 20, data.total), total: data.total })}
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    reviewing: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    dismissed: 'bg-gray-100 text-gray-800'
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  )
}
