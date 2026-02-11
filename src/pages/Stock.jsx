import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser, useSelectedCamp, isManager } from '../context/AppContext'
import { stock as stockApi } from '../services/api'
import { Boxes, Filter, AlertTriangle, ChevronRight } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

export default function Stock() {
  const user = useUser()
  const { campId } = useSelectedCamp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    camp_id: campId || user?.camp_id || '',
    search: '',
    status: '',
    group: '',
    page: 1,
  })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    setFilters(prev => ({ ...prev, camp_id: campId || user?.camp_id || '', page: 1 }))
  }, [campId])

  useEffect(() => {
    loadStock()
  }, [filters])

  async function loadStock() {
    setLoading(true)
    setError('')
    try {
      const result = await stockApi.list({
        camp_id: filters.camp_id,
        page: filters.page,
        per_page: 25,
        search: filters.search,
        status: filters.status,
        group: filters.group,
      })
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(value) {
    setFilters(prev => ({ ...prev, search: value, page: 1 }))
  }

  const activeFilterCount = [filters.status, filters.group].filter(Boolean).length
  const summary = data?.summary

  const statusColors = {
    out: 'bg-red-600',
    critical: 'bg-red-500',
    low: 'bg-amber-500',
    ok: 'bg-green-500',
    excess: 'bg-blue-500',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Stock Balances</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total?.toLocaleString() || '—'} items tracked
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <SummaryCard
            label="Total Value"
            value={`TZS ${(summary.total_value / 1000000).toFixed(1)}M`}
            color="gray"
          />
          <SummaryCard
            label="OK"
            value={summary.ok_count}
            color="green"
            onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'ok' ? '' : 'ok', page: 1 }))}
            active={filters.status === 'ok'}
          />
          <SummaryCard
            label="Low"
            value={summary.low_count}
            color="amber"
            onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'low' ? '' : 'low', page: 1 }))}
            active={filters.status === 'low'}
          />
          <SummaryCard
            label="Critical"
            value={summary.critical_count}
            color="red"
            onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'critical' ? '' : 'critical', page: 1 }))}
            active={filters.status === 'critical'}
          />
          <SummaryCard
            label="Out"
            value={summary.out_count}
            color="red"
            onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'out' ? '' : 'out', page: 1 }))}
            active={filters.status === 'out'}
          />
          <SummaryCard
            label="Excess"
            value={summary.excess_count}
            color="blue"
            onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'excess' ? '' : 'excess', page: 1 }))}
            active={filters.status === 'excess'}
          />
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <SearchInput
            value={filters.search}
            onChange={handleSearch}
            placeholder="Search stock by item name or code..."
          />
        </div>
        {/* Camp selector for managers */}
        {isManager(user?.role) && (
          <select
            value={filters.camp_id}
            onChange={(e) => setFilters(prev => ({ ...prev, camp_id: e.target.value, page: 1 }))}
            className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          >
            <option value="">All Camps</option>
            {data?.camps?.map(c => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition ${
            activeFilterCount > 0
              ? 'border-green-300 bg-green-50 text-green-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter size={16} />
          <span className="hidden sm:inline">Filters</span>
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">All Status</option>
                <option value="out">Out of Stock</option>
                <option value="critical">Critical</option>
                <option value="low">Low</option>
                <option value="ok">OK</option>
                <option value="excess">Excess</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Item Group</label>
              <select
                value={filters.group}
                onChange={(e) => setFilters(prev => ({ ...prev, group: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">All Groups</option>
                {data?.groups?.map(g => (
                  <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadStock} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && <LoadingSpinner message="Loading stock..." />}

      {/* Stock List */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {data.stock.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No stock records"
              message="Stock balances will appear here once items are received"
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Item</th>
                      {!filters.camp_id && (
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Camp</th>
                      )}
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Qty</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Par</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Value (TZS)</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Days OH</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stock.map(s => (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <Link to={`/app/items/${s.item_id}`} className="text-sm font-medium text-gray-900 hover:text-green-600">
                            {s.item_name}
                          </Link>
                          <p className="text-xs text-gray-400">{s.item_code} · {s.uom}</p>
                        </td>
                        {!filters.camp_id && (
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">{s.camp_code}</span>
                          </td>
                        )}
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-semibold ${
                            s.stock_status === 'out' || s.stock_status === 'critical'
                              ? 'text-red-600'
                              : s.stock_status === 'low'
                                ? 'text-amber-600'
                                : 'text-gray-900'
                          }`}>
                            {s.current_qty.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-400">
                            {s.par_level ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={s.stock_status}>{s.stock_status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-600">
                            {Math.round(s.current_value).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-400">
                            {s.days_stock_on_hand ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/items/${s.item_id}`}>
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
                {data.stock.map(s => (
                  <Link
                    key={s.id}
                    to={`/app/items/${s.item_id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className={`w-2 h-10 rounded-full ${statusColors[s.stock_status] || 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.item_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{s.item_code}</span>
                        {!filters.camp_id && (
                          <>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{s.camp_code}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${
                        s.stock_status === 'out' || s.stock_status === 'critical'
                          ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {s.current_qty.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">{s.uom}</p>
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

function SummaryCard({ label, value, color, onClick, active }) {
  const colors = {
    gray: 'border-gray-200',
    green: 'border-green-200 hover:border-green-400',
    amber: 'border-amber-200 hover:border-amber-400',
    red: 'border-red-200 hover:border-red-400',
    blue: 'border-blue-200 hover:border-blue-400',
  }

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`bg-white rounded-xl border p-3 text-center transition ${
        active ? 'ring-2 ring-green-500 border-green-500' : colors[color] || colors.gray
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </button>
  )
}
