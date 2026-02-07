import { Landmark, Users, Home, MapPin, MessageSquare } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useUnreadDmCount } from '../../hooks/useApi'

const navItems = [
  { to: '/agora', icon: Landmark, label: 'Agora' },
  { to: '/clubs', icon: Users, label: 'Clubs' },
  { to: '/messages', icon: MessageSquare, label: 'Viestit', badge: 'dm' as const },
  { to: '/map', icon: MapPin, label: 'Map' },
  { to: '/home', icon: Home, label: 'Home' }
]

export function BottomNav() {
  const { data: dmUnread } = useUnreadDmCount()
  const unreadCount = dmUnread?.count ?? 0

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-around">
          {navItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center py-3 px-4 transition-colors relative ${
                  isActive
                    ? 'text-blue-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`
              }
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {badge === 'dm' && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-xs mt-1 font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
