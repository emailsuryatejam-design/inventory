import { useState, useEffect } from 'react'
import { useUser, isManager } from '../context/AppContext'
import { kitchenStoreOrders as ordersApi } from '../services/api'
import {
  ShoppingCart, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Send, Loader2, X, AlertTriangle, Package
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

// ── Date helpers ────────────────────────────────────
function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr() { return toDateStr(new Date()) }

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function isToday(dateStr) { return dateStr === todayStr() }

// Status badge variant mapping
const STATUS_VARIANT = {
  pending: 'pending',
  sent: 'submitted',
  fulfilled: 'success',
  received: 'received',
  closed: 'closed',
  partial: 'partial',
}

// Tab filters
const TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'received', label: 'Received' },
]

// ════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════
export default function KitchenStoreOrders() {
  const user = useUser()
  const canManage = isManager(user?.role)

  // State
  const [date, setDate] = useState(todayStr())
  const [statusFilter, setStatusFilter] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Expanded rows
  const [expandedId, setExpandedId] = useState(null)
  const [expandedDetail, setExpandedDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ── Load orders ──
  useEffect(() => { loadOrders() }, [date, statusFilter])

  async function loadOrders() {
    setLoading(true)
    setError('')
    try {
      const result = await ordersApi.list(statusFilter || undefined)
      setOrders(result.orders || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Date navigation ──
  function changeDate(days) {
    setDate(prev => {
      const d = new Date(prev + 'T00:00:00')
      d.setDate(d.getDate() + days)
      return toDateStr(d)
    })
  }

  // ── Toggle expand ──
  async function handleToggleExpand(orderId) {
    if (expandedId === orderId) {
      setExpandedId(null)
      setExpandedDetail(null)
      return
    }
    setExpandedId(orderId)
    setDetailLoading(true)
    try {
      const result = await ordersApi.get(orderId)
      setExpandedDetail(result.order || result)
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Mark Sent ──
  async function handleMarkSent(orderId) {
    setSaving(true)
    setError('')
    try {
      await ordersApi.markSent(orderId)
      setExpandedId(null)
      setExpandedDetail(null)
      await loadOrders()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pb-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart size={22} className="text-purple-600" />
            Store Orders
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track kitchen-to-store orders</p>
        </div>
      </div>

      {/* ── Date Picker ── */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-3">
        <button onClick={() => changeDate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{formatDate(date)}</p>
          {isToday(date) && <span className="text-[10px] text-green-600 font-medium">Today</span>}
          {!isToday(date) && (
            <button onClick={() => setDate(todayStr())} className="text-[10px] text-blue-600 font-medium">
              Go to Today
            </button>
          )}
        </div>
        <button onClick={() => changeDate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200">
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* ── Status Tab Bar ── */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              statusFilter === tab.value
                ? 'bg-purple-500 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError('')}><X size={16} className="text-red-400" /></button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && <LoadingSpinner message="Loading orders..." />}

      {/* ── Order List ── */}
      {!loading && orders.length === 0 && (
        <EmptyState
          icon={Package}
          title="No orders found"
          message={statusFilter ? `No ${statusFilter} orders` : 'No store orders for this period'}
        />
      )}

      {!loading && orders.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {orders.map(order => (
            <div key={order.id}>
              {/* Order Row */}
              <button
                onClick={() => handleToggleExpand(order.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    Order #{order.id}
                    {order.kitchen_name && (
                      <span className="text-gray-400 font-normal"> — {order.kitchen_name}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {order.date || order.created_at?.split(' ')[0]}
                    {order.item_count != null && ` \u00b7 ${order.item_count} items`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={STATUS_VARIANT[order.status] || 'default'}>
                    {order.status}
                  </Badge>
                  {expandedId === order.id ? (
                    <ChevronUp size={16} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Detail */}
              {expandedId === order.id && (
                <div className="px-4 pb-4 bg-gray-50/50">
                  {detailLoading ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                      <Loader2 size={14} className="animate-spin" /> Loading...
                    </div>
                  ) : expandedDetail ? (
                    <>
                      {/* Lines table */}
                      {expandedDetail.lines && expandedDetail.lines.length > 0 ? (
                        <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-100 text-gray-500 text-left uppercase tracking-wider">
                                <th className="px-3 py-2 font-semibold">Item</th>
                                <th className="px-3 py-2 font-semibold text-right">Requested</th>
                                <th className="px-3 py-2 font-semibold text-right">Fulfilled</th>
                                <th className="px-3 py-2 font-semibold text-right">Received</th>
                                <th className="px-3 py-2 font-semibold text-right">UOM</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {expandedDetail.lines.map(line => (
                                <tr key={line.id}>
                                  <td className="px-3 py-2 text-gray-900">{line.item_name}</td>
                                  <td className="px-3 py-2 text-right text-gray-700 tabular-nums">
                                    {line.requested_qty ?? line.qty ?? '—'}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700 tabular-nums">
                                    {line.fulfilled_qty ?? '—'}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700 tabular-nums">
                                    {line.received_qty ?? '—'}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-500">{line.uom}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 py-3">No line items</p>
                      )}

                      {/* Mark Sent action for pending orders */}
                      {order.status === 'pending' && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => handleMarkSent(order.id)}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                          >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            Mark Sent
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 py-3">No detail available</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
