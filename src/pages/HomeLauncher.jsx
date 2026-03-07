import { useNavigate } from 'react-router-dom'
import { useUser, useApp, isManager } from '../context/AppContext'
import { APP_CARDS } from '../config/apps'
import { LogOut, Home } from 'lucide-react'

const colorStyles = {
  blue:    { bg: '#dbeafe', text: '#2563eb' },
  emerald: { bg: '#d1fae5', text: '#059669' },
  amber:   { bg: '#fef3c7', text: '#d97706' },
  purple:  { bg: '#ede9fe', text: '#7c3aed' },
  cyan:    { bg: '#cffafe', text: '#0891b2' },
  slate:   { bg: '#f1f5f9', text: '#475569' },
}

export default function HomeLauncher() {
  const user = useUser()
  const { state, dispatch } = useApp()
  const navigate = useNavigate()

  const role = user?.role

  const visibleApps = APP_CARDS.filter(app => {
    // Module check — if modules array populated, check membership
    if (state.modules?.length > 0 && !state.modules.includes(app.module)) return false
    // Admin/director bypass all role checks
    if (role === 'admin' || role === 'director') return true
    // Exclusion check
    if (app.exclude?.includes(role)) return false
    // Specific roles whitelist
    if (app.roles) return app.roles.includes(role)
    // Access level
    if (app.access === 'manager') return isManager(role)
    return true
  })

  function greeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  function handleLogout() {
    dispatch({ type: 'LOGOUT' })
    window.location.hash = '#/login'
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">WS</span>
          </div>
          <div>
            <h1 className="font-semibold text-sm text-gray-900 tracking-tight">WebSquare</h1>
            <p className="text-[11px] text-gray-400">Inventory Management</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold bg-amber-100 text-amber-700">
              {user?.name?.charAt(0) || '?'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-[11px] text-gray-400 capitalize">{role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-3xl mx-auto px-4 lg:px-6 py-8 lg:py-12">
        {/* Greeting */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            {greeting()}, {user?.name?.split(' ')[0]}
          </h2>
          <p className="text-gray-500 mt-1">
            {user?.camp_name || 'Head Office'} &mdash; {new Date().toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </p>
        </div>

        {/* App Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {visibleApps.map(app => {
            const colors = colorStyles[app.color] || colorStyles.slate
            return (
              <button
                key={app.id}
                onClick={() => navigate(app.path)}
                className="bg-white rounded-xl border border-gray-200 p-5 text-left
                           hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                  <app.icon size={24} />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1 group-hover:text-amber-600 transition-colors">
                  {app.label}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                  {app.desc}
                </p>
              </button>
            )
          })}
        </div>

        {/* Empty state */}
        {visibleApps.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Home size={28} className="text-gray-400" />
            </div>
            <h3 className="text-gray-900 font-medium mb-1">No apps available</h3>
            <p className="text-sm text-gray-500">
              Contact your administrator to enable modules for your camp.
            </p>
          </div>
        )}

        {/* Tenant info */}
        {state.tenant?.status === 'trial' && (
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
            You are on a free trial. {state.tenant.trial_end && (
              <>Expires {new Date(state.tenant.trial_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.</>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
