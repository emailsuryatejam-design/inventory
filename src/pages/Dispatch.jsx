import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser, useSelectedCamp, isManager } from '../context/AppContext'
import { dispatch as dispatchApi } from '../services/api'
import { loadFilters, saveFilters } from '../services/filterStore'
import { Truck, ChevronRight } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
]

export default function Dispatch() {
  const user = useUser()
  const { campId } = useSelectedCamp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(() => loadFilters('dispatch', {
    status: '',
    search: '',
    page: 1,
  }))

  useEffect(() => {
    saveFilters('dispatch', { status: filters.status, search: filters.search })
  }, [filters.status, filters.search])

  useEffect(() => {
    loadDispatches()
  }, [filters, campId])

  async function loadDispatches() {
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
      const result = await dispatchApi.list(params)
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
          <h1 className="text-xl font-bold text-gray-900">Dispatch Notes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} dispatches
          </p>
        </div>
      </div>

      {/* Status Tabs */}
      <div data-guide="dispatch-status-tabs" className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-none">
        {STATUS_TABS.map(tab => {
          const count = tab.key ? (data?.status_counts?.[tab.key] || 0) : data?.pagination?.total || 0
          return (
            <button
              key={tab.key}
              onClick={() => setFilters(prev => ({ ...prev, status: tab.key, page: 1 }))}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
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
      <div className="mb-4" data-guide="dispatch-search">
        <SearchInput
          value={filters.search}
          onChange={(v) => setFilters(prev => ({ ...prev, search: v, page: 1 }))}
          placeholder="Search by dispatch or order number..."
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadDispatches} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && <LoadingSpinner message="Loading dispatches..." />}

      {/* Dispatches List */}
      {data && (
        <div data-guide="dispatch-list" className="bg-white rounded-xl border border-gray-200">
          {data.dispatches.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No dispatches"
              message={filters.status ? `No ${filters.status} dispatches` : 'No dispatch notes yet'}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Dispatch #</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Order #</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Camp</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Items</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Value</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dispatches.map(d => (
                      <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <Link to={`/app/dispatch/${d.id}`} className="text-sm font-mono font-medium text-gray-900 hover:text-green-600">
                            {d.dispatch_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/orders/${d.order_id}`} className="text-sm font-mono text-blue-600 hover:text-blue-800">
                            {d.order_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{d.camp_code}</span>
                          <span className="text-xs text-gray-400 ml-1">{d.camp_name}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={d.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-900">{d.total_items}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-600">{formatValue(d.total_value)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{formatDate(d.dispatched_at || d.created_at)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/dispatch/${d.id}`}>
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
                {data.dispatches.map(d => (
                  <Link
                    key={d.id}
                    to={`/app/dispatch/${d.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-mono font-medium text-gray-900">{d.dispatch_number}</span>
                        <Badge variant={d.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{d.camp_name}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{d.total_items} items</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{formatDate(d.dispatched_at || d.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatValue(d.total_value)}</p>
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
