import { useState, useEffect } from 'react'
import { fieldTracking as ftApi, hrEmployees } from '../services/api'
import { Route, Plus, X, Loader2, Check } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const STATUS_VARIANTS = {
  pending: 'pending',
  approved: 'ok',
  rejected: 'out',
}

const TRIP_TYPES = [
  { value: 'field_visit', label: 'Field Visit' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'client_meeting', label: 'Client Meeting' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
]

const TRIP_TYPE_LABELS = Object.fromEntries(TRIP_TYPES.map(t => [t.value, t.label]))

const EMPTY_FORM = {
  employee_id: '',
  date: new Date().toISOString().slice(0, 10),
  trip_type: 'field_visit',
  travel_from: '',
  travel_to: '',
  distance_km: '',
  allowance_amount: '',
  notes: '',
}

export default function FieldTracking() {
  const [records, setRecords] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => { loadEmployees() }, [])
  useEffect(() => { load() }, [page, filterStatus, filterDateFrom, filterDateTo])

  async function loadEmployees() {
    try {
      const result = await hrEmployees.list()
      setEmployees(result.employees || result.data || [])
    } catch (err) {
      console.error('Failed to load employees:', err)
    }
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      const params = { page, per_page: 20 }
      if (filterStatus) params.status = filterStatus
      if (filterDateFrom) params.date_from = filterDateFrom
      if (filterDateTo) params.date_to = filterDateTo
      const result = await ftApi.list(params)
      setRecords(result.records || result.data || [])
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

  function formatDate(dateStr) {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!form.employee_id || !form.date || !form.travel_from || !form.travel_to) {
      setFormError('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      await ftApi.create({
        ...form,
        employee_id: parseInt(form.employee_id, 10),
        distance_km: parseFloat(form.distance_km) || 0,
        allowance_amount: parseFloat(form.allowance_amount) || 0,
      })
      setShowModal(false)
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove(id) {
    try {
      await ftApi.approve(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  // Client-side search within loaded records
  const filtered = records.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (r.employee_name || '').toLowerCase().includes(s) ||
      (r.travel_from || '').toLowerCase().includes(s) ||
      (r.travel_to || '').toLowerCase().includes(s) ||
      (r.trip_type || '').toLowerCase().includes(s)
    )
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Route size={22} className="text-green-600" />
            Field Tracking
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} record{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Entry</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={v => setSearch(v)}
          placeholder="Search..."
        />
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={e => { setFilterDateFrom(e.target.value); setPage(1) }}
          placeholder="From date"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={e => { setFilterDateTo(e.target.value); setPage(1) }}
          placeholder="To date"
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
      {loading && <LoadingSpinner message="Loading field tracking records..." />}

      {/* Table */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Route}
              title="No records found"
              message="Create a field tracking entry to get started"
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Employee</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Trip Type</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">From</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">To</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Distance (km)</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Allowance</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">{r.employee_name || '--'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{formatDate(r.date)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{TRIP_TYPE_LABELS[r.trip_type] || r.trip_type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{r.travel_from || '--'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{r.travel_to || '--'}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-600">{r.distance_km ? Number(r.distance_km).toLocaleString() : '--'}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-600">{r.allowance_amount ? Number(r.allowance_amount).toLocaleString() : '--'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={STATUS_VARIANTS[r.status] || 'out'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {r.status === 'pending' && (
                            <button
                              onClick={() => handleApprove(r.id)}
                              className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium"
                            >
                              <Check size={14} />
                              Approve
                            </button>
                          )}
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
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Route size={18} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900 truncate">{r.employee_name || '--'}</span>
                        <Badge variant={STATUS_VARIANTS[r.status] || 'out'}>
                          {r.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400">
                        {formatDate(r.date)} | {TRIP_TYPE_LABELS[r.trip_type] || r.trip_type}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {r.travel_from} &rarr; {r.travel_to}
                        {r.distance_km ? ` | ${r.distance_km} km` : ''}
                      </p>
                      {r.allowance_amount > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Allowance: {Number(r.allowance_amount).toLocaleString()}
                        </p>
                      )}
                      {r.status === 'pending' && (
                        <button
                          onClick={() => handleApprove(r.id)}
                          className="mt-1.5 flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
                        >
                          <Check size={12} />
                          Approve
                        </button>
                      )}
                    </div>
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

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">New Field Tracking Entry</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                <select
                  value={form.employee_id}
                  onChange={e => setForm(prev => ({ ...prev, employee_id: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_no})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trip Type *</label>
                  <select
                    value={form.trip_type}
                    onChange={e => setForm(prev => ({ ...prev, trip_type: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
                    {TRIP_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Travel From *</label>
                  <input
                    type="text"
                    value={form.travel_from}
                    onChange={e => setForm(prev => ({ ...prev, travel_from: e.target.value }))}
                    placeholder="e.g. Office"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Travel To *</label>
                  <input
                    type="text"
                    value={form.travel_to}
                    onChange={e => setForm(prev => ({ ...prev, travel_to: e.target.value }))}
                    placeholder="e.g. Client site"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Distance (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.distance_km}
                    onChange={e => setForm(prev => ({ ...prev, distance_km: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allowance Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.allowance_amount}
                    onChange={e => setForm(prev => ({ ...prev, allowance_amount: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-lg transition"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  Create Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
