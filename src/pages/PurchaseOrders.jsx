import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelectedCamp } from '../context/AppContext'
import { purchaseOrders as poApi } from '../services/api'
import { loadFilters, saveFilters } from '../services/filterStore'
import { FileText, Plus, ChevronRight, Building2 } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'sent', label: 'Sent' },
  { key: 'partial_received', label: 'Partial' },
  { key: 'received', label: 'Received' },
  { key: 'cancelled', label: 'Cancelled' },
]

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  sent: 'bg-indigo-100 text-indigo-700',
  partial_received: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

function POBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  )
}

export default function PurchaseOrders() {
  const { campId } = useSelectedCamp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(() => loadFilters('purchase-orders', {
    status: '',
    search: '',
    page: 1,
  }))

  useEffect(() => {
    saveFilters('purchase-orders', filters)
    loadPOs()
  }, [filters, campId])

  async function loadPOs() {
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
      const result = await poApi.list(params)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  function formatCurrency(v) {
    if (!v) return '—'
    return `KES ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} purchase orders
          </p>
        </div>
        <Link
          to="/app/purchase-orders/new"
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
        >
          <Plus size={18} />
          New PO
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-none">
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
      <div className="mb-4">
        <SearchInput
          value={filters.search}
          onChange={(v) => setFilters(prev => ({ ...prev, search: v, page: 1 }))}
          placeholder="Search by PO number or supplier..."
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadPOs} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && <LoadingSpinner message="Loading purchase orders..." />}

      {/* PO List */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {(!data.purchase_orders || data.purchase_orders.length === 0) ? (
            <EmptyState
              icon={FileText}
              title="No purchase orders"
              message={filters.status ? `No ${filters.status.replace(/_/g, ' ')} purchase orders` : 'Create your first purchase order'}
              action={
                <Link
                  to="/app/purchase-orders/new"
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  <Plus size={16} /> New PO
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
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">PO #</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Supplier</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Camp</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Items</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Total</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.purchase_orders.map(po => (
                      <tr key={po.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <Link to={`/app/purchase-orders/${po.id}`} className="text-sm font-mono font-medium text-gray-900 hover:text-green-600">
                            {po.po_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">{po.supplier_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{po.camp_code}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <POBadge status={po.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-900">{po.line_count}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-gray-900">{formatCurrency(po.grand_total)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{formatDate(po.created_at)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/purchase-orders/${po.id}`}>
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
                {data.purchase_orders.map(po => (
                  <Link
                    key={po.id}
                    to={`/app/purchase-orders/${po.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-mono font-medium text-gray-900">{po.po_number}</span>
                        <POBadge status={po.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 truncate">{po.supplier_name}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{po.line_count} items</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{formatDate(po.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(po.grand_total)}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {data.pagination && (
                <div className="px-4 pb-4">
                  <Pagination
                    page={data.pagination.page}
                    totalPages={data.pagination.total_pages}
                    total={data.pagination.total}
                    perPage={data.pagination.per_page}
                    onChange={(p) => setFilters(prev => ({ ...prev, page: p }))}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
