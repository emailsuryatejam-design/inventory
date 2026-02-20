import { useUser, useApp, isManager } from '../../context/AppContext'
import { useLocation } from 'react-router-dom'
import { Bell, ChevronDown, ChevronRight, Search, Menu } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import SyncStatus from '../ui/SyncStatus'

// ── Route-to-breadcrumb map ──────────────────────
const BREADCRUMBS = {
  '/app': ['Dashboard'],
  '/app/stock': ['Stores', 'Stock Levels'],
  '/app/items': ['Stores', 'Items Catalog'],
  '/app/issue': ['Stores', 'Issue Goods'],
  '/app/issue/new': ['Stores', 'Issue Goods', 'New'],
  '/app/receive': ['Stores', 'Receive Goods'],
  '/app/orders': ['Stores', 'Orders'],
  '/app/orders/new': ['Stores', 'Orders', 'New'],
  '/app/dispatch': ['Stores', 'Dispatch'],
  '/app/daily': ['Stores', 'Daily Overview'],
  '/app/alerts': ['Stores', 'Alerts'],
  '/app/menu-plan': ['Kitchen', 'Menu Plan'],
  '/app/daily-groceries': ['Kitchen', 'Daily Groceries'],
  '/app/weekly-groceries': ['Kitchen', 'Weekly Groceries'],
  '/app/recipes': ['Kitchen', 'Recipes'],
  '/app/pos': ['Bar & POS', 'Point of Sale'],
  '/app/bar-menu': ['Bar & POS', 'Bar Menu'],
  '/app/reports': ['Admin', 'Reports'],
  '/app/users': ['Admin', 'Users'],
  '/app/settings': ['Admin', 'Settings'],
}

function getBreadcrumbs(pathname) {
  // Exact match first
  if (BREADCRUMBS[pathname]) return BREADCRUMBS[pathname]

  // Try prefix match for detail pages like /app/orders/123
  const parts = pathname.split('/')
  while (parts.length > 2) {
    parts.pop()
    const prefix = parts.join('/')
    if (BREADCRUMBS[prefix]) {
      return [...BREADCRUMBS[prefix], 'Detail']
    }
  }

  return ['Dashboard']
}

export default function TopBar({ onMobileMenuToggle }) {
  const user = useUser()
  const { state, dispatch } = useApp()
  const location = useLocation()
  const [showCampPicker, setShowCampPicker] = useState(false)
  const campRef = useRef(null)

  const selectedCamp = state.camps.find(c => c.id === state.selectedCampId)
  const breadcrumbs = getBreadcrumbs(location.pathname)

  // Close camp picker on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (campRef.current && !campRef.current.contains(e.target)) {
        setShowCampPicker(false)
      }
    }
    if (showCampPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCampPicker])

  function selectCamp(campId) {
    dispatch({ type: 'SELECT_CAMP', payload: campId })
    setShowCampPicker(false)
  }

  return (
    <header
      className="bg-white h-[56px] flex items-center justify-between px-4 lg:px-6 sticky top-0"
      style={{
        borderBottom: '1px solid var(--border-default)',
        zIndex: 'var(--z-topbar)',
      }}
    >
      {/* Left: Mobile menu button + Breadcrumbs */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition compact-btn"
        >
          <Menu size={22} />
        </button>

        {/* Mobile logo */}
        <div className="lg:hidden w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xs">KC</span>
        </div>

        {/* Breadcrumbs (desktop only) */}
        <nav className="hidden lg:flex items-center gap-1 text-sm" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
              <span className={
                i === breadcrumbs.length - 1
                  ? 'font-medium text-gray-900'
                  : 'text-gray-400'
              }>
                {crumb}
              </span>
            </span>
          ))}
        </nav>
      </div>

      {/* Right: Camp selector + Sync + Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Camp selector */}
        {isManager(user?.role) && state.camps.length > 0 && (
          <div className="relative" ref={campRef}>
            <button
              onClick={() => setShowCampPicker(!showCampPicker)}
              data-guide="camp-selector"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-sm font-medium border"
              style={{
                backgroundColor: showCampPicker ? '#f1f5f9' : 'white',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="max-w-[120px] truncate">
                {selectedCamp ? selectedCamp.code : 'All Camps'}
              </span>
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </button>
            {showCampPicker && (
              <div
                className="absolute top-full right-0 mt-1.5 bg-white rounded-lg overflow-hidden min-w-[200px]"
                style={{
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 'var(--z-dropdown)',
                }}
              >
                <button
                  onClick={() => selectCamp(null)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition ${
                    !state.selectedCampId ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All Camps
                </button>
                {state.camps.map(camp => (
                  <button
                    key={camp.id}
                    onClick={() => selectCamp(camp.id)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition ${
                      state.selectedCampId === camp.id ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-medium">{camp.code}</span>
                    <span className="text-gray-400 ml-1.5">— {camp.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Non-manager camp name */}
        {!isManager(user?.role) && (
          <span className="hidden sm:inline text-sm font-medium text-gray-500 px-2">
            {user?.camp_name || 'KCL Stores'}
          </span>
        )}

        <SyncStatus />

        {/* Notifications */}
        <button
          data-guide="notifications-btn"
          className="relative p-2 rounded-lg transition compact-btn"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User avatar (desktop) */}
        <div className="hidden lg:flex items-center gap-2 pl-2 ml-1" style={{ borderLeft: '1px solid var(--border-light)' }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ backgroundColor: 'var(--kcl-primary-light)', color: 'var(--kcl-primary-dark)' }}
          >
            {user?.name?.charAt(0) || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate leading-tight">{user?.name}</p>
            <p className="text-[11px] text-gray-400 truncate leading-tight">
              {user?.role?.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
