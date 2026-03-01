import { useState, useEffect } from 'react'
import {
  Shield, Users, Building2, Clock, AlertTriangle, Search, X,
  LogOut, Eye, Calendar, Play, Pause, MoreHorizontal,
  CheckCircle, XCircle, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  MapPin, Mail, Phone, Globe, CreditCard, Edit3,
  Save, Package
} from 'lucide-react'

// ── API helper (self-contained, separate from main app auth) ──

const ADMIN_API = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_URL || 'https://darkblue-goshawk-672880.hostingersite.com')

async function adminRequest(action, options = {}) {
  const token = localStorage.getItem('ws_gadmin_token')
  const url = `${ADMIN_API}/global-admin.php?action=${action}${options.params || ''}`
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

// ── Status badge colors ──

const STATUS_COLORS = {
  trial: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-600',
}

const PLAN_COLORS = {
  trial: 'bg-amber-50 text-amber-600',
  starter: 'bg-blue-100 text-blue-700',
  professional: 'bg-indigo-100 text-indigo-700',
  enterprise: 'bg-purple-100 text-purple-700',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

function PlanBadge({ plan }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PLAN_COLORS[plan] || 'bg-gray-100 text-gray-600'}`}>
      {plan}
    </span>
  )
}

// ── Format helpers ──

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function daysLeft(expiryDate) {
  if (!expiryDate) return null
  const diff = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
  return diff
}

// ══════════════════════════════════════════════════════════
// LOGIN SCREEN
// ══════════════════════════════════════════════════════════

function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await adminRequest('login', {
        method: 'POST',
        body: { username, password },
      })
      localStorage.setItem('ws_gadmin_token', data.token)
      onLogin(data.admin)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl mb-4">
            <Shield className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">WebSquare</h1>
          <p className="text-gray-500 mt-1">Global Administration</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Admin Login</h2>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                placeholder="Admin username"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition pr-12"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <XCircle size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Shield size={20} />
            )}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// STAT CARD
// ══════════════════════════════════════════════════════════

function StatCard({ icon: Icon, label, value, color, subtitle }) {
  const iconColors = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-100 text-gray-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition"
      style={{ boxShadow: 'var(--shadow-xs)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconColors[color] || iconColors.gray}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// MODAL WRAPPER
// ══════════════════════════════════════════════════════════

function Modal({ open, onClose, title, children, maxWidth = '480px' }) {
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl overflow-hidden w-full shadow-2xl"
        style={{ maxWidth }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-5 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// EXTEND TRIAL MODAL
// ══════════════════════════════════════════════════════════

function ExtendTrialModal({ open, onClose, tenant, onSuccess }) {
  const [days, setDays] = useState(14)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await adminRequest('extend-trial', {
        method: 'POST',
        body: { id: tenant.id, days: Number(days) },
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Extend Trial">
      <form onSubmit={handleSubmit}>
        <p className="text-sm text-gray-600 mb-4">
          Extend the trial period for <span className="font-semibold">{tenant?.company_name}</span>
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional Days</label>
          <input
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            min="1"
            max="365"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            Current expiry: {formatDate(tenant?.trial_ends_at || tenant?.subscription_ends_at)}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
            {loading ? 'Extending...' : 'Extend Trial'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════
// SUSPEND MODAL
// ══════════════════════════════════════════════════════════

function SuspendModal({ open, onClose, tenant, onSuccess }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await adminRequest('suspend', {
        method: 'POST',
        body: { id: tenant.id, reason },
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Suspend Tenant">
      <form onSubmit={handleSubmit}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700">
            This will suspend <span className="font-semibold">{tenant?.company_name}</span>.
            All users will lose access immediately.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Suspension</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition resize-none"
            rows={3}
            placeholder="Enter reason..."
            required
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Pause size={16} />}
            {loading ? 'Suspending...' : 'Suspend'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════
// ACTIVATE MODAL
// ══════════════════════════════════════════════════════════

function ActivateModal({ open, onClose, tenant, onSuccess }) {
  const [plan, setPlan] = useState('starter')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await adminRequest('activate', {
        method: 'POST',
        body: { id: tenant.id, plan },
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Activate Tenant">
      <form onSubmit={handleSubmit}>
        <p className="text-sm text-gray-600 mb-4">
          Activate <span className="font-semibold">{tenant?.company_name}</span> with a paid plan.
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition bg-white"
          >
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {loading ? 'Activating...' : 'Activate'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════
// TENANT DETAIL MODAL
// ══════════════════════════════════════════════════════════

function TenantDetailModal({ open, onClose, tenantId, onAction }) {
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && tenantId) {
      loadTenant()
    }
    return () => {
      setTenant(null)
      setEditing(false)
    }
  }, [open, tenantId])

  async function loadTenant() {
    setLoading(true)
    setError('')
    try {
      const data = await adminRequest('tenant', { params: `&id=${tenantId}` })
      setTenant(data.tenant || data)
      setEditData({
        max_users: data.tenant?.max_users || data.max_users || 10,
        max_camps: data.tenant?.max_camps || data.max_camps || 3,
        plan: data.tenant?.plan || data.plan || 'trial',
        notes: data.tenant?.admin_notes || data.admin_notes || '',
        modules: data.tenant?.modules || data.modules || '',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await adminRequest('update', {
        method: 'POST',
        body: { id: tenantId, ...editData },
      })
      setEditing(false)
      loadTenant()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const t = tenant

  return (
    <Modal open={open} onClose={onClose} title="Tenant Details" maxWidth="640px">
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-amber-500" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadTenant} className="ml-2 underline">Retry</button>
        </div>
      )}

      {t && !loading && (
        <div className="space-y-5">
          {/* Company Info Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t.company_name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{t.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={t.status} />
              <PlanBadge plan={t.plan} />
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={Mail} label="Email" value={t.email} />
            <InfoRow icon={Phone} label="Phone" value={t.phone || '—'} />
            <InfoRow icon={Globe} label="Country" value={t.country || '—'} />
            <InfoRow icon={CreditCard} label="Plan" value={t.plan} />
            <InfoRow icon={Users} label="Users" value={`${t.user_count || 0} / ${t.max_users || '?'}`} />
            <InfoRow icon={MapPin} label="Camps" value={`${t.camp_count || 0} / ${t.max_camps || '?'}`} />
            <InfoRow icon={Calendar} label="Created" value={formatDate(t.created_at)} />
            <InfoRow icon={Clock} label="Expires" value={formatDate(t.trial_ends_at || t.subscription_ends_at)} />
          </div>

          {/* Edit Section */}
          {editing ? (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Edit Settings</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Max Users</label>
                  <input
                    type="number"
                    value={editData.max_users}
                    onChange={e => setEditData(d => ({ ...d, max_users: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Max Camps</label>
                  <input
                    type="number"
                    value={editData.max_camps}
                    onChange={e => setEditData(d => ({ ...d, max_camps: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Plan</label>
                <select
                  value={editData.plan}
                  onChange={e => setEditData(d => ({ ...d, plan: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="trial">Trial</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Modules (comma-separated)</label>
                <input
                  type="text"
                  value={editData.modules}
                  onChange={e => setEditData(d => ({ ...d, modules: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  placeholder="stores, kitchen, bar, reports, admin"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Admin Notes</label>
                <textarea
                  value={editData.notes}
                  onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none resize-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              <Edit3 size={14} />
              Edit Settings
            </button>
          )}

          {/* Users List */}
          {t.users && t.users.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                <Users size={14} />
                Users ({t.users.length})
              </h4>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Name</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Role</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 hidden sm:table-cell">Last Login</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {t.users.map((u, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <p className="text-sm font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.username || u.email}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-medium text-gray-600 capitalize">{u.role?.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell">
                          <span className="text-xs text-gray-400">{formatDateTime(u.last_login)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Camps List */}
          {t.camps && t.camps.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                <MapPin size={14} />
                Camps ({t.camps.length})
              </h4>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Camp</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Code</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 hidden sm:table-cell">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {t.camps.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <p className="text-sm font-medium text-gray-900">{c.name}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-mono text-gray-600">{c.code}</span>
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell">
                          <span className="text-xs text-gray-400">{c.location || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No users/camps message */}
          {(!t.users || t.users.length === 0) && (!t.camps || t.camps.length === 0) && (
            <div className="text-center py-4">
              <Package size={24} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No users or camps configured yet</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            {(t.status === 'trial' || t.status === 'active') && (
              <button
                onClick={() => { onClose(); onAction('extend', t) }}
                className="px-3 py-2 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition flex items-center gap-1.5"
              >
                <Calendar size={14} />
                Extend
              </button>
            )}
            {t.status !== 'suspended' ? (
              <button
                onClick={() => { onClose(); onAction('suspend', t) }}
                className="px-3 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition flex items-center gap-1.5"
              >
                <Pause size={14} />
                Suspend
              </button>
            ) : (
              <button
                onClick={() => { onClose(); onAction('activate', t) }}
                className="px-3 py-2 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition flex items-center gap-1.5"
              >
                <Play size={14} />
                Activate
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-gray-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900 truncate capitalize">{value}</p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// MAIN ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════

function AdminDashboard({ admin, onLogout }) {
  const [stats, setStats] = useState(null)
  const [tenants, setTenants] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [tenantsLoading, setTenantsLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  // Modals
  const [detailTenantId, setDetailTenantId] = useState(null)
  const [extendTenant, setExtendTenant] = useState(null)
  const [suspendTenant, setSuspendTenant] = useState(null)
  const [activateTenant, setActivateTenant] = useState(null)
  const [actionMenuId, setActionMenuId] = useState(null)

  // Load stats
  useEffect(() => {
    loadDashboard()
  }, [])

  // Load tenants when filters change
  useEffect(() => {
    loadTenants()
  }, [statusFilter, page])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      loadTenants()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  async function loadDashboard() {
    try {
      const data = await adminRequest('dashboard')
      setStats(data.stats || data)
    } catch (err) {
      if (err.message?.includes('Unauthorized') || err.message?.includes('expired')) {
        localStorage.removeItem('ws_gadmin_token')
        onLogout()
        return
      }
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadTenants() {
    setTenantsLoading(true)
    try {
      let params = `&page=${page}`
      if (statusFilter !== 'all') params += `&status=${statusFilter}`
      if (search) params += `&search=${encodeURIComponent(search)}`

      const data = await adminRequest('tenants', { params })
      setTenants(data.tenants || [])
      setPagination({
        page: data.page || page,
        total: data.total || 0,
        pages: data.pages || 1,
      })
    } catch (err) {
      if (err.message?.includes('Unauthorized') || err.message?.includes('expired')) {
        localStorage.removeItem('ws_gadmin_token')
        onLogout()
        return
      }
      setError(err.message)
    } finally {
      setTenantsLoading(false)
    }
  }

  function refreshAll() {
    loadDashboard()
    loadTenants()
  }

  function handleTenantAction(action, tenant) {
    setActionMenuId(null)
    switch (action) {
      case 'view':
        setDetailTenantId(tenant.id)
        break
      case 'extend':
        setExtendTenant(tenant)
        break
      case 'suspend':
        setSuspendTenant(tenant)
        break
      case 'activate':
        setActivateTenant(tenant)
        break
    }
  }

  // Close action menu on outside click
  useEffect(() => {
    if (!actionMenuId) return
    function handleClick() { setActionMenuId(null) }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [actionMenuId])

  const STATUS_TABS = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'trial', label: 'Trial' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'expired', label: 'Expired' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0" style={{ zIndex: 50 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
                <Shield className="text-white" size={18} />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">WebSquare Admin</h1>
                <p className="text-xs text-gray-400">Global Administration</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={refreshAll}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                title="Refresh"
              >
                <RefreshCw size={18} />
              </button>
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
                <Shield size={14} />
                <span>{admin?.username || 'Admin'}</span>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('ws_gadmin_token')
                  onLogout()
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
            <button onClick={refreshAll} className="ml-2 underline">Retry</button>
          </div>
        )}

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-20 mb-3" />
                <div className="h-8 bg-gray-100 rounded w-12" />
              </div>
            ))}
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <StatCard icon={Building2} label="Total Tenants" value={stats.total_tenants ?? 0} color="blue" subtitle="All companies" />
            <StatCard icon={CheckCircle} label="Active" value={stats.active ?? 0} color="green" subtitle="Paid plans" />
            <StatCard icon={Clock} label="Trial" value={stats.trial ?? 0} color="amber" subtitle="Free trial" />
            <StatCard icon={XCircle} label="Suspended" value={stats.suspended ?? 0} color="red" subtitle="Access revoked" />
            <StatCard icon={AlertTriangle} label="Expiring Soon" value={stats.expiring_soon ?? 0} color="purple" subtitle="Within 7 days" />
          </div>
        )}

        {/* Tenants Table Card */}
        <div className="bg-white rounded-xl border border-gray-200" style={{ boxShadow: 'var(--shadow-xs)' }}>
          {/* Table Header */}
          <div className="p-4 sm:p-5 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">Tenants</h2>

              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tenants..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Status Tabs */}
            <div className="flex gap-1 mt-3 overflow-x-auto">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => { setStatusFilter(tab.value); setPage(1) }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition ${
                    statusFilter === tab.value
                      ? 'bg-amber-100 text-amber-700'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading state */}
          {tenantsLoading && tenants.length === 0 && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-amber-500" />
            </div>
          )}

          {/* Empty state */}
          {!tenantsLoading && tenants.length === 0 && (
            <div className="text-center py-16">
              <Building2 size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-400">No tenants found</p>
              <p className="text-xs text-gray-300 mt-1">
                {search ? 'Try a different search term' : 'No tenants match the current filter'}
              </p>
            </div>
          )}

          {/* Desktop Table */}
          {tenants.length > 0 && (
            <>
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Company</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-3">Plan</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">Users</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">Days Left</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-3">Created</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tenants.map(t => {
                      const dl = daysLeft(t.trial_ends_at || t.subscription_ends_at)
                      return (
                        <tr key={t.id} className="hover:bg-gray-50 transition">
                          <td className="px-5 py-3">
                            <p className="text-sm font-medium text-gray-900">{t.company_name}</p>
                            <p className="text-xs text-gray-400">{t.email}</p>
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={t.status} />
                          </td>
                          <td className="px-3 py-3">
                            <PlanBadge plan={t.plan} />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-sm text-gray-700">{t.user_count ?? 0}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {dl !== null ? (
                              <span className={`text-sm font-medium ${
                                dl <= 0 ? 'text-red-600' :
                                dl <= 7 ? 'text-amber-600' : 'text-gray-600'
                              }`}>
                                {dl <= 0 ? 'Expired' : `${dl}d`}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-sm text-gray-500">{formatDate(t.created_at)}</span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setDetailTenantId(t.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                                title="View Details"
                              >
                                <Eye size={16} />
                              </button>
                              {(t.status === 'trial' || t.status === 'active') && (
                                <button
                                  onClick={() => setExtendTenant(t)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition"
                                  title="Extend Trial"
                                >
                                  <Calendar size={16} />
                                </button>
                              )}
                              {t.status !== 'suspended' ? (
                                <button
                                  onClick={() => setSuspendTenant(t)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                                  title="Suspend"
                                >
                                  <Pause size={16} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setActivateTenant(t)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition"
                                  title="Activate"
                                >
                                  <Play size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {tenants.map(t => {
                  const dl = daysLeft(t.trial_ends_at || t.subscription_ends_at)
                  return (
                    <div key={t.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{t.company_name}</p>
                          <p className="text-xs text-gray-400 truncate">{t.email}</p>
                        </div>
                        <div className="relative ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setActionMenuId(actionMenuId === t.id ? null : t.id)
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                          {actionMenuId === t.id && (
                            <div
                              className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-200 py-1"
                              style={{ zIndex: 10 }}
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handleTenantAction('view', t)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Eye size={14} /> View Details
                              </button>
                              {(t.status === 'trial' || t.status === 'active') && (
                                <button
                                  onClick={() => handleTenantAction('extend', t)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"
                                >
                                  <Calendar size={14} /> Extend Trial
                                </button>
                              )}
                              {t.status !== 'suspended' ? (
                                <button
                                  onClick={() => handleTenantAction('suspend', t)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                                >
                                  <Pause size={14} /> Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleTenantAction('activate', t)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-700 hover:bg-green-50"
                                >
                                  <Play size={14} /> Activate
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={t.status} />
                        <PlanBadge plan={t.plan} />
                        <span className="text-xs text-gray-400">
                          <Users size={12} className="inline mr-0.5" />
                          {t.user_count ?? 0} users
                        </span>
                        {dl !== null && (
                          <span className={`text-xs font-medium ${
                            dl <= 0 ? 'text-red-600' :
                            dl <= 7 ? 'text-amber-600' : 'text-gray-500'
                          }`}>
                            {dl <= 0 ? 'Expired' : `${dl}d left`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">Created {formatDate(t.created_at)}</p>
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Page {pagination.page} of {pagination.pages} ({pagination.total} tenants)
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                      disabled={page >= pagination.pages}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      <TenantDetailModal
        open={!!detailTenantId}
        onClose={() => setDetailTenantId(null)}
        tenantId={detailTenantId}
        onAction={(action, t) => handleTenantAction(action, t)}
      />

      {extendTenant && (
        <ExtendTrialModal
          open={!!extendTenant}
          onClose={() => setExtendTenant(null)}
          tenant={extendTenant}
          onSuccess={refreshAll}
        />
      )}

      {suspendTenant && (
        <SuspendModal
          open={!!suspendTenant}
          onClose={() => setSuspendTenant(null)}
          tenant={suspendTenant}
          onSuccess={refreshAll}
        />
      )}

      {activateTenant && (
        <ActivateModal
          open={!!activateTenant}
          onClose={() => setActivateTenant(null)}
          tenant={activateTenant}
          onSuccess={refreshAll}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// ROOT COMPONENT
// ══════════════════════════════════════════════════════════

export default function GlobalAdmin() {
  const [admin, setAdmin] = useState(null)
  const [checking, setChecking] = useState(true)

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('ws_gadmin_token')
    if (token) {
      // Validate token by fetching dashboard
      adminRequest('dashboard')
        .then(() => setAdmin({ username: 'admin' }))
        .catch(() => localStorage.removeItem('ws_gadmin_token'))
        .finally(() => setChecking(false))
    } else {
      setChecking(false)
    }
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Verifying session...</p>
        </div>
      </div>
    )
  }

  if (!admin) {
    return <AdminLogin onLogin={(adminData) => setAdmin(adminData || { username: 'admin' })} />
  }

  return <AdminDashboard admin={admin} onLogout={() => setAdmin(null)} />
}
