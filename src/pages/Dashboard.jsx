import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser, useSelectedCamp, isManager } from '../context/AppContext'
import { dashboard, alerts as alertsApi } from '../services/api'
import {
  ShoppingCart, Boxes, AlertTriangle, PackageCheck,
  TrendingUp, Clock, FileOutput, ArrowRight, Bell
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function Dashboard() {
  const user = useUser()
  const { campId } = useSelectedCamp()
  const [stats, setStats] = useState(null)
  const [alertSummary, setAlertSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadStats} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={ShoppingCart}
          label="Pending Orders"
          value={stats?.pending_orders ?? 0}
          color="blue"
          link="/app/orders"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock Items"
          value={alertSummary ? (alertSummary.low_stock + alertSummary.out_of_stock) : (stats?.low_stock_items ?? 0)}
          color="amber"
          link="/app/alerts"
        />
        <StatCard
          icon={PackageCheck}
          label="Pending Receipts"
          value={stats?.pending_receipts ?? 0}
          color="green"
          link="/app/receive"
        />
        <StatCard
          icon={FileOutput}
          label="Issues Today"
          value={stats?.issues_today ?? 0}
          color="purple"
          link="/app/issue"
        />
      </div>

      {/* Stock Value Banner */}
      {stats && (
        <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-5 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Stock Value</p>
              <p className="text-3xl font-bold mt-1">{formatValue(stats.total_stock_value)}</p>
            </div>
            <div className="text-right">
              <p className="text-green-100 text-sm">Active Items</p>
              <p className="text-2xl font-bold mt-1">{stats.items_count?.toLocaleString()}</p>
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction
              to="/app/orders/new"
              icon={ShoppingCart}
              label="New Order"
              color="green"
            />
            <QuickAction
              to="/app/issue/new"
              icon={FileOutput}
              label="New Issue"
              color="blue"
            />
            <QuickAction
              to="/app/stock"
              icon={Boxes}
              label="Check Stock"
              color="amber"
            />
            <QuickAction
              to="/app/items"
              icon={TrendingUp}
              label="Items List"
              color="gray"
            />
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
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

function StatCard({ icon: Icon, label, value, color, link }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <Link to={link} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </Link>
  )
}

function QuickAction({ to, icon: Icon, label, color }) {
  const colors = {
    green: 'bg-green-50 text-green-600 hover:bg-green-100',
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    amber: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
    gray: 'bg-gray-50 text-gray-600 hover:bg-gray-100',
  }

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 p-3 rounded-lg transition ${colors[color]}`}
    >
      <Icon size={20} />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}
