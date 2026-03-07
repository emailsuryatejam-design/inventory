import { useState, useEffect } from 'react'
import { payrollAudit } from '../services/api'
import { ScrollText } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const ENTITY_TYPE_LABELS = {
  payroll_run: 'Payroll Run',
  employee: 'Employee',
  leave_request: 'Leave Request',
  loan: 'Loan',
  salary_advance: 'Advance',
  expense_claim: 'Expense',
  contract: 'Contract',
  attendance: 'Attendance',
  department: 'Department',
}

const ENTITY_VARIANTS = {
  payroll_run: 'ok',
  employee: 'pending',
  leave_request: 'low',
  loan: 'out',
}

export default function PayrollAuditLog() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [filterEntityType, setFilterEntityType] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  useEffect(() => { load() }, [page, filterEntityType, filterDateFrom, filterDateTo])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const params = { page, per_page: 20 }
      if (filterEntityType) params.entity_type = filterEntityType
      if (filterDateFrom) params.date_from = filterDateFrom
      if (filterDateTo) params.date_to = filterDateTo
      const result = await payrollAudit.list(params)
      setRecords(result.logs || result.data || [])
      if (result.pagination) {
        setTotalPages(result.pagination.total_pages || 1)
        setTotal(result.pagination.total || 0)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function formatTimestamp(ts) {
    if (!ts) return '--'
    const d = new Date(ts)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  // Client-side search within loaded records
  const filtered = records.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (r.user_name || '').toLowerCase().includes(s) ||
      (r.action || '').toLowerCase().includes(s) ||
      (r.entity_type || '').toLowerCase().includes(s) ||
      (r.details || '').toLowerCase().includes(s)
    )
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ScrollText size={22} className="text-green-600" />
          Audit Log
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {total} log entr{total !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={v => setSearch(v)}
          placeholder="Search logs..."
        />
        <select
          value={filterEntityType}
          onChange={e => { setFilterEntityType(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        >
          <option value="">All Entity Types</option>
          {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={e => { setFilterDateFrom(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={e => { setFilterDateTo(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={load} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingSpinner message="Loading audit log..." />}

      {/* Table */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200">
          {filtered.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No audit records found"
              message="Audit logs will appear here as actions are performed"
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Timestamp</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">User</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Action</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Entity Type</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Entity ID</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600 whitespace-nowrap">{formatTimestamp(r.created_at)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">{r.user_name || '--'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">{r.action || '--'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={ENTITY_VARIANTS[r.entity_type] || 'pending'}>
                            {ENTITY_TYPE_LABELS[r.entity_type] || r.entity_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-gray-500">{r.entity_id || '--'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 truncate block max-w-xs" title={r.details}>
                            {r.details || '--'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {filtered.map(r => (
                  <div
                    key={r.id}
                    className="px-4 py-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{r.user_name || '--'}</span>
                      <Badge variant={ENTITY_VARIANTS[r.entity_type] || 'pending'}>
                        {ENTITY_TYPE_LABELS[r.entity_type] || r.entity_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-0.5">
                      {r.action} {r.entity_id ? `#${r.entity_id}` : ''}
                    </p>
                    {r.details && (
                      <p className="text-xs text-gray-400 truncate">{r.details}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatTimestamp(r.created_at)}</p>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 pb-4">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    total={total}
                    perPage={20}
                    onChange={setPage}
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
