import { useState, useEffect } from 'react'
import { salaryAdvances, hrEmployees } from '../services/api'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { Banknote, Plus, Check, X } from 'lucide-react'

const STATUS_VARIANTS = {
  pending: 'pending',
  approved: 'ok',
  rejected: 'out',
  deducted: 'low',
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'deducted', label: 'Deducted' },
]

export default function SalaryAdvances() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [employees, setEmployees] = useState([])
  const [form, setForm] = useState({ employee_id: '', amount: '', reason: '' })

  useEffect(() => {
    loadAdvances()
  }, [statusFilter, page])

  async function loadAdvances() {
    setLoading(true)
    setError('')
    try {
      const params = { page, per_page: 20 }
      if (statusFilter) params.status = statusFilter
      const result = await salaryAdvances.list(params)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function openCreateModal() {
    try {
      const empRes = await hrEmployees.list({ status: 'active' })
      setEmployees(empRes.employees || [])
      setForm({ employee_id: '', amount: '', reason: '' })
      setShowModal(true)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await salaryAdvances.create({
        employee_id: Number(form.employee_id),
        amount: Number(form.amount),
        reason: form.reason,
      })
      setShowModal(false)
      loadAdvances()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove(id) {
    try {
      await salaryAdvances.approve(id)
      loadAdvances()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleReject(id) {
    try {
      await salaryAdvances.reject(id)
      loadAdvances()
    } catch (err) {
      setError(err.message)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Salary Advances</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.pagination?.total || 0} advances</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Advance</span>
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
          <button onClick={loadAdvances} className="ml-2 underline">Retry</button>
        </div>
      )}

      {loading && !data && <LoadingSpinner message="Loading salary advances..." />}

      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {data.advances.length === 0 ? (
            <EmptyState icon={Banknote} title="No salary advances" message="Create a new advance to get started" />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Employee</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Amount</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Reason</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.advances.map(adv => (
                      <tr key={adv.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{adv.employee_name}</p>
                          <p className="text-xs text-gray-400">{adv.employee_no}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                          {Number(adv.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(adv.advance_date || adv.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 truncate max-w-[200px] block">{adv.reason || '--'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={STATUS_VARIANTS[adv.status] || 'out'}>{adv.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {adv.status === 'pending' && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleApprove(adv.id)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                                title="Approve"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => handleReject(adv.id)}
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
                {data.advances.map(adv => (
                  <div key={adv.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">{adv.employee_name}</p>
                      <Badge variant={STATUS_VARIANTS[adv.status] || 'out'}>{adv.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mb-1">
                      <span className="font-medium text-gray-700">{Number(adv.amount).toLocaleString()}</span>
                      <span>{formatDate(adv.advance_date || adv.created_at)}</span>
                    </div>
                    {adv.reason && <p className="text-xs text-gray-400 truncate">{adv.reason}</p>}
                    {adv.status === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleApprove(adv.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(adv.id)}
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
              <h2 className="text-lg font-semibold text-gray-900">New Salary Advance</h2>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                  placeholder="Reason for advance..."
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
                  {submitting ? 'Creating...' : 'Create Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
