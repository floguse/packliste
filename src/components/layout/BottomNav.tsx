import { NavLink, useLocation } from 'react-router-dom'
import { Home, Archive, Settings } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'Start' },
  { to: '/archive', icon: Archive, label: 'Archiv' },
  { to: '/settings', icon: Settings, label: 'Einstellungen' },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-md mx-auto flex">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className="flex-1 flex flex-col items-center justify-center pt-2 pb-1 gap-0.5 min-touch"
            >
              <Icon
                size={22}
                className={active ? 'text-blue-600' : 'text-gray-400'}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className={`text-xs font-medium ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
