import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser, useSelectedCamp, isManager } from '../context/AppContext'
import { stockAdjustments as adjApi } from '../services/api'
import { loadFilters, saveFilters } from '../services/filterStore'
import { ClipboardEdit, Plus, ChevronRight } from 'lucide-react'
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
  { key: 'rejected', label: 'Rejected' },
]

const TYPE_LABELS = {
  damage: 'Damage',
  expiry: 'Expiry',
  correction: 'Correction',
  write_off: 'Write Off',
  found: 'Found',
  transfer: 'Transfer',
}

const STATUS_VARIANTS = {
  draft: 'out',
  submitted: 'low',
  approved: 'ok',
  rejected: 'critical',
}

export default function StockAdjustments() {
  const user = useUser()
  const { campId } = useSelectedCamp()
  const canCreate = !['chef', 'housekeeping'].includes(user?.role)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(() => loadFilters('stockAdjustments', {
    status: '',
    type: '',
    page: 1,
  }))

  useEffect(() => {
    saveFilters('stockAdjustments', { status: filters.status, type: filters.type })
  }, [filters.status, filters.type])

  useEffect(() => {
    loadAdjustments()
  }, [filters, campId])

  async function loadAdjustments() {
    setLoading(true)
    setError('')
    try {
      const params = {
        page: filters.page,
        per_page: 20,
        status: filters.status,
        type: filters.type,
      }
      if (campId) params.camp_id = campId
      const result = await adjApi.list(params)
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Stock Adjustments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} adjustments
          </p>
        </div>
        {canCreate && (
          <Link
            to="/app/stock-adjustments/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Adjustment</span>
          </Link>
        )}
      </div>

      {/* Status Counts */}
      {data?.status_counts && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { key: 'draft', label: 'Draft', color: 'text-gray-600 bg-gray-50' },
            { key: 'submitted', label: 'Pending', color: 'text-amber-600 bg-amber-50' },
            { key: 'approved', label: 'Approved', color: 'text-green-600 bg-green-50' },
            { key: 'rejected', label: 'Rejected', color: 'text-red-600 bg-red-50' },
          ].map(s => (
            <button key={s.key}
              onClick={() => setFilters(prev => ({ ...prev, status: prev.status === s.key ? '' : s.key, page: 1 }))}
              className={`rounded-lg p-3 text-center transition ${s.color} ${filters.status === s.key ? 'ring-2 ring-green-500' : ''}`}
            >
              <p className="text-lg font-bold">{data.status_counts[s.key] || 0}</p>
              <p className="text-xs font-medium">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none mb-4">
        {STATUS_TABS.map(tab => (
          <button key={tab.key}
            onClick={() => setFilters(prev => ({ ...prev, status: tab.key, page: 1 }))}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition ${
              filters.status === tab.key
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 mb-4">
        <select
          value={filters.type}
          onChange={e => setFilters(prev => ({ ...prev, type: e.target.value, page: 1 }))}
          className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadAdjustments} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && <LoadingSpinner message="Loading adjustments..." />}

      {/* Adjustments List */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {data.adjustments.length === 0 ? (
            <EmptyState
              icon={ClipboardEdit}
              title="No adjustments found"
              message="Create a stock adjustment to correct inventory"
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Number</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Type</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Camp</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Reason</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Value Impact</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.adjustments.map(adj => (
                      <tr key={adj.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <Link to={`/app/stock-adjustments/${adj.id}`}
                            className="text-sm font-mono text-green-600 hover:text-green-700">
                            {adj.adjustment_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">{TYPE_LABELS[adj.adjustment_type] || adj.adjustment_type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{adj.camp_name || adj.camp_code || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 truncate max-w-[200px] block">{adj.reason || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-medium ${adj.total_value_impact < 0 ? 'text-red-600' : adj.total_value_impact > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                            {adj.total_value_impact !== 0 ? `TZS ${Math.round(Math.abs(adj.total_value_impact)).toLocaleString()}` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={STATUS_VARIANTS[adj.status] || 'out'}>{adj.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{formatDate(adj.created_at)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/stock-adjustments/${adj.id}`}>
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
                {data.adjustments.map(adj => (
                  <Link key={adj.id}
                    to={`/app/stock-adjustments/${adj.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-gray-400">{adj.adjustment_number}</span>
                        <Badge variant={STATUS_VARIANTS[adj.status] || 'out'}>{adj.status}</Badge>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {TYPE_LABELS[adj.adjustment_type] || adj.adjustment_type}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{adj.camp_name || '—'}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{formatDate(adj.created_at)}</span>
                        {adj.total_value_impact !== 0 && (
                          <>
                            <span className="text-xs text-gray-300">·</span>
                            <span className={`text-xs font-medium ${adj.total_value_impact < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              TZS {Math.round(Math.abs(adj.total_value_impact)).toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
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
                    onChange={p => setFilters(prev => ({ ...prev, page: p }))}
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
