import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { Footer } from './Footer'

interface LayoutProps {
  children: ReactNode
  showFooter?: boolean
  fullWidth?: boolean
}

export function Layout({ children, showFooter = true, fullWidth = false }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />

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
    </div>
  )
}
