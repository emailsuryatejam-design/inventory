import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser, useSelectedCamp } from '../context/AppContext'
import { issue as issueApi } from '../services/api'
import { FileOutput, Plus, ChevronRight } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const ISSUE_TYPES = [
  { key: '', label: 'All Types' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'housekeeping', label: 'Housekeeping' },
  { key: 'bar', label: 'Bar' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'guest', label: 'Guest' },
  { key: 'office', label: 'Office' },
  { key: 'other', label: 'Other' },
]

export default function Issue() {
  const user = useUser()
  const { campId } = useSelectedCamp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    type: '',
    page: 1,
  })

  useEffect(() => {
    loadIssues()
  }, [filters, campId])

  async function loadIssues() {
    setLoading(true)
    setError('')
    try {
      const params = {
        page: filters.page,
        per_page: 20,
        type: filters.type,
      }
      if (campId) params.camp_id = campId
      const result = await issueApi.list(params)
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
          <h1 className="text-xl font-bold text-gray-900">Issue Vouchers</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} vouchers
          </p>
        </div>
        <Link
          to="/app/issue/new"
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
        >
          <Plus size={18} />
          New Issue
        </Link>
      </div>

      {/* Type Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-4 px-4 lg:mx-0 lg:px-0">
        {ISSUE_TYPES.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilters(prev => ({ ...prev, type: tab.key, page: 1 }))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              filters.type === tab.key
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadIssues} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && <LoadingSpinner message="Loading issue vouchers..." />}

      {/* Issues List */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {data.vouchers.length === 0 ? (
            <EmptyState
              icon={FileOutput}
              title="No issue vouchers"
              message={filters.type ? `No ${filters.type} issues found` : 'Create your first issue voucher'}
              action={
                <Link
                  to="/app/issue/new"
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  <Plus size={16} /> New Issue
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
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Voucher #</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Camp</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Type</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cost Center</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Received By</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Value</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vouchers.map(v => (
                      <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono font-medium text-gray-900">
                            {v.voucher_number}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{v.camp_code}</span>
                          <span className="text-xs text-gray-400 ml-1">{v.camp_name}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={v.issue_type}>{v.issue_type}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{v.cost_center || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{v.received_by_name || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-900">{formatValue(v.total_value)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{formatDate(v.issue_date || v.created_at)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight size={16} className="text-gray-400" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {data.vouchers.map(v => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-mono font-medium text-gray-900">{v.voucher_number}</span>
                        <Badge variant={v.issue_type}>{v.issue_type}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{v.camp_name}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{v.received_by_name || '—'}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{formatDate(v.issue_date || v.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatValue(v.total_value)}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                  </div>
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
