import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useUser, useApp, isManager } from '../../context/AppContext'
import {
  LayoutDashboard, Package, Boxes, ShoppingCart,
  Truck, PackageCheck, FileOutput, Bell, BarChart3,
  Users, Settings, LogOut, Wine, BookOpen, GlassWater, Calendar, ChefHat,
  ClipboardList, ChevronLeft, ChevronRight, Building2,
  ClipboardCheck, FileText, PackagePlus, Home,
  Wallet, Calculator, CalendarDays, BanknoteIcon, MapPin, Clock,
  FileSignature, Route, ScrollText, CreditCard, Globe, Briefcase,
  UserCheck, Shield, IdCard, FileCheck, Download, User, Banknote,
  FileDown, MapPinned, Award
} from 'lucide-react'

// ── Navigation sections (each with a group for per-app filtering) ──────
const CHEF_ONLY = ['chef']

const navSections = [
  // ── Stores App ──
  {
    group: 'stores',
    module: 'stores',
    label: 'Stores',
    items: [
      { path: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/stock', icon: Boxes, label: 'Stock Levels', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/items', icon: Package, label: 'Items Catalog', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/issue', icon: FileOutput, label: 'Issue Goods', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/receive', icon: PackageCheck, label: 'Receive Goods', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/orders', icon: ShoppingCart, label: 'Orders', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/suppliers', icon: Building2, label: 'Suppliers', access: 'manager' },
      { path: '/app/stock-adjustments', icon: ClipboardCheck, label: 'Adjustments', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/dispatch', icon: Truck, label: 'Dispatch', access: 'manager' },
      { path: '/app/daily', icon: Calendar, label: 'Daily Overview', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/alerts', icon: Bell, label: 'Alerts', access: 'all', exclude: CHEF_ONLY },
    ],
  },
  {
    group: 'stores',
    module: 'stores',
    label: 'Procurement',
    items: [
      { path: '/app/purchase-orders', icon: FileText, label: 'Purchase Orders', roles: ['procurement_officer', 'stores_manager', 'admin', 'director'] },
      { path: '/app/grn', icon: PackagePlus, label: 'Goods Received', roles: ['procurement_officer', 'stores_manager', 'camp_storekeeper', 'admin', 'director'] },
    ],
  },
  // ── Kitchen App ──
  {
    group: 'kitchen',
    module: 'kitchen',
    label: 'Kitchen',
    items: [
      { path: '/app/menu-plan', icon: ChefHat, label: 'Menu Plan', roles: ['chef', 'camp_manager', 'admin', 'director'] },
      { path: '/app/daily-groceries', icon: ClipboardList, label: 'Daily Groceries', roles: ['chef', 'camp_manager', 'admin', 'director'] },
      { path: '/app/weekly-groceries', icon: Calendar, label: 'Weekly Groceries', roles: ['chef', 'camp_manager', 'admin', 'director'] },
      { path: '/app/recipes', icon: BookOpen, label: 'Recipes', access: 'all' },
      { path: '/app/set-menus', icon: CalendarDays, label: 'Set Menus', access: 'manager' },
    ],
  },
  {
    group: 'kitchen',
    module: 'kitchen',
    label: 'Requisitions',
    items: [
      { path: '/app/kitchen-requisition', icon: ClipboardList, label: 'Requisition', roles: ['chef', 'camp_manager', 'admin', 'director'] },
      { path: '/app/kitchen-store', icon: PackageCheck, label: 'Store Dashboard', roles: ['storekeeper', 'camp_storekeeper', 'stores_manager', 'admin', 'director'] },
      { path: '/app/kitchen-store-orders', icon: ShoppingCart, label: 'Store Orders', roles: ['storekeeper', 'camp_storekeeper', 'stores_manager', 'admin', 'director'] },
      { path: '/app/kitchen-day-close', icon: Calendar, label: 'Day Close', roles: ['chef', 'camp_manager', 'admin', 'director'] },
      { path: '/app/kitchen-reports', icon: BarChart3, label: 'Kitchen Reports', access: 'manager' },
    ],
  },
  {
    group: 'kitchen',
    module: 'kitchen',
    label: 'Kitchen Admin',
    items: [
      { path: '/app/kitchen-admin', icon: ChefHat, label: 'Kitchens', access: 'manager' },
      { path: '/app/requisition-types', icon: ClipboardCheck, label: 'Req Types', access: 'manager' },
    ],
  },
  // ── Bar & POS App ──
  {
    group: 'bar',
    module: 'bar',
    label: 'Bar & POS',
    items: [
      { path: '/app/pos', icon: Wine, label: 'Point of Sale', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/bar-menu', icon: GlassWater, label: 'Bar Menu', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/bar-tabs', icon: ClipboardList, label: 'Tabs / Bills', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/bar-shifts', icon: Clock, label: 'Shifts', access: 'all', exclude: CHEF_ONLY },
      { path: '/app/bar-reports', icon: BarChart3, label: 'Bar Reports', access: 'manager' },
    ],
  },
  // ── Payroll & HR App ──
  {
    group: 'payroll',
    module: 'payroll',
    label: 'People',
    items: [
      { path: '/app/payroll', icon: LayoutDashboard, label: 'HR Dashboard', access: 'manager' },
      { path: '/app/hr-employees', icon: Users, label: 'Employees', access: 'manager' },
      { path: '/app/departments', icon: Building2, label: 'Departments', access: 'manager' },
      { path: '/app/job-grades', icon: Briefcase, label: 'Job Grades', access: 'manager' },
    ],
  },
  {
    group: 'payroll',
    module: 'payroll',
    label: 'Payroll',
    items: [
      { path: '/app/payroll-periods', icon: Calendar, label: 'Pay Periods', access: 'manager' },
      { path: '/app/payroll-runs', icon: Calculator, label: 'Payroll Runs', access: 'manager' },
      { path: '/app/salary-advances', icon: BanknoteIcon, label: 'Advances', access: 'manager' },
      { path: '/app/hr-loans', icon: Wallet, label: 'Loans', access: 'manager' },
      { path: '/app/expense-claims', icon: CreditCard, label: 'Expense Claims', access: 'manager' },
    ],
  },
  {
    group: 'payroll',
    module: 'payroll',
    label: 'Time & Leave',
    items: [
      { path: '/app/leave', icon: CalendarDays, label: 'Leave', access: 'manager' },
      { path: '/app/attendance', icon: ClipboardCheck, label: 'Attendance', access: 'manager' },
      { path: '/app/shifts', icon: Clock, label: 'Shifts', access: 'manager' },
      { path: '/app/field-tracking', icon: MapPin, label: 'Field Tracking', access: 'manager' },
    ],
  },
  {
    group: 'payroll',
    module: 'payroll',
    label: 'Settings & More',
    items: [
      { path: '/app/hr-regions', icon: Globe, label: 'Regions', access: 'manager' },
      { path: '/app/contracts', icon: FileSignature, label: 'Contracts', access: 'manager' },
      { path: '/app/approvals', icon: UserCheck, label: 'Approvals', access: 'manager' },
      { path: '/app/payroll-reports', icon: BarChart3, label: 'Reports', access: 'manager' },
      { path: '/app/payslip-templates', icon: FileCheck, label: 'Payslips', access: 'manager' },
      { path: '/app/bank-export', icon: Download, label: 'Bank Export', access: 'manager' },
      { path: '/app/id-cards', icon: IdCard, label: 'ID Cards', access: 'manager' },
      { path: '/app/intro-letters', icon: ScrollText, label: 'Letters', access: 'manager' },
      { path: '/app/payroll-audit', icon: Shield, label: 'Audit Log', access: 'manager' },
    ],
  },
  // ── Employee Self-Service ──
  {
    group: 'payroll',
    module: 'payroll',
    label: 'My Portal',
    items: [
      { path: '/app/my-dashboard', icon: LayoutDashboard, label: 'My Dashboard', access: 'all' },
      { path: '/app/my-payslips', icon: Banknote, label: 'My Payslips', access: 'all' },
      { path: '/app/my-leave', icon: CalendarDays, label: 'My Leave', access: 'all' },
      { path: '/app/my-loans', icon: Wallet, label: 'My Loans', access: 'all' },
      { path: '/app/my-attendance', icon: ClipboardCheck, label: 'My Attendance', access: 'all' },
      { path: '/app/my-allowances', icon: Award, label: 'My Allowances', access: 'all' },
      { path: '/app/my-field-work', icon: MapPinned, label: 'Field Work', access: 'all' },
      { path: '/app/my-profile', icon: User, label: 'My Profile', access: 'all' },
      { path: '/app/my-documents', icon: FileDown, label: 'My Documents', access: 'all' },
    ],
  },
  // ── Reports App ──
  {
    group: 'reports',
    module: 'reports',
    label: 'Reports',
    items: [
      { path: '/app/reports', icon: BarChart3, label: 'Reports', access: 'manager' },
    ],
  },
  // ── Admin App ──
  {
    group: 'admin',
    module: 'admin',
    label: 'Admin',
    items: [
      { path: '/app/users', icon: Users, label: 'Users', roles: ['admin', 'director', 'stores_manager'] },
      { path: '/app/settings', icon: Settings, label: 'Settings', access: 'manager' },
    ],
  },
]

// ── Detect which app group the current path belongs to ──
const payrollPaths = [
  '/app/payroll', '/app/hr-employees', '/app/hr-employee',
  '/app/departments', '/app/job-grades',
  '/app/payroll-periods', '/app/payroll-runs', '/app/payroll-run',
  '/app/leave', '/app/attendance',
  '/app/hr-loans', '/app/salary-advances', '/app/expense-claims',
  '/app/payroll-reports', '/app/shifts', '/app/hr-regions',
  '/app/field-tracking', '/app/contracts', '/app/approvals',
  '/app/payroll-audit', '/app/id-cards', '/app/intro-letters',
  '/app/payslip-templates', '/app/allowance-types', '/app/bank-export',
  '/app/my-dashboard', '/app/my-payslips', '/app/my-leave',
  '/app/my-loans', '/app/my-attendance', '/app/my-allowances',
  '/app/my-profile', '/app/my-documents', '/app/my-id-card',
  '/app/my-intro-letter', '/app/my-field-work',
]

const kitchenPaths = ['/app/menu-plan', '/app/daily-groceries', '/app/weekly-groceries', '/app/recipes', '/app/set-menus', '/app/kitchen-admin', '/app/requisition-types', '/app/kitchen-requisition', '/app/kitchen-store', '/app/kitchen-store-orders', '/app/kitchen-day-close', '/app/kitchen-reports', '/app/kitchen-receive']
const barPaths = ['/app/pos', '/app/bar-menu']
const adminPaths = ['/app/users', '/app/settings']
const reportPaths = ['/app/reports']

function getActiveGroup(pathname) {
  if (payrollPaths.some(p => pathname.startsWith(p))) return 'payroll'
  if (kitchenPaths.some(p => pathname.startsWith(p))) return 'kitchen'
  if (barPaths.some(p => pathname.startsWith(p))) return 'bar'
  if (adminPaths.some(p => pathname.startsWith(p))) return 'admin'
  if (reportPaths.some(p => pathname.startsWith(p))) return 'reports'
  return 'stores'
}

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
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed } }))
  }, [collapsed])

  function handleLogout() {
    localStorage.removeItem('ws_token')
    localStorage.removeItem('ws_state')
    window.location.hash = '#/login'
    window.location.reload()
  }

  // Determine which app we're in based on the current route
  const activeGroup = getActiveGroup(location.pathname)

  // Filter: show only sections from the active group + correct module/role access
  const visibleSections = navSections
    .filter(section => section.group === activeGroup)
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
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        zIndex: 'var(--z-sidebar)',
      }}
    >
      {/* ── Logo ── */}
      <div
        className="flex items-center gap-3 px-4 h-[64px] shrink-0"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">WS</span>
        </div>
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <h1 className="font-semibold text-sm text-gray-900 truncate tracking-tight">WebSquare</h1>
            <p className="text-[11px] truncate text-gray-400">
              Inventory Management
            </p>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {/* Home link — back to app launcher */}
        <div className="px-2 mb-2">
          <NavLink
            to="/app"
            end
            title={collapsed ? 'Home' : undefined}
            className={`group flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150 ${
              collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
            }`}
            style={({ isActive }) => ({
              color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
              backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
              borderLeft: isActive && !collapsed ? '3px solid var(--sidebar-accent)' : '3px solid transparent',
            })}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'
              e.currentTarget.style.color = 'var(--sidebar-text-active)'
            }}
            onMouseLeave={e => {
              const active = location.pathname === '/app'
              e.currentTarget.style.backgroundColor = active ? 'var(--sidebar-active)' : 'transparent'
              e.currentTarget.style.color = active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)'
            }}
          >
            <Home size={collapsed ? 20 : 18} className="shrink-0" />
            {!collapsed && <span className="truncate">Home</span>}
          </NavLink>
        </div>

        {visibleSections.map((section, sIdx) => (
          <div key={`${section.group}-${sIdx}`} className="mb-1">
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
                    data-guide={`nav-${item.path === '/app' ? 'dashboard' : item.path.replace('/app/', '').replace(/\//g, '-')}`}
                    title={collapsed ? item.label : undefined}
                    className={`group flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                      collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
                    }`}
                    style={{
                      color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                      backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
                      borderLeft: isActive && !collapsed ? '3px solid var(--sidebar-accent)' : '3px solid transparent',
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
        ))}
      </nav>

      {/* ── Bottom section ── */}
      <div className="shrink-0" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="mx-2 mt-2 mb-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors compact-btn"
          style={{ color: 'var(--sidebar-text)' }}
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

        {/* Settings — always visible for managers/admins */}
        {isManager(user?.role) && (
          <div className="px-2 mb-1">
            <NavLink
              to="/app/settings"
              title={collapsed ? 'Settings' : undefined}
              className={`group flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
              }`}
              style={{
                color: location.pathname.startsWith('/app/settings') ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                backgroundColor: location.pathname.startsWith('/app/settings') ? 'var(--sidebar-active)' : 'transparent',
                borderLeft: location.pathname.startsWith('/app/settings') && !collapsed ? '3px solid var(--sidebar-accent)' : '3px solid transparent',
              }}
              onMouseEnter={e => {
                if (!location.pathname.startsWith('/app/settings')) {
                  e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'
                  e.currentTarget.style.color = 'var(--sidebar-text-active)'
                }
              }}
              onMouseLeave={e => {
                if (!location.pathname.startsWith('/app/settings')) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--sidebar-text)'
                }
              }}
            >
              <Settings size={collapsed ? 20 : 18} className="shrink-0" />
              {!collapsed && <span className="truncate">Settings</span>}
            </NavLink>
          </div>
        )}

        {/* User + Logout */}
        <div className="px-3 py-2">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''} mb-2`}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
              style={{ backgroundColor: '#fef3c7', color: '#b45309' }}
            >
              {user?.name?.charAt(0) || '?'}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-[11px] truncate text-gray-400">
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
            style={{ color: '#ef4444' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fef2f2' }}
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

export function getSidebarWidth() {
  return localStorage.getItem('ws_sidebar_collapsed') === 'true' ? 68 : 260
}
