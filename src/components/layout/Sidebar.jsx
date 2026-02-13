import { NavLink } from 'react-router-dom'
import { useUser, isManager } from '../../context/AppContext'
import {
  LayoutDashboard, Package, Boxes, ShoppingCart,
  Truck, PackageCheck, FileOutput, Bell, BarChart3,
  Users, Settings, LogOut, Wine, Sparkles, GlassWater, Calendar, ChefHat
} from 'lucide-react'

// Role-based nav: access = 'all' | 'manager' | roles array
// Chef only sees: Dashboard, Menu Plan, Issue, Recipes
const CHEF_ONLY = ['chef']
const navItems = [
  { path: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true, access: 'all', guide: 'nav-dashboard' },
  { path: '/app/daily', icon: Calendar, label: 'Daily View', access: 'all', exclude: CHEF_ONLY, guide: 'nav-daily' },
  { path: '/app/orders', icon: ShoppingCart, label: 'Orders', access: 'all', exclude: CHEF_ONLY, guide: 'nav-orders' },
  { path: '/app/dispatch', icon: Truck, label: 'Dispatch', access: 'manager', guide: 'nav-dispatch' },
  { path: '/app/stock', icon: Boxes, label: 'Stock', access: 'all', exclude: CHEF_ONLY, guide: 'nav-stock' },
  { path: '/app/items', icon: Package, label: 'Items', access: 'all', exclude: CHEF_ONLY, guide: 'nav-items' },
  { path: '/app/receive', icon: PackageCheck, label: 'Receive', access: 'all', exclude: CHEF_ONLY, guide: 'nav-receive' },
  { path: '/app/issue', icon: FileOutput, label: 'Issue', access: 'all', guide: 'nav-issue' },
  { path: '/app/pos', icon: Wine, label: 'POS', access: 'all', exclude: CHEF_ONLY, guide: 'nav-pos' },
  { path: '/app/bar-menu', icon: GlassWater, label: 'Bar Menu', access: 'all', exclude: CHEF_ONLY, guide: 'nav-bar-menu' },
  { path: '/app/recipes', icon: Sparkles, label: 'Recipes', access: 'all', guide: 'nav-recipes' },
  { path: '/app/menu-plan', icon: ChefHat, label: 'Menu Plan', roles: ['chef', 'camp_manager', 'admin', 'director'], guide: 'nav-menu-plan' },
  { path: '/app/alerts', icon: Bell, label: 'Alerts', access: 'all', exclude: CHEF_ONLY, guide: 'nav-alerts' },
  { path: '/app/reports', icon: BarChart3, label: 'Reports', access: 'manager', guide: 'nav-reports' },
  { path: '/app/users', icon: Users, label: 'Users', roles: ['admin', 'director', 'stores_manager'], guide: 'nav-users' },
  { path: '/app/settings', icon: Settings, label: 'Settings', access: 'manager', guide: 'nav-settings' },
]

function canAccess(item, role) {
  if (item.exclude && item.exclude.includes(role)) return false
  if (item.roles) return item.roles.includes(role)
  if (item.access === 'all') return true
  if (item.access === 'manager') return isManager(role)
  return true
}

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
          .filter(item => canAccess(item, user?.role))
          .map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              data-guide={item.guide}
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
              {user?.camp_name || 'Head Office'} · {user?.role?.replace(/_/g, ' ')}
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
