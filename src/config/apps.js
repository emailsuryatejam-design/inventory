import {
  Boxes, ChefHat, Wine, ShoppingCart, BarChart3, Settings, Wallet,
} from 'lucide-react'

/**
 * App Launcher configuration — single source of truth for the home screen.
 * Adding a new app = adding one object here.
 *
 * Fields:
 *   id      — unique key
 *   label   — display name
 *   desc    — short description under the label
 *   icon    — lucide-react icon component
 *   color   — color key for card accent (maps to colorStyles in HomeLauncher)
 *   path    — route to navigate to when clicked
 *   module  — module ID from camp_modules (for camp-level toggle)
 *   access  — 'all' | 'manager' (any user or managers only)
 *   roles   — (optional) whitelist of allowed roles
 *   exclude — (optional) roles explicitly denied
 */

const KITCHEN_ROLES = ['chef', 'camp_manager', 'admin', 'director']
const PROCUREMENT_ROLES = ['procurement_officer', 'stores_manager', 'admin', 'director']
const ADMIN_ROLES = ['admin', 'director', 'stores_manager']

export const APP_CARDS = [
  {
    id: 'stores',
    label: 'Stores',
    desc: 'Stock levels, items catalog, orders, issues & receiving',
    icon: Boxes,
    color: 'blue',
    path: '/app/dashboard',
    module: 'stores',
    access: 'all',
    exclude: ['chef'],
  },
  {
    id: 'procurement',
    label: 'Procurement',
    desc: 'Purchase orders, supplier management & goods received',
    icon: ShoppingCart,
    color: 'emerald',
    path: '/app/purchase-orders',
    module: 'stores',
    roles: PROCUREMENT_ROLES,
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    desc: 'Menu planning, daily & weekly groceries, recipes',
    icon: ChefHat,
    color: 'amber',
    path: '/app/menu-plan',
    module: 'kitchen',
    roles: KITCHEN_ROLES,
  },
  {
    id: 'bar',
    label: 'Bar & POS',
    desc: 'Point of sale, bar menu & sales tracking',
    icon: Wine,
    color: 'purple',
    path: '/app/pos',
    module: 'bar',
    access: 'all',
    exclude: ['chef'],
  },
  {
    id: 'reports',
    label: 'Reports',
    desc: 'Stock reports, consumption analytics & exports',
    icon: BarChart3,
    color: 'cyan',
    path: '/app/reports',
    module: 'reports',
    access: 'manager',
  },
  {
    id: 'payroll',
    label: 'Payroll & HR',
    desc: 'Employee management, payroll, leave & attendance',
    icon: Wallet,
    color: 'rose',
    path: '/app/payroll',
    module: 'payroll',
    roles: ADMIN_ROLES,
  },
  {
    id: 'admin',
    label: 'Admin',
    desc: 'User management, settings & camp configuration',
    icon: Settings,
    color: 'slate',
    path: '/app/users',
    module: 'admin',
    roles: ADMIN_ROLES,
  },
]
