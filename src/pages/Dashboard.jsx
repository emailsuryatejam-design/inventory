import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser, useSelectedCamp, useTenant, isManager } from '../context/AppContext'
import { dashboard, alerts as alertsApi } from '../services/api'
import {
  ShoppingCart, Boxes, AlertTriangle, PackageCheck,
  TrendingUp, Clock, FileOutput, ArrowRight, Bell,
  Sparkles, Users, ClipboardList, Package, X
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function Dashboard() {
  const user = useUser()
  const tenant = useTenant()
  const { campId } = useSelectedCamp()
  const [stats, setStats] = useState(null)
  const [alertSummary, setAlertSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [welcomeDismissed, setWelcomeDismissed] = useState(
    () => localStorage.getItem('ws_welcome_dismissed') === 'true'
  )

  useEffect(() => {
    loadStats()
  }, [campId])

  async function loadStats() {
    setLoading(true)
    setError('')
    try {
      const effectiveCamp = campId || user?.camp_id
      const [data, alertData] = await Promise.all([
        dashboard.get(effectiveCamp),
        alertsApi.summary(effectiveCamp).catch(() => null),
      ])
      setStats(data)
      if (alertData) setAlertSummary(alertData.alerts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  function formatValue(v) {
    if (!v) return 'TZS 0'
    if (v >= 1000000) return `TZS ${(v / 1000000).toFixed(1)}M`
    if (v >= 1000) return `TZS ${(v / 1000).toFixed(0)}K`
    return `TZS ${Math.round(v).toLocaleString()}`
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  if (loading && !stats) return <LoadingSpinner message="Loading dashboard..." />

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting()}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-gray-500 mt-1">
          {user?.camp_name || 'Head Office'} — {new Date().toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          })}
        </p>
      </div>

      {/* Welcome Card — shown to new trial tenants */}
      {tenant?.plan === 'trial' && !welcomeDismissed && (
        <div className="bg-white rounded-xl border border-amber-200 p-5 mb-6 relative" style={{ boxShadow: '0 4px 20px rgba(245,158,11,0.08)' }}>
          <button
            onClick={() => { setWelcomeDismissed(true); localStorage.setItem('ws_welcome_dismissed', 'true') }}
            className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
              <Sparkles size={18} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Welcome to WebSquare!</h3>
              <p className="text-xs text-gray-500">Your 30-day trial is active. Here's how to get started:</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <SetupLink to="/app/items/new" icon={Package} label="Add inventory items" />
            <SetupLink to="/app/users" icon={Users} label="Invite your team" />
            <SetupLink to="/app/orders/new" icon={ClipboardList} label="Create first order" />
            <SetupLink to="/app/stock" icon={Boxes} label="Check stock levels" />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadStats} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Stats Cards — KaziPay style: icon on right, clean borders */}
      <div data-guide="dashboard-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={ShoppingCart}
          label="Pending Orders"
          value={stats?.pending_orders ?? 0}
          subtitle="Awaiting approval"
          color="blue"
          link="/app/orders"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock Items"
          value={alertSummary ? (alertSummary.low_stock + alertSummary.out_of_stock) : (stats?.low_stock_items ?? 0)}
          subtitle="Need attention"
          color="amber"
          link="/app/alerts"
        />
        <StatCard
          icon={PackageCheck}
          label="Pending Receipts"
          value={stats?.pending_receipts ?? 0}
          subtitle="In transit"
          color="green"
          link="/app/receive"
        />
        <StatCard
          icon={FileOutput}
          label="Issues Today"
          value={stats?.issues_today ?? 0}
          subtitle="Issued vouchers"
          color="purple"
          link="/app/issue"
        />
      </div>

      {/* Stock Value Banner — clean white card with amber accent */}
      {stats && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6" style={{ boxShadow: 'var(--shadow-xs)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Stock Value</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{formatValue(stats.total_stock_value)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-sm">Active Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.items_count?.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Alert Banner */}
      {alertSummary && alertSummary.total_alerts > 0 && (
        <Link
          to="/app/alerts"
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 hover:bg-amber-100 transition"
        >
          <Bell size={20} className="text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              {alertSummary.total_alerts} stock alerts require attention
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {alertSummary.out_of_stock > 0 && `${alertSummary.out_of_stock} out of stock · `}
              {alertSummary.critical > 0 && `${alertSummary.critical} critical · `}
              {alertSummary.stockout_7days > 0 && `${alertSummary.stockout_7days} running out in 7 days · `}
              {alertSummary.dead_stock > 0 && `${alertSummary.dead_stock} dead stock`}
            </p>
          </div>
          <ArrowRight size={16} className="text-amber-400" />
        </Link>
      )}

      {/* Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Quick Actions Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6" style={{ boxShadow: 'var(--shadow-xs)' }}>
          <h2 className="font-semibold text-gray-900 mb-3">Quick Actions</h2>
          <div className="space-y-1">
            <QuickAction
              to="/app/orders/new"
              icon={ShoppingCart}
              label="New Order"
              desc="Create a purchase order"
              color="green"
            />
            <QuickAction
              to="/app/issue/new"
              icon={FileOutput}
              label="New Issue"
              desc="Issue goods to department"
              color="blue"
            />
            <QuickAction
              to="/app/stock"
              icon={Boxes}
              label="Check Stock"
              desc="View current stock levels"
              color="amber"
            />
            <QuickAction
              to="/app/items"
              icon={TrendingUp}
              label="Items Catalog"
              desc="Browse all inventory items"
              color="gray"
            />
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl border border-gray-200 p-6" style={{ boxShadow: 'var(--shadow-xs)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Orders</h2>
            <Link to="/app/orders" className="text-green-600 text-sm font-medium flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {!stats?.recent_orders?.length ? (
            <div className="text-center py-6">
              <ShoppingCart size={32} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No recent orders</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recent_orders.map(order => (
                <Link
                  key={order.id}
                  to={`/app/orders/${order.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition -mx-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-mono font-medium text-gray-900">{order.order_number}</span>
                      <Badge variant={order.status} />
                    </div>
                    <p className="text-xs text-gray-400">
                      {order.camp_code} · {order.created_by} · {formatDate(order.created_at)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                    {formatValue(order.total_value)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alerts */}
      {stats?.low_stock_alerts?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6" style={{ boxShadow: 'var(--shadow-xs)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              Low Stock Alerts
            </h2>
            <Link to="/app/alerts" className="text-green-600 text-sm font-medium flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 pb-2">Item</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-2">Camp</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-2">Current</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-2">Par Level</th>
                  <th className="text-center text-xs font-medium text-gray-500 pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.low_stock_alerts.map((alert, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2.5">
                      <Link to={`/app/items/${alert.item_id}`} className="text-sm font-medium text-gray-900 hover:text-green-600">
                        {alert.item_name}
                      </Link>
                      <p className="text-xs text-gray-400">{alert.item_code}</p>
                    </td>
                    <td className="py-2.5">
                      <span className="text-sm text-gray-500">{alert.camp_code}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`text-sm font-semibold ${
                        alert.stock_status === 'out' ? 'text-red-600' :
                        alert.stock_status === 'critical' ? 'text-red-500' : 'text-amber-600'
                      }`}>
                        {alert.current_qty} {alert.uom}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="text-sm text-gray-400">{alert.par_level || '—'} {alert.uom}</span>
                    </td>
                    <td className="py-2.5 text-center">
                      <Badge variant={alert.stock_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="lg:hidden space-y-2">
            {stats.low_stock_alerts.map((alert, i) => (
              <Link
                key={i}
                to={`/app/items/${alert.item_id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition -mx-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{alert.item_name}</p>
                  <p className="text-xs text-gray-400">{alert.item_code} · {alert.camp_code}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-sm font-bold ${
                    alert.stock_status === 'out' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {alert.current_qty}
                  </span>
                  <span className="text-xs text-gray-400 ml-0.5">{alert.uom}</span>
                </div>
                <Badge variant={alert.stock_status} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, subtitle, color, link }) {
  const iconColors = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <Link
      to={link}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition"
      style={{ boxShadow: 'var(--shadow-xs)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconColors[color]}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </Link>
  )
}

function SetupLink({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 hover:bg-amber-50 transition group"
    >
      <Icon size={16} className="text-gray-400 group-hover:text-amber-600 flex-shrink-0" />
      <span className="text-xs font-medium text-gray-700 group-hover:text-amber-700">{label}</span>
    </Link>
  )
}

function QuickAction({ to, icon: Icon, label, desc, color }) {
  const iconBg = {
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
    gray: 'bg-gray-100 text-gray-600',
  }

  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg[color]}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {desc && <p className="text-xs text-gray-400 truncate">{desc}</p>}
      </div>
      <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-400 shrink-0" />
    </Link>
  )
}
