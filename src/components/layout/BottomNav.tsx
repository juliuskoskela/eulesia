import { Landmark, Users, Home, MapPin, MessageSquare } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/agora', icon: Landmark, label: 'Agora' },
  { to: '/clubs', icon: Users, label: 'Clubs' },
  { to: '/messages', icon: MessageSquare, label: 'Viestit' },
  { to: '/map', icon: MapPin, label: 'Map' },
  { to: '/home', icon: Home, label: 'Home' }
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-around">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center py-3 px-4 transition-colors ${
                  isActive
                    ? 'text-blue-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`
              }
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs mt-1 font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
