import { useState, useEffect } from 'react'
import { expenseClaims, hrEmployees } from '../services/api'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { Receipt, Plus, Check, X } from 'lucide-react'

const STATUS_VARIANTS = {
  pending: 'pending',
  approved: 'ok',
  rejected: 'out',
  paid: 'low',
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'paid', label: 'Paid' },
]

const CATEGORIES = [
  { value: 'transport', label: 'Transport' },
  { value: 'meals', label: 'Meals' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'other', label: 'Other' },
]

export default function ExpenseClaims() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [employees, setEmployees] = useState([])
  const [form, setForm] = useState({
    employee_id: '', title: '', amount: '', category: 'transport', description: '',
  })

  useEffect(() => {
    loadClaims()
  }, [statusFilter, page])

  async function loadClaims() {
    setLoading(true)
    setError('')
    try {
      const params = { page, per_page: 20 }
      if (statusFilter) params.status = statusFilter
      const result = await expenseClaims.list(params)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function openCreateModal() {
    try {
      const empRes = await hrEmployees.list({ employment_status: 'active' })
      setEmployees(empRes.employees || [])
      setForm({ employee_id: '', title: '', amount: '', category: 'transport', description: '' })
      setShowModal(true)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await expenseClaims.create({
        employee_id: Number(form.employee_id),
        title: form.title,
        amount: Number(form.amount),
        category: form.category,
        description: form.description,
      })
      setShowModal(false)
      loadClaims()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove(id) {
    try {
      await expenseClaims.approve(id)
      loadClaims()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleReject(id) {
    try {
      await expenseClaims.reject(id)
      loadClaims()
    } catch (err) {
      setError(err.message)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function categoryLabel(cat) {
    const found = CATEGORIES.find(c => c.value === cat)
    return found ? found.label : cat
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Expense Claims</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.pagination?.total || 0} claims</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Claim</span>
        </button>
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
            {data?.status_counts && tab.key && (
              <span className="ml-1.5 text-xs text-gray-400">({data.status_counts[tab.key] || 0})</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadClaims} className="ml-2 underline">Retry</button>
        </div>
      )}

      {loading && !data && <LoadingSpinner message="Loading expense claims..." />}

      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {data.claims.length === 0 ? (
            <EmptyState icon={Receipt} title="No expense claims" message="Create a new claim to get started" />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Employee</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Title</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Amount</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Category</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.claims.map(claim => (
                      <tr key={claim.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{claim.employee_name}</p>
                          <p className="text-xs text-gray-400">{claim.employee_no}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700 truncate max-w-[200px]">{claim.title}</p>
                          {claim.description && (
                            <p className="text-xs text-gray-400 truncate max-w-[200px]">{claim.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                          {Number(claim.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 capitalize">{categoryLabel(claim.category)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={STATUS_VARIANTS[claim.status] || 'out'}>{claim.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(claim.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          {claim.status === 'pending' && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleApprove(claim.id)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                                title="Approve"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => handleReject(claim.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                title="Reject"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {data.claims.map(claim => (
                  <div key={claim.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">{claim.employee_name}</p>
                      <Badge variant={STATUS_VARIANTS[claim.status] || 'out'}>{claim.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">{claim.title}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="font-medium text-gray-700">{Number(claim.amount).toLocaleString()}</span>
                      <span className="capitalize">{categoryLabel(claim.category)}</span>
                      <span>{formatDate(claim.created_at)}</span>
                    </div>
                    {claim.description && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{claim.description}</p>
                    )}
                    {claim.status === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleApprove(claim.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(claim.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                        >
                          <X size={12} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {data.pagination && (
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

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">New Expense Claim</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select
                  required
                  value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  placeholder="Expense title"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    required
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                  placeholder="Description of the expense..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
