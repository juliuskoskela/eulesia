import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Users, Flag, ScrollText, FileText,
  BarChart3, Settings, ArrowLeft, Scale
} from 'lucide-react'

const navItems = [
  { to: '/admin', icon: LayoutDashboard, labelKey: 'nav.dashboard', end: true },
  { to: '/admin/users', icon: Users, labelKey: 'nav.users' },
  { to: '/admin/reports', icon: Flag, labelKey: 'nav.reports' },
  { to: '/admin/modlog', icon: ScrollText, labelKey: 'nav.modlog' },
  { to: '/admin/content', icon: FileText, labelKey: 'nav.content' },
  { to: '/admin/appeals', icon: Scale, labelKey: 'nav.appeals' },
  { to: '/admin/transparency', icon: BarChart3, labelKey: 'nav.transparency' },
  { to: '/admin/settings', icon: Settings, labelKey: 'nav.settings' },
]

export function AdminSidebar() {
  const { t } = useTranslation('admin')

  return (
    <aside className="w-56 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900">Eulesia Admin</h2>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, labelKey, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="p-2 border-t border-gray-200">
        <NavLink
          to="/agora"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 flex-shrink-0" />
          {t('nav.backToApp')}
        </NavLink>
      </div>
    </aside>
  )
}
