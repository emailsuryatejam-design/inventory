import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { payrollRuns as runApi } from '../services/api'
import { Banknote, Plus, ChevronRight } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const STATUS_VARIANTS = {
  draft: 'pending',
  review: 'low',
  approved: 'ok',
  paid: 'ok',
  cancelled: 'out',
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'review', label: 'Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default function PayrollRuns() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    loadRuns()
  }, [statusFilter, page])

  async function loadRuns() {
    setLoading(true)
    setError('')
    try {
      const params = { page, per_page: 20 }
      if (statusFilter) params.status = statusFilter
      const result = await runApi.list(params)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(value) {
    if (value == null) return '--'
    return `KES ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const runs = data?.runs || data?.data || []

  // Client-side search filter
  const filtered = runs.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (r.period_name || '').toLowerCase().includes(s) ||
      (r.status || '').toLowerCase().includes(s)
    )
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Banknote size={22} className="text-green-600" />
            Payroll Runs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} run{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          to="/app/payroll-runs/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Run Payroll</span>
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none mb-4">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(1) }}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition ${
              statusFilter === tab.key
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search payroll runs..."
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadRuns} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && <LoadingSpinner message="Loading payroll runs..." />}

      {/* Runs List */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="No payroll runs found"
              message="Run payroll to process employee salaries"
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Period</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Employees</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Gross Pay</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Net Pay</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Created</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(run => (
                      <tr key={run.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <Link
                            to={`/app/payroll-runs/${run.id}`}
                            className="text-sm font-medium text-green-600 hover:text-green-700"
                          >
                            {run.period_name || `Period #${run.period_id}`}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={STATUS_VARIANTS[run.status] || 'out'}>
                            {run.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-700">{run.employee_count || 0}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(run.total_gross)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-green-700">
                            {formatCurrency(run.total_net)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{formatDate(run.created_at)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/payroll-runs/${run.id}`}>
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
                {filtered.map(run => (
                  <Link
                    key={run.id}
                    to={`/app/payroll-runs/${run.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Banknote size={18} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {run.period_name || `Period #${run.period_id}`}
                        </span>
                        <Badge variant={STATUS_VARIANTS[run.status] || 'out'}>
                          {run.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{run.employee_count || 0} employees</span>
                        <span>--</span>
                        <span>Net: {formatCurrency(run.total_net)}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(run.created_at)}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {data.pagination && data.pagination.total_pages > 1 && (
                <div className="px-4 pb-4">
                  <Pagination
                    page={data.pagination.page}
                    totalPages={data.pagination.total_pages}
                    total={data.pagination.total}
                    perPage={data.pagination.per_page}
                    onChange={p => setPage(p)}
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
