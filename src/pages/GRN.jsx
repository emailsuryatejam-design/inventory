import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelectedCamp } from '../context/AppContext'
import { grn as grnApi } from '../services/api'
import { loadFilters, saveFilters } from '../services/filterStore'
import { PackageCheck, Plus, ChevronRight, Truck } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'confirmed', label: 'Confirmed' },
]

const STATUS_COLORS = {
  draft: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
}

function GRNBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default function GRN() {
  const { campId } = useSelectedCamp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(() => loadFilters('grn', {
    status: '',
    search: '',
    page: 1,
  }))

  useEffect(() => {
    saveFilters('grn', filters)
    loadGRNs()
  }, [filters, campId])

  async function loadGRNs() {
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
      const result = await grnApi.list(params)
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
          <h1 className="text-xl font-bold text-gray-900">Goods Received</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} GRNs
          </p>
        </div>
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
          placeholder="Search by GRN number, PO, or supplier..."
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadGRNs} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && <LoadingSpinner message="Loading GRNs..." />}

      {/* GRN List */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {(!data.grns || data.grns.length === 0) ? (
            <EmptyState
              icon={PackageCheck}
              title="No goods received notes"
              message={filters.status ? `No ${filters.status} GRNs` : 'Create a GRN from a Purchase Order'}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">GRN #</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">PO</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Supplier</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Value</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Received</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.grns.map(g => (
                      <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <Link to={`/app/grn/${g.id}`} className="text-sm font-mono font-medium text-gray-900 hover:text-green-600">
                            {g.grn_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/purchase-orders/${g.po_id}`} className="text-sm font-mono text-blue-600 hover:text-blue-700">
                            {g.po_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">{g.supplier_name}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <GRNBadge status={g.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-gray-900">{formatCurrency(g.total_value)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{formatDate(g.received_date)}</span>
                          <span className="text-xs text-gray-400 ml-1">by {g.received_by_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/grn/${g.id}`}>
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
                {data.grns.map(g => (
                  <Link
                    key={g.id}
                    to={`/app/grn/${g.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Truck size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-mono font-medium text-gray-900">{g.grn_number}</span>
                        <GRNBadge status={g.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-blue-600">{g.po_number}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500 truncate">{g.supplier_name}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{formatDate(g.received_date)}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(g.total_value)}</p>
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
