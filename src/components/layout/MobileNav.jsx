import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useUser, useApp, isManager } from '../../context/AppContext'
import { lockScroll, unlockScroll } from '../../utils/scrollLock'
import {
  LayoutDashboard, ShoppingCart, Boxes, Wine, Calendar,
  Menu, X, Truck, PackageCheck, FileOutput, Bell, BarChart3,
  Users, Settings, LogOut, BookOpen, GlassWater, Package, ChefHat,
  ClipboardList
} from 'lucide-react'

const CHEF_ONLY = ['chef']

// ── Primary bottom tabs by role ─────────────────
const defaultTabs = [
  { path: '/app', icon: LayoutDashboard, label: 'Home', end: true },
  { path: '/app/orders', icon: ShoppingCart, label: 'Orders' },
  { path: '/app/stock', icon: Boxes, label: 'Stock' },
  { path: '/app/pos', icon: Wine, label: 'POS' },
]

const chefTabs = [
  { path: '/app/menu-plan', icon: ChefHat, label: 'Menu', end: true },
  { path: '/app/daily-groceries', icon: ClipboardList, label: 'Daily' },
  { path: '/app/weekly-groceries', icon: Calendar, label: 'Weekly' },
  { path: '/app/recipes', icon: BookOpen, label: 'Recipes' },
]

// ── All nav items grouped by department ─────────
const drawerSections = [
  {
    label: 'Stores',
    module: 'stores',
    color: '#3b82f6',
    items: [
      { path: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true, access: 'all', exclude: CHEF_ONLY },
      { path: '/app/stock', icon: Boxes, label: 'Stock', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/items', icon: Package, label: 'Items', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/issue', icon: FileOutput, label: 'Issue', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/receive', icon: PackageCheck, label: 'Receive', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/orders', icon: ShoppingCart, label: 'Orders', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/dispatch', icon: Truck, label: 'Dispatch', access: 'manager' },
      { path: '/app/daily', icon: Calendar, label: 'Daily View', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/alerts', icon: Bell, label: 'Alerts', access: 'all', exclude: CHEF_ONLY },
    ],
  },
  {
    label: 'Kitchen',
    module: 'kitchen',
    color: '#10b981',
    items: [
      { path: '/app/menu-plan', icon: ChefHat, label: 'Menu Plan', roles: ['chef', 'camp_manager', 'admin', 'director'] },
      { path: '/app/daily-groceries', icon: ClipboardList, label: 'Daily Groc.', roles: ['chef', 'camp_manager', 'admin', 'director'] },
      { path: '/app/weekly-groceries', icon: Calendar, label: 'Weekly Groc.', roles: ['chef', 'camp_manager', 'admin', 'director'] },
      { path: '/app/recipes', icon: BookOpen, label: 'Recipes', access: 'all' },
    ],
  },
  {
    label: 'Bar & POS',
    module: 'bar',
    color: '#3b82f6',
    items: [
      { path: '/app/pos', icon: Wine, label: 'POS', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/bar-menu', icon: GlassWater, label: 'Bar Menu', access: 'all', exclude: CHEF_ONLY },
    ],
  },
  {
    label: 'Admin',
    module: 'admin',
    color: '#64748b',
    items: [
      { path: '/app/reports', icon: BarChart3, label: 'Reports', access: 'manager' },
      { path: '/app/users', icon: Users, label: 'Users', roles: ['admin', 'director', 'stores_manager'] },
      { path: '/app/settings', icon: Settings, label: 'Settings', access: 'manager' },
    ],
  },
]

function canAccess(item, role) {
  if (item.exclude && item.exclude.includes(role)) return false
  if (item.roles) return item.roles.includes(role)
  if (item.access === 'all') return true
  if (item.access === 'manager') return isManager(role)
  return true
}

function isModuleEnabled(moduleId, modules) {
  if (!modules || modules.length === 0) return true
  return modules.includes(moduleId)
}

export default function MobileNav() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const user = useUser()
  const { state } = useApp()
  const location = useLocation()
  const closingTimerRef = useRef(null)

  const primaryTabs = user?.role === 'chef' ? chefTabs : defaultTabs

  const primaryPaths = primaryTabs.map(t => t.path)
  const isOnMorePage = !primaryPaths.some(p => {
    if (p === '/app') return location.pathname === '/app' || location.pathname === '/app/'
    return location.pathname.startsWith(p)
  })

  useEffect(() => {
    if (drawerOpen) {
      lockScroll()
      return () => unlockScroll()
    }
  }, [drawerOpen])

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
    }, 200)
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

  // Filter sections — remove disabled modules and inaccessible items
  const visibleSections = drawerSections
    .filter(section => isModuleEnabled(section.module, state.modules))
    .map(section => ({
      ...section,
      items: section.items.filter(item => canAccess(item, user?.role)),
    }))
    .filter(section => section.items.length > 0)

  return (
    <>
      {/* ── Bottom Tab Bar ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-white"
        style={{
          borderTop: '1px solid var(--border-default)',
          zIndex: 'var(--z-mobilenav)',
        }}
      >
        <div className="flex justify-around items-center h-16 px-1 safe-area-pb">
          {primaryTabs.map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.end}
              onClick={closeDrawer}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg min-w-[52px] transition-colors ${
                  isActive && !drawerOpen
                    ? 'text-emerald-600'
                    : 'text-gray-400'
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
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg min-w-[52px] transition-colors ${
              drawerOpen || isOnMorePage ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <Menu size={22} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* ── Bottom Sheet Drawer ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className={`lg:hidden fixed inset-0 ${closing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
            style={{ backgroundColor: 'var(--surface-overlay)', zIndex: 'var(--z-drawer)' }}
            onClick={closeDrawer}
          />

          {/* Sheet */}
          <div
            className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl overflow-hidden ${
              closing ? 'animate-slide-down' : 'animate-slide-up'
            }`}
            style={{
              maxHeight: '85vh',
              boxShadow: 'var(--shadow-xl)',
              zIndex: 'calc(var(--z-drawer) + 1)',
            }}
          >
            {/* Handle + Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ backgroundColor: 'var(--kcl-primary-light)', color: 'var(--kcl-primary-dark)' }}
                >
                  {user?.name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                  <p className="text-[11px] text-gray-500">
                    {user?.camp_name || 'Head Office'} &middot; {user?.role?.replace(/_/g, ' ')}
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

            {/* Department-grouped items */}
            <div className="overflow-y-auto scroll-touch" style={{ maxHeight: '65vh' }}>
              {visibleSections.map((section, sIdx) => (
                <div key={sIdx} className="px-4 py-3" style={{ borderBottom: sIdx < visibleSections.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                  {/* Section label with colored dot */}
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: section.color }}
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {section.label}
                    </span>
                  </div>

                  {/* Items grid */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {section.items.map(item => {
                      const isActive = item.end
                        ? location.pathname === item.path
                        : location.pathname.startsWith(item.path) && item.path !== '/app'
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={closeDrawer}
                          className={`flex flex-col items-center gap-1 px-1.5 py-2.5 rounded-xl transition-colors ${
                            isActive
                              ? 'text-emerald-700'
                              : 'text-gray-500'
                          }`}
                          style={{
                            backgroundColor: isActive ? 'var(--kcl-primary-light)' : 'transparent',
                          }}
                        >
                          <item.icon size={20} />
                          <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Sign out */}
            <div className="px-4 py-3 pb-6" style={{ borderTop: '1px solid var(--border-light)' }}>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-xl transition"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
