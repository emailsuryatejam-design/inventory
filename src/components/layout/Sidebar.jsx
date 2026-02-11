import { NavLink } from 'react-router-dom'
import { useUser, isManager } from '../../context/AppContext'
import {
  LayoutDashboard, Package, Boxes, ShoppingCart,
  Truck, PackageCheck, FileOutput, Settings, LogOut
} from 'lucide-react'

const navItems = [
  { path: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { path: '/app/orders', icon: ShoppingCart, label: 'Orders' },
  { path: '/app/stock', icon: Boxes, label: 'Stock' },
  { path: '/app/items', icon: Package, label: 'Items' },
  { path: '/app/receive', icon: PackageCheck, label: 'Receive' },
  { path: '/app/issue', icon: FileOutput, label: 'Issue' },
  { path: '/app/settings', icon: Settings, label: 'Settings', managerOnly: true },
]

export default function Sidebar() {
  const user = useUser()

  function handleLogout() {
    localStorage.removeItem('kcl_token')
    localStorage.removeItem('kcl_stores')
    window.location.hash = '#/login'
    window.location.reload()
  }

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-sm">KC</span>
        </div>
        <div>
          <h1 className="font-bold text-gray-900 text-sm">KCL Stores</h1>
          <p className="text-xs text-gray-500">Karibu Camps</p>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems
          .filter(item => !item.managerOnly || isManager(user?.role))
          .map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))
        }
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-700 font-medium text-sm">
              {user?.name?.charAt(0) || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {user?.camp_name || 'Head Office'} · {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
