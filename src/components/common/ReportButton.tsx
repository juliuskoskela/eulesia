import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flag } from 'lucide-react'
import { ReportDialog } from './ReportDialog'

interface ReportButtonProps {
  contentType: string
  contentId: string
  size?: 'sm' | 'md'
}

export function ReportButton({ contentType, contentId, size = 'sm' }: ReportButtonProps) {
  const { t } = useTranslation('common')
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 text-gray-400 hover:text-red-500 transition-colors ${
          size === 'sm' ? 'text-xs' : 'text-sm'
        }`}
        title={t('report.report')}
      >
        <Flag className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        <span>{t('report.report')}</span>
      </button>

      <ReportDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        contentType={contentType}
        contentId={contentId}
      />
    </>
  )
}
