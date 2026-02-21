import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useUser, useApp, isManager } from '../../context/AppContext'
import {
  LayoutDashboard, Package, Boxes, ShoppingCart,
  Truck, PackageCheck, FileOutput, Bell, BarChart3,
  Users, Settings, LogOut, Wine, BookOpen, GlassWater, Calendar, ChefHat,
  ClipboardList, ChevronLeft, ChevronRight, Fuel, Wrench, Building2,
  ClipboardCheck, Warehouse, FileText
} from 'lucide-react'

// ── Department color map ──────────────────────────
const DEPT_COLORS = {
  stores: { accent: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  kitchen: { accent: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  housekeeping: { accent: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  fuel: { accent: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  admin: { accent: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
  ho: { accent: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
}

// ── Navigation sections (department-grouped) ──────
const CHEF_ONLY = ['chef']

const navSections = [
  {
    id: 'stores',
    module: 'stores',
    label: 'Stores',
    items: [
      { path: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true, access: 'all', exclude: CHEF_ONLY },
      { path: '/app/stock', icon: Boxes, label: 'Stock Levels', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/items', icon: Package, label: 'Items Catalog', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/issue', icon: FileOutput, label: 'Issue Goods', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/receive', icon: PackageCheck, label: 'Receive Goods', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/orders', icon: ShoppingCart, label: 'Orders', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/dispatch', icon: Truck, label: 'Dispatch', access: 'manager' },
      { path: '/app/daily', icon: Calendar, label: 'Daily Overview', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/alerts', icon: Bell, label: 'Alerts', access: 'all', exclude: CHEF_ONLY },
    ],
  },
  {
    id: 'kitchen',
    module: 'kitchen',
    label: 'Kitchen',
    items: [
      { path: '/app/menu-plan', icon: ChefHat, label: 'Menu Plan', roles: ['chef', 'camp_manager', 'admin', 'director'] },
      { path: '/app/daily-groceries', icon: ClipboardList, label: 'Daily Groceries', roles: ['chef', 'camp_manager', 'admin', 'director'] },
      { path: '/app/weekly-groceries', icon: Calendar, label: 'Weekly Groceries', roles: ['chef', 'camp_manager', 'admin', 'director'] },
      { path: '/app/recipes', icon: BookOpen, label: 'Recipes', access: 'all' },
    ],
  },
  {
    id: 'stores', // reusing color
    module: 'bar',
    label: 'Bar & POS',
    items: [
      { path: '/app/pos', icon: Wine, label: 'Point of Sale', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/bar-menu', icon: GlassWater, label: 'Bar Menu', access: 'all', exclude: CHEF_ONLY },
    ],
  },
  {
    id: 'admin',
    module: 'admin',
    label: 'Admin',
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
  // If modules list not loaded (legacy session), show everything
  if (!modules || modules.length === 0) return true
  return modules.includes(moduleId)
}

export default function Sidebar() {
  const user = useUser()
  const { state } = useApp()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('ws_sidebar_collapsed')
    return saved === 'true'
  })

  useEffect(() => {
    localStorage.setItem('ws_sidebar_collapsed', collapsed)
    // Dispatch event so AppLayout can adjust margins
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed } }))
  }, [collapsed])

  function handleLogout() {
    localStorage.removeItem('ws_token')
    localStorage.removeItem('ws_state')
    window.location.hash = '#/login'
    window.location.reload()
  }

  // Filter sections — remove disabled modules and inaccessible items
  const visibleSections = navSections
    .filter(section => isModuleEnabled(section.module, state.modules))
    .map(section => ({
      ...section,
      items: section.items.filter(item => canAccess(item, user?.role)),
    }))
    .filter(section => section.items.length > 0)

  return (
    <aside
      className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 transition-all duration-200 ease-out ${
        collapsed ? 'lg:w-[68px]' : 'lg:w-[260px]'
      }`}
      style={{ backgroundColor: 'var(--sidebar-bg)', zIndex: 'var(--z-sidebar)' }}
    >
      {/* ── Logo ── */}
      <div
        className="flex items-center gap-3 px-4 h-[60px] shrink-0"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">WS</span>
        </div>
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <h1 className="font-semibold text-sm text-white truncate">WebSquare</h1>
            <p className="text-[11px] truncate" style={{ color: 'var(--sidebar-text)' }}>
              Vyoma AI Studios
            </p>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {visibleSections.map((section, sIdx) => {
          const colors = DEPT_COLORS[section.id] || DEPT_COLORS.stores
          return (
            <div key={`${section.id}-${sIdx}`} className="mb-1">
              {/* Section label */}
              {!collapsed && (
                <div
                  className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--sidebar-section)' }}
                >
                  {section.label}
                </div>
              )}
              {collapsed && sIdx > 0 && (
                <div className="mx-3 my-1.5" style={{ borderTop: '1px solid var(--sidebar-border)' }} />
              )}

              {/* Items */}
              <div className="px-2 space-y-0.5">
                {section.items.map(item => {
                  const isActive = item.end
                    ? location.pathname === item.path || location.pathname === item.path + '/'
                    : location.pathname.startsWith(item.path) && item.path !== '/app'

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      className={`group flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                        collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
                      }`}
                      style={{
                        color: isActive ? colors.accent : 'var(--sidebar-text)',
                        backgroundColor: isActive ? colors.bg : 'transparent',
                        borderLeft: isActive && !collapsed ? `3px solid ${colors.accent}` : '3px solid transparent',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'
                          e.currentTarget.style.color = 'var(--sidebar-text-active)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent'
                          e.currentTarget.style.color = 'var(--sidebar-text)'
                        }
                      }}
                    >
                      <item.icon size={collapsed ? 20 : 18} className="shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── Bottom section (collapse + user) — always visible ── */}
      <div className="shrink-0" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="mx-2 mt-2 mb-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors compact-btn"
          style={{
            color: 'var(--sidebar-text)',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          {collapsed ? <ChevronRight size={16} /> : (
            <>
              <ChevronLeft size={16} />
              <span>Collapse</span>
            </>
          )}
        </button>

        {/* User + Logout */}
        <div className="px-3 py-2">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''} mb-2`}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }}
          >
            {user?.name?.charAt(0) || '?'}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-[11px] truncate" style={{ color: 'var(--sidebar-text)' }}>
                {user?.camp_name || 'Head Office'}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign Out' : undefined}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors compact-btn ${
            collapsed ? 'justify-center' : ''
          }`}
          style={{ color: '#f87171' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          <LogOut size={16} />
          {!collapsed && <span>Sign Out</span>}
        </button>
        </div>
      </div>
    </aside>
  )
}

// Export for other components to check sidebar state
export function getSidebarWidth() {
  return localStorage.getItem('ws_sidebar_collapsed') === 'true' ? 68 : 260
}
