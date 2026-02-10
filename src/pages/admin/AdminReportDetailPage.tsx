import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { AdminLayout } from '../../components/admin'
import { useAdminReport, useUpdateReport, useRemoveContent } from '../../hooks/useAdminApi'
import { formatRelativeTime } from '../../lib/formatTime'

export function AdminReportDetailPage() {
  const { t } = useTranslation('admin')
  const { id } = useParams<{ id: string }>()
  const { data: report, isLoading } = useAdminReport(id || '')
  const updateReportMutation = useUpdateReport()
  const removeContentMutation = useRemoveContent()

  if (isLoading || !report) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </AdminLayout>
    )
  }

  const handleUpdateStatus = (status: string) => {
    if (!id) return
    updateReportMutation.mutate({ id, data: { status } })
  }

  const handleRemoveContent = () => {
    if (!report) return
    removeContentMutation.mutate({
      type: report.contentType,
      id: report.contentId,
      reason: `Removed due to report: ${report.reason}`
    })
    handleUpdateStatus('resolved')
  }

  return (
    <AdminLayout>
      <Link to="/admin/reports" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4" />
        {t('reports.backToReports')}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Report info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{t('reportDetail.info')}</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-gray-500 uppercase">{t('reportDetail.reason')}</dt>
              <dd className="text-sm font-medium text-gray-900 capitalize">{report.reason}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 uppercase">{t('reportDetail.contentType')}</dt>
              <dd className="text-sm text-gray-900 capitalize">{report.contentType.replace('_', ' ')}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 uppercase">{t('reportDetail.status')}</dt>
              <dd className="text-sm text-gray-900 capitalize">{report.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 uppercase">{t('reportDetail.reporter')}</dt>
              <dd className="text-sm text-gray-900">
                <Link to={`/admin/users/${report.reporterUserId}`} className="text-blue-600 hover:underline">
                  {report.reporterName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 uppercase">{t('reportDetail.date')}</dt>
              <dd className="text-sm text-gray-900">{formatRelativeTime(report.createdAt)}</dd>
            </div>
            {report.description && (
              <div>
                <dt className="text-xs text-gray-500 uppercase">{t('reportDetail.description')}</dt>
                <dd className="text-sm text-gray-700 mt-1">{report.description}</dd>
              </div>
            )}
          </dl>

          {/* Actions */}
          {report.status === 'pending' || report.status === 'reviewing' ? (
            <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
              {report.status === 'pending' && (
                <button
                  onClick={() => handleUpdateStatus('reviewing')}
                  disabled={updateReportMutation.isPending}
                  className="w-full text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {t('reportDetail.startReviewing')}
                </button>
              )}
              <button
                onClick={handleRemoveContent}
                disabled={removeContentMutation.isPending}
                className="w-full text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {t('reportDetail.removeContent')}
              </button>
              <button
                onClick={() => handleUpdateStatus('dismissed')}
                disabled={updateReportMutation.isPending}
                className="w-full text-sm px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                {t('reportDetail.dismiss')}
              </button>
            </div>
          ) : null}
        </div>

        {/* Reported content preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{t('reportDetail.content')}</h2>
          {report.content ? (
            <div className="bg-gray-50 rounded-lg p-4">
              {report.content.title && (
                <h3 className="font-medium text-gray-900 mb-2">{report.content.title}</h3>
              )}
              {report.content.content && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.content.content}</p>
              )}
              {report.content.name && !report.content.title && (
                <p className="text-sm text-gray-700">{report.content.name}</p>
              )}
              {report.content.authorId && (
                <div className="mt-3 pt-2 border-t border-gray-200">
                  <Link
                    to={`/admin/users/${report.content.authorId}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {t('reportDetail.viewAuthor')}
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('reportDetail.contentNotFound')}</p>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
