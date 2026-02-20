import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser, useSelectedCamp } from '../context/AppContext'
import { receive as receiveApi } from '../services/api'
import { loadFilters, saveFilters } from '../services/filterStore'
import { PackageCheck, ChevronRight } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
]

export default function Receive() {
  const user = useUser()
  const { campId } = useSelectedCamp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(() => loadFilters('receive', {
    status: '',
    search: '',
    page: 1,
  }))

  useEffect(() => {
    saveFilters('receive', { status: filters.status, search: filters.search })
  }, [filters.status, filters.search])

  useEffect(() => {
    loadReceipts()
  }, [filters, campId])

  async function loadReceipts() {
    setLoading(true)
    setError('')
    try {
      const params = {
        page: filters.page,
        per_page: 20,
        status: filters.status,
      }
      if (campId) params.camp_id = campId
      const result = await receiveApi.list(params)
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Goods Receipt</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} receipts
          </p>
        </div>
      </div>

      {/* Status Tabs */}
      <div data-guide="receive-status-tabs" className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-none">
        {STATUS_TABS.map(tab => (
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
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={filters.search}
          onChange={(v) => setFilters(prev => ({ ...prev, search: v, page: 1 }))}
          placeholder="Search by receipt or dispatch number..."
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadReceipts} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && <LoadingSpinner message="Loading receipts..." />}

      {/* Receipts List */}
      {data && (
        <div data-guide="receive-list" className="bg-white rounded-xl border border-gray-200">
          {data.receipts.length === 0 ? (
            <EmptyState
              icon={PackageCheck}
              title="No receipts"
              message={filters.status ? `No ${filters.status} receipts` : 'No goods receipts yet'}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Receipt #</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Dispatch #</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Camp</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Received By</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.receipts.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <Link to={`/app/receive/${r.id}`} className="text-sm font-mono font-medium text-gray-900 hover:text-green-600">
                            {r.receipt_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-gray-500">{r.dispatch_number || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{r.camp_code}</span>
                          <span className="text-xs text-gray-400 ml-1">{r.camp_name}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={r.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{r.received_by || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{formatDate(r.received_date || r.created_at)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/receive/${r.id}`}>
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
                {data.receipts.map(r => (
                  <Link
                    key={r.id}
                    to={`/app/receive/${r.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-mono font-medium text-gray-900">{r.receipt_number}</span>
                        <Badge variant={r.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{r.camp_name}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{formatDate(r.received_date || r.created_at)}</span>
                        {r.dispatch_number && (
                          <>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-400">Disp: {r.dispatch_number}</span>
                          </>
                        )}
                      </div>
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
