import { useState, useEffect } from 'react'
import { hrLoans, hrEmployees } from '../services/api'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { Landmark, Plus, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

const STATUS_VARIANTS = {
  pending: 'pending',
  approved: 'ok',
  active: 'ok',
  completed: 'low',
  rejected: 'out',
}

const LOAN_TYPES = [
  { value: 'personal', label: 'Personal' },
  { value: 'salary_advance', label: 'Salary Advance' },
  { value: 'education', label: 'Education' },
  { value: 'housing', label: 'Housing' },
  { value: 'emergency', label: 'Emergency' },
]

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Rejected' },
]

export default function HRLoans() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [repayments, setRepayments] = useState(null)
  const [loadingRepayments, setLoadingRepayments] = useState(false)

  // Form state
  const [employees, setEmployees] = useState([])
  const [form, setForm] = useState({
    employee_id: '', loan_type: 'personal', loan_source: 'internal',
    institution_name: '', principal_amount: '', interest_rate: '0',
    repayment_months: '', monthly_deduction: '',
  })

  useEffect(() => {
    loadLoans()
  }, [statusFilter, page])

  async function loadLoans() {
    setLoading(true)
    setError('')
    try {
      const params = { page, per_page: 20 }
      if (statusFilter) params.status = statusFilter
      const result = await hrLoans.list(params)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleExpand(loanId) {
    if (expandedId === loanId) {
      setExpandedId(null)
      setRepayments(null)
      return
    }
    setExpandedId(loanId)
    setLoadingRepayments(true)
    try {
      const result = await hrLoans.repayments(loanId)
      setRepayments(result.repayments || [])
    } catch (err) {
      setRepayments([])
    } finally {
      setLoadingRepayments(false)
    }
  }

  async function openCreateModal() {
    try {
      const empRes = await hrEmployees.list({ status: 'active' })
      setEmployees(empRes.employees || [])
      setForm({
        employee_id: '', loan_type: 'personal', loan_source: 'internal',
        institution_name: '', principal_amount: '', interest_rate: '0',
        repayment_months: '', monthly_deduction: '',
      })
      setShowModal(true)
    } catch (err) {
      setError(err.message)
    }
  }

  // Auto-calculate monthly deduction
  function updateForm(updates) {
    setForm(prev => {
      const next = { ...prev, ...updates }
      const principal = parseFloat(next.principal_amount) || 0
      const months = parseInt(next.repayment_months) || 0
      if (principal > 0 && months > 0 && !updates.monthly_deduction) {
        next.monthly_deduction = (principal / months).toFixed(2)
      }
      return next
    })
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await hrLoans.create({
        employee_id: Number(form.employee_id),
        loan_type: form.loan_type,
        loan_source: form.loan_source,
        institution_name: form.institution_name || null,
        principal_amount: Number(form.principal_amount),
        interest_rate: Number(form.interest_rate) || 0,
        repayment_months: Number(form.repayment_months),
        monthly_deduction: Number(form.monthly_deduction) || undefined,
      })
      setShowModal(false)
      loadLoans()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove(id) {
    try {
      await hrLoans.approve(id)
      loadLoans()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleReject(id) {
    try {
      await hrLoans.reject(id)
      loadLoans()
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
          <h1 className="text-xl font-bold text-gray-900">Loans</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.pagination?.total || 0} loans</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Loan</span>
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
          <button onClick={loadLoans} className="ml-2 underline">Retry</button>
        </div>
      )}

      {loading && !data && <LoadingSpinner message="Loading loans..." />}

      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {data.loans.length === 0 ? (
            <EmptyState icon={Landmark} title="No loans found" message="Create a new loan to get started" />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Employee</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Loan Type</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Principal</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Monthly</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Outstanding</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.loans.map(loan => (
                      <>
                        <tr
                          key={loan.id}
                          onClick={() => toggleExpand(loan.id)}
                          className="border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{loan.employee_name}</p>
                            <p className="text-xs text-gray-400">{loan.employee_no}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-700 capitalize">{loan.loan_type?.replace('_', ' ')}</p>
                            <p className="text-xs text-gray-400 capitalize">{loan.loan_source}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                            {Number(loan.principal_amount).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">
                            {Number(loan.monthly_deduction).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                            {Number(loan.outstanding_balance).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={STATUS_VARIANTS[loan.status] || 'out'}>{loan.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {loan.status === 'pending' && (
                                <>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleApprove(loan.id) }}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                                    title="Approve"
                                  >
                                    <Check size={16} />
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleReject(loan.id) }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                    title="Reject"
                                  >
                                    <X size={16} />
                                  </button>
                                </>
                              )}
                              {expandedId === loan.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                            </div>
                          </td>
                        </tr>
                        {expandedId === loan.id && (
                          <tr key={`${loan.id}-repayments`}>
                            <td colSpan={7} className="px-4 py-3 bg-gray-50">
                              <p className="text-sm font-medium text-gray-700 mb-2">Repayment Schedule</p>
                              {loadingRepayments ? (
                                <p className="text-xs text-gray-400">Loading...</p>
                              ) : repayments && repayments.length > 0 ? (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="text-left py-1 px-2 font-medium text-gray-500">Due Date</th>
                                      <th className="text-right py-1 px-2 font-medium text-gray-500">Amount</th>
                                      <th className="text-center py-1 px-2 font-medium text-gray-500">Status</th>
                                      <th className="text-left py-1 px-2 font-medium text-gray-500">Paid Date</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {repayments.map(r => (
                                      <tr key={r.id} className="border-b border-gray-100">
                                        <td className="py-1 px-2 text-gray-600">{formatDate(r.due_date)}</td>
                                        <td className="py-1 px-2 text-right text-gray-700">{Number(r.amount).toLocaleString()}</td>
                                        <td className="py-1 px-2 text-center">
                                          <Badge variant={r.status === 'paid' ? 'ok' : 'pending'}>{r.status}</Badge>
                                        </td>
                                        <td className="py-1 px-2 text-gray-500">{r.paid_date ? formatDate(r.paid_date) : '--'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-xs text-gray-400">No repayment schedule found</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {data.loans.map(loan => (
                  <div key={loan.id}>
                    <div
                      onClick={() => toggleExpand(loan.id)}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">{loan.employee_name}</p>
                        <Badge variant={STATUS_VARIANTS[loan.status] || 'out'}>{loan.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 capitalize mb-1">{loan.loan_type?.replace('_', ' ')} -- {loan.loan_source}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>Principal: {Number(loan.principal_amount).toLocaleString()}</span>
                        <span>Monthly: {Number(loan.monthly_deduction).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Outstanding: {Number(loan.outstanding_balance).toLocaleString()}</p>
                      {loan.status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={e => { e.stopPropagation(); handleApprove(loan.id) }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleReject(loan.id) }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                          >
                            <X size={12} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                    {expandedId === loan.id && (
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                        <p className="text-sm font-medium text-gray-700 mb-2">Repayment Schedule</p>
                        {loadingRepayments ? (
                          <p className="text-xs text-gray-400">Loading...</p>
                        ) : repayments && repayments.length > 0 ? (
                          <div className="space-y-2">
                            {repayments.map(r => (
                              <div key={r.id} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">{formatDate(r.due_date)}</span>
                                <span className="text-gray-700 font-medium">{Number(r.amount).toLocaleString()}</span>
                                <Badge variant={r.status === 'paid' ? 'ok' : 'pending'}>{r.status}</Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">No repayment schedule found</p>
                        )}
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
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">New Loan</h2>
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
                  onChange={e => updateForm({ employee_id: e.target.value })}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan Type</label>
                  <select
                    required
                    value={form.loan_type}
                    onChange={e => updateForm({ loan_type: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
                    {LOAN_TYPES.map(lt => (
                      <option key={lt.value} value={lt.value}>{lt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <select
                    value={form.loan_source}
                    onChange={e => updateForm({ loan_source: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
                    <option value="internal">Internal</option>
                    <option value="external">External</option>
                  </select>
                </div>
              </div>
              {form.loan_source === 'external' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Institution Name</label>
                  <input
                    type="text"
                    value={form.institution_name}
                    onChange={e => updateForm({ institution_name: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="Bank or institution name"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Principal Amount</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={form.principal_amount}
                    onChange={e => updateForm({ principal_amount: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.interest_rate}
                    onChange={e => updateForm({ interest_rate: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Months</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={form.repayment_months}
                    onChange={e => updateForm({ repayment_months: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Deduction</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.monthly_deduction}
                    onChange={e => updateForm({ monthly_deduction: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50"
                    placeholder="Auto-calculated"
                  />
                </div>
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
                  {submitting ? 'Creating...' : 'Create Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
