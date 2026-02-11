import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser, useSelectedCamp, isManager } from '../context/AppContext'
import { orders as ordersApi } from '../services/api'
import { ShoppingCart, Plus, ChevronRight, Clock } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'pending_review', label: 'Pending' },
  { key: 'queried', label: 'Queried' },
  { key: 'stores_approved', label: 'Approved' },
  { key: 'stores_rejected', label: 'Rejected' },
  { key: 'dispatching', label: 'Dispatching' },
  { key: 'received', label: 'Received' },
]

export default function Orders() {
  const user = useUser()
  const { campId } = useSelectedCamp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    page: 1,
  })

  useEffect(() => {
    loadOrders()
  }, [filters, campId])

  async function loadOrders() {
    setLoading(true)
    setError('')
    try {
      const params = {
        page: filters.page,
        per_page: 20,
        status: filters.status,
        search: filters.search,
      }
      if (campId) params.camp_id = campId
      const result = await ordersApi.list(params)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  function formatValue(v) {
    if (!v) return '—'
    return `TZS ${Math.round(v).toLocaleString()}`
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} orders
          </p>
        </div>
        <Link
          to="/app/orders/new"
          data-guide="new-order-btn"
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
        >
          <Plus size={18} />
          New Order
        </Link>
      </div>

      {/* Status Tabs */}
      <div data-guide="order-status-tabs" className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-none">
        {STATUS_TABS.map(tab => {
          const count = tab.key ? (data?.status_counts?.[tab.key] || 0) : data?.pagination?.total || 0
          return (
            <button
              key={tab.key}
              onClick={() => setFilters(prev => ({ ...prev, status: tab.key, page: 1 }))}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all min-h-0 ${
                filters.status === tab.key
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={{ minHeight: 'auto' }}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] leading-none px-1.5 py-0.5 rounded-full ${
                  filters.status === tab.key ? 'bg-green-700/50 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="mb-4" data-guide="order-search">
        <SearchInput
          value={filters.search}
          onChange={(v) => setFilters(prev => ({ ...prev, search: v, page: 1 }))}
          placeholder="Search by order number or camp..."
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadOrders} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && <LoadingSpinner message="Loading orders..." />}

      {/* Orders List */}
      {data && (
        <div data-guide="orders-list" className="bg-white rounded-xl border border-gray-200">
          {data.orders.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No orders"
              message={filters.status ? `No ${filters.status.replace(/_/g, ' ')} orders` : 'Create your first order'}
              action={
                <Link
                  to="/app/orders/new"
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  <Plus size={16} /> New Order
                </Link>
              }
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Order #</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Camp</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Items</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Value</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Created</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map(order => (
                      <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <Link to={`/app/orders/${order.id}`} className="text-sm font-mono font-medium text-gray-900 hover:text-green-600">
                            {order.order_number}
                          </Link>
                          {order.flagged_items > 0 && (
                            <span className="ml-1 text-xs text-amber-500" title={`${order.flagged_items} flagged`}>⚠</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{order.camp_code}</span>
                          <span className="text-xs text-gray-400 ml-1">{order.camp_name}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={order.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-900">{order.total_items}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-600">{formatValue(order.total_value)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
                          <span className="text-xs text-gray-400 ml-1">by {order.created_by}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/orders/${order.id}`}>
                            <ChevronRight size={16} className="text-gray-400" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {data.orders.map(order => (
                  <Link
                    key={order.id}
                    to={`/app/orders/${order.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-mono font-medium text-gray-900">{order.order_number}</span>
                        <Badge variant={order.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{order.camp_name}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{order.total_items} items</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{formatDate(order.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatValue(order.total_value)}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              <div className="px-4 pb-4">
                <Pagination
                  page={data.pagination.page}
                  totalPages={data.pagination.total_pages}
                  total={data.pagination.total}
                  perPage={data.pagination.per_page}
                  onChange={(p) => setFilters(prev => ({ ...prev, page: p }))}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
