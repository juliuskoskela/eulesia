import { type ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { AdminSidebar } from './AdminSidebar'

interface AdminLayoutProps {
  children: ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { currentUser } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{currentUser?.name}</span>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              {currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-white text-xs font-bold">
                  {currentUser?.name?.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
