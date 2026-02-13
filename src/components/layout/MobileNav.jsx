import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useUser, isManager } from '../../context/AppContext'
import { lockScroll, unlockScroll } from '../../utils/scrollLock'
import {
  LayoutDashboard, ShoppingCart, Boxes, Wine, Calendar,
  Menu, X, Truck, PackageCheck, FileOutput, Bell, BarChart3,
  Users, Settings, LogOut, BookOpen, GlassWater, Package, ChefHat,
  ClipboardList
} from 'lucide-react'

// Chef excluded from most store tabs
const CHEF_ONLY = ['chef']

// Primary tabs always visible in bottom bar
// Chef gets a different set of primary tabs
const defaultTabs = [
  { path: '/app', icon: LayoutDashboard, label: 'Home', end: true },
  { path: '/app/orders', icon: ShoppingCart, label: 'Orders' },
  { path: '/app/pos', icon: Wine, label: 'POS' },
  { path: '/app/stock', icon: Boxes, label: 'Stock' },
]

const chefTabs = [
  { path: '/app/menu-plan', icon: ChefHat, label: 'Menu', end: true },
  { path: '/app/daily-groceries', icon: ClipboardList, label: 'Daily' },
  { path: '/app/weekly-groceries', icon: Calendar, label: 'Weekly' },
  { path: '/app/recipes', icon: BookOpen, label: 'Recipes' },
]

// All navigation items for the "More" drawer (role-based, same as Sidebar)
const allNavItems = [
  { path: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true, access: 'all', exclude: CHEF_ONLY },
  { path: '/app/daily', icon: Calendar, label: 'Daily View', access: 'all', exclude: CHEF_ONLY },
  { path: '/app/orders', icon: ShoppingCart, label: 'Orders', access: 'all', exclude: CHEF_ONLY },
  { path: '/app/dispatch', icon: Truck, label: 'Dispatch', access: 'manager' },
  { path: '/app/stock', icon: Boxes, label: 'Stock', access: 'all', exclude: CHEF_ONLY },
  { path: '/app/items', icon: Package, label: 'Items', access: 'all', exclude: CHEF_ONLY },
  { path: '/app/receive', icon: PackageCheck, label: 'Receive', access: 'all', exclude: CHEF_ONLY },
  { path: '/app/issue', icon: FileOutput, label: 'Issue', access: 'all', exclude: CHEF_ONLY },
  { path: '/app/pos', icon: Wine, label: 'POS', access: 'all', exclude: CHEF_ONLY },
  { path: '/app/bar-menu', icon: GlassWater, label: 'Bar Menu', access: 'all', exclude: CHEF_ONLY },
  { path: '/app/recipes', icon: BookOpen, label: 'Recipes', access: 'all' },
  { path: '/app/menu-plan', icon: ChefHat, label: 'Menu Plan', roles: ['chef', 'camp_manager', 'admin', 'director'] },
  { path: '/app/daily-groceries', icon: ClipboardList, label: 'Daily Groceries', roles: ['chef', 'camp_manager', 'admin', 'director'] },
  { path: '/app/weekly-groceries', icon: Calendar, label: 'Weekly Groceries', roles: ['chef', 'camp_manager', 'admin', 'director'] },
  { path: '/app/alerts', icon: Bell, label: 'Alerts', access: 'all', exclude: CHEF_ONLY },
  { path: '/app/reports', icon: BarChart3, label: 'Reports', access: 'manager' },
  { path: '/app/users', icon: Users, label: 'Users', roles: ['admin', 'director', 'stores_manager'] },
  { path: '/app/settings', icon: Settings, label: 'Settings', access: 'manager' },
]

function canAccess(item, role) {
  if (item.exclude && item.exclude.includes(role)) return false
  if (item.roles) return item.roles.includes(role)
  if (item.access === 'all') return true
  if (item.access === 'manager') return isManager(role)
  return true
}

export default function MobileNav() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const user = useUser()
  const location = useLocation()
  const closingTimerRef = useRef(null)

  // Chef gets a dedicated bottom bar
  const primaryTabs = user?.role === 'chef' ? chefTabs : defaultTabs

  // Check if current path matches any "more" item (not in primary tabs)
  const primaryPaths = primaryTabs.map(t => t.path)
  const isOnMorePage = !primaryPaths.some(p => {
    if (p === '/app') return location.pathname === '/app' || location.pathname === '/app/'
    return location.pathname.startsWith(p)
  })

  // Scroll lock when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      lockScroll()
      return () => unlockScroll()
    }
  }, [drawerOpen])

  // Cleanup closing timer on unmount
  useEffect(() => {
    return () => {
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current)
    }
  }, [])

  function openDrawer() {
    if (closing) return
    setDrawerOpen(true)
    setClosing(false)
  }

  function closeDrawer() {
    if (!drawerOpen || closing) return
    setClosing(true)
    closingTimerRef.current = setTimeout(() => {
      setDrawerOpen(false)
      setClosing(false)
    }, 200) // matches animation duration
  }

  function toggleDrawer() {
    if (drawerOpen) closeDrawer()
    else openDrawer()
  }

  function handleLogout() {
    localStorage.removeItem('kcl_token')
    localStorage.removeItem('kcl_stores')
    window.location.hash = '#/login'
    window.location.reload()
  }

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around items-center h-16 px-1">
          {primaryTabs.map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.end}
              onClick={closeDrawer}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg min-w-[52px] transition ${
                  isActive && !drawerOpen
                    ? 'text-green-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              <tab.icon size={22} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={toggleDrawer}
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg min-w-[52px] transition ${
              drawerOpen || isOnMorePage ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Menu size={22} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Slide-up Drawer */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className={`lg:hidden fixed inset-0 bg-black/40 z-[60] ${closing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
            onClick={closeDrawer}
          />

          {/* Drawer */}
          <div
            className={`lg:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl shadow-xl max-h-[80vh] overflow-hidden ${
              closing ? 'animate-slide-down' : 'animate-slide-up'
            }`}
          >
            {/* Handle bar + close */}
            <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-700 font-medium text-xs">
                    {user?.name?.charAt(0) || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-[11px] text-gray-500">
                    {user?.camp_name || 'Head Office'} · {user?.role?.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg compact-btn"
                style={{ minHeight: 'auto' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Nav items grid */}
            <div className="overflow-y-auto max-h-[60vh] px-4 py-3 scroll-touch">
              <div className="grid grid-cols-4 gap-2">
                {allNavItems
                  .filter(item => canAccess(item, user?.role))
                  .map(item => {
                    const isActive = item.end
                      ? location.pathname === item.path
                      : location.pathname.startsWith(item.path) && item.path !== '/app'
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={closeDrawer}
                        className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition ${
                          isActive
                            ? 'bg-green-50 text-green-700'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <item.icon size={22} />
                        <span className="text-[11px] font-medium text-center leading-tight">{item.label}</span>
                      </NavLink>
                    )
                  })}
              </div>
            </div>

            {/* Sign out */}
            <div className="border-t border-gray-100 px-4 py-3 pb-6">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
