import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useThreadEditHistory } from '../../hooks/useApi'
import { formatRelativeTime } from '../../lib/formatTime'

interface EditHistoryModalProps {
  threadId: string
  open: boolean
  onClose: () => void
}

export function EditHistoryModal({ threadId, open, onClose }: EditHistoryModalProps) {
  const { t } = useTranslation('agora')
  const { data: history, isLoading } = useThreadEditHistory(threadId)

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-gray-900">{t('thread.editHistoryTitle')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label={t('common:actions.close')}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !history || history.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">{t('thread.editHistoryEmpty')}</p>
          ) : (
            <div className="space-y-4">
              {history.map((entry) => (
                <div key={entry.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <span className="font-medium text-gray-700">{entry.editor.name}</span>
                    <span>•</span>
                    <span>{formatRelativeTime(entry.editedAt)}</span>
                  </div>
                  {entry.previousTitle && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-gray-500">{t('thread.previousTitle')}:</span>
                      <p className="text-sm text-gray-700">{entry.previousTitle}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-medium text-gray-500">{t('thread.previousContent')}:</span>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap line-clamp-6">
                      {entry.previousContent}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
