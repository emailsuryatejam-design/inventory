import { useState, useEffect } from 'react'
import { contracts as contractsApi, hrEmployees } from '../services/api'
import { FileSignature, Plus, X, Loader2 } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const STATUS_VARIANTS = {
  active: 'ok',
  expired: 'out',
  terminated: 'out',
  pending: 'pending',
}

const CONTRACT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'fixed_term', label: 'Fixed Term' },
  { value: 'casual', label: 'Casual' },
  { value: 'probation', label: 'Probation' },
]

const CONTRACT_TYPE_LABELS = Object.fromEntries(CONTRACT_TYPES.map(t => [t.value, t.label]))

const EMPTY_FORM = {
  employee_id: '',
  contract_type: 'permanent',
  start_date: '',
  end_date: '',
  salary: '',
}

export default function Contracts() {
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

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => { loadEmployees() }, [])
  useEffect(() => { load() }, [page, filterStatus])

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
      const result = await contractsApi.list(params)
      setRecords(result.contracts || result.data || [])
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

  function formatCurrency(val) {
    if (!val) return '--'
    return Number(val).toLocaleString()
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({
      employee_id: item.employee_id || '',
      contract_type: item.contract_type || 'permanent',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      salary: item.salary || '',
      status: item.status || 'active',
    })
    setFormError('')
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!form.employee_id || !form.contract_type || !form.start_date || !form.salary) {
      setFormError('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        ...form,
        employee_id: parseInt(form.employee_id, 10),
        salary: parseFloat(form.salary) || 0,
      }
      if (editing) {
        await contractsApi.update(editing.id, payload)
      } else {
        await contractsApi.create(payload)
      }
      setShowModal(false)
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Client-side search within loaded records
  const filtered = records.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (r.employee_name || '').toLowerCase().includes(s) ||
      (r.contract_type || '').toLowerCase().includes(s) ||
      (r.status || '').toLowerCase().includes(s)
    )
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileSignature size={22} className="text-green-600" />
            Contracts
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} contract{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Contract</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={v => setSearch(v)}
          placeholder="Search contracts..."
        />
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={load} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingSpinner message="Loading contracts..." />}

      {/* Table */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200">
          {filtered.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="No contracts found"
              message="Create a contract to get started"
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Employee</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Type</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Start Date</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">End Date</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Salary</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">{r.employee_name || '--'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{CONTRACT_TYPE_LABELS[r.contract_type] || r.contract_type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{formatDate(r.start_date)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{formatDate(r.end_date)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-600">{formatCurrency(r.salary)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={STATUS_VARIANTS[r.status] || 'out'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openEdit(r)}
                            className="text-sm text-green-600 hover:text-green-700 font-medium"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {filtered.map(r => (
                  <button
                    key={r.id}
                    onClick={() => openEdit(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
                  >
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileSignature size={18} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900 truncate">{r.employee_name || '--'}</span>
                        <Badge variant={STATUS_VARIANTS[r.status] || 'out'}>
                          {r.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400">
                        {CONTRACT_TYPE_LABELS[r.contract_type] || r.contract_type}
                        {' | '}
                        {formatDate(r.start_date)} - {formatDate(r.end_date)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Salary: {formatCurrency(r.salary)}
                      </p>
                    </div>
                  </button>
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Edit Contract' : 'New Contract'}
              </h2>
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
                  disabled={!!editing}
                >
                  <option value="">Select employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_no})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contract Type *</label>
                <select
                  value={form.contract_type}
                  onChange={e => setForm(prev => ({ ...prev, contract_type: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                >
                  {CONTRACT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salary *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.salary}
                  onChange={e => setForm(prev => ({ ...prev, salary: e.target.value }))}
                  placeholder="e.g. 500000"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              {editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="expired">Expired</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>
              )}

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
                  {editing ? 'Update Contract' : 'Create Contract'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
