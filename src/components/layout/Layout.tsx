import { type ReactNode, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { Footer } from './Footer'
import { AnnouncementBanner } from './AnnouncementBanner'
import { GuideTour } from '../guide'
import { useGuide } from '../../hooks/useGuide'

interface LayoutProps {
  children: ReactNode
  showFooter?: boolean
  fullWidth?: boolean
}

export function Layout({ children, showFooter = true, fullWidth = false }: LayoutProps) {
  const { t } = useTranslation()
  const { hasCompletedGuide, startGuide, isGuideActive } = useGuide()
  const globalGuideTriggered = useRef(false)

  // Auto-trigger global guide on first ever page load
  useEffect(() => {
    if (globalGuideTriggered.current) return
    globalGuideTriggered.current = true

    const timer = setTimeout(() => {
      if (!hasCompletedGuide('global') && !isGuideActive) {
        startGuide('global')
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-blue-800 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
      >
        {t('common:a11y.skipToContent')}
      </a>
      <TopBar />
      <AnnouncementBanner />

      <main id="main-content" className={fullWidth ? 'pb-16' : 'pb-20'} style={{ paddingTop: 'var(--topbar-total)' }}>
        {fullWidth ? (
          children
        ) : (
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        )}
      </main>

      {showFooter && !fullWidth && <Footer />}

      <BottomNav />
      <GuideTour />
    </div>
  )
}
