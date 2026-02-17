import { type ReactNode, useEffect, useRef } from 'react'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { Footer } from './Footer'
import { AnnouncementBanner } from './AnnouncementBanner'
import { GuideTour, GuideHelpButton } from '../guide'
import { useGuide } from '../../hooks/useGuide'

interface LayoutProps {
  children: ReactNode
  showFooter?: boolean
  fullWidth?: boolean
}

export function Layout({ children, showFooter = true, fullWidth = false }: LayoutProps) {
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
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      <AnnouncementBanner />

      <main className={fullWidth ? 'pt-14 pb-16' : 'pt-14 pb-20'}>
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
      <GuideHelpButton />
    </div>
  )
}
