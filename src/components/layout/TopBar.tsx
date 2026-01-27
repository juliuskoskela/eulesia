import { Bell, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function TopBar() {
  const { currentUser } = useAuth()

  const avatarInitials = currentUser?.name
    ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-800 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <span className="font-semibold text-gray-900 text-lg">Eulesia</span>
        </Link>

        {/* Right section */}
        <div className="flex items-center gap-3">
          {/* Notifications - low noise */}
          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
          </button>

          {/* Profile */}
          <Link
            to="/profile"
            className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center">
              {currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-white text-xs font-medium">
                  {avatarInitials}
                </span>
              )}
            </div>
            {/* Verified identity indicator */}
            <div className="hidden sm:flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
              <Shield className="w-3 h-3" />
              <span>Verified</span>
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}
