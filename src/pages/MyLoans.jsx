import { useState, useEffect } from 'react'
import { useUser } from '../context/AppContext'
import { selfService as selfServiceApi } from '../services/api'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import {
  Landmark, Plus, ChevronDown, ChevronUp, AlertTriangle,
  X, Loader2, CheckCircle2, Banknote, Calculator
} from 'lucide-react'

const STATUS_VARIANTS = {
  pending: 'pending',
  approved: 'ok',
  active: 'info',
  rejected: 'out',
  paid: 'success',
  defaulted: 'danger',
}

const LOAN_TYPES = [
  { value: 'personal', label: 'Personal' },
  { value: 'salary_advance', label: 'Salary Advance' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'education', label: 'Education' },
  { value: 'housing', label: 'Housing' },
]

function formatDate(dateStr) {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function MyLoans() {
  const user = useUser()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Expanded loan repayment
  const [expandedId, setExpandedId] = useState(null)

  // Request modal
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    loan_type: '',
    amount: '',
    repayment_months: '',
    reason: '',
  })

  useEffect(() => {
    loadLoans()
  }, [])

  async function loadLoans() {
    setLoading(true)
    setError('')
    try {
      const result = await selfServiceApi.myLoans()
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openRequestModal() {
    setForm({ loan_type: '', amount: '', repayment_months: '', reason: '' })
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await selfServiceApi.requestLoan({
        loan_type: form.loan_type,
        amount: Number(form.amount),
        repayment_months: Number(form.repayment_months),
        reason: form.reason,
      })
      setShowModal(false)
      loadLoans()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function toggleExpand(id) {
    setExpandedId(prev => (prev === id ? null : id))
  }

  // Calculate monthly deduction
  const monthlyDeduction = form.amount && form.repayment_months
    ? (Number(form.amount) / Number(form.repayment_months))
    : 0

  // Normalize loans
  const loans = data?.loans || (Array.isArray(data) ? data : [])
  const activeLoans = loans.filter(l => l.status === 'active' || l.status === 'approved')
  const allLoans = loans

  return (
    <div className="pb-8" data-guide="my-loans-header">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Landmark size={22} className="text-blue-600" />
            My Loans
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">View your loans and request new ones</p>
        </div>
        <button
          onClick={openRequestModal}
          data-guide="my-loans-request-btn"
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Request Loan</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError('')}>
            <X size={16} className="text-red-400" />
          </button>
        </div>
      )}

      {loading && !data && <LoadingSpinner message="Loading loans..." />}

      {!loading && data && (
        <>
          {/* Active Loans Overview */}
          {activeLoans.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Active Loans</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeLoans.map(loan => {
                  const total = Number(loan.amount || loan.total_amount || 0)
                  const paid = Number(loan.paid || loan.amount_paid || 0)
                  const outstanding = Number(loan.outstanding || loan.balance || (total - paid))
                  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0

                  return (
                    <div
                      key={loan.id}
                      className="bg-white rounded-xl border border-gray-100 overflow-hidden"
                      style={{ boxShadow: 'var(--shadow-xs)' }}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {(loan.loan_type || loan.type || '').replace(/_/g, ' ')}
                          </span>
                          <Badge variant={STATUS_VARIANTS[loan.status] || 'default'}>{loan.status}</Badge>
                        </div>

                        <p className="text-xl font-bold text-gray-900 tabular-nums mb-3">
                          {formatCurrency(total)}
                        </p>

                        {/* Progress */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>Paid: {formatCurrency(paid)}</span>
                            <span>Outstanding: {formatCurrency(outstanding)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-green-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{Math.round(pct)}% repaid</p>
                        </div>

                        {loan.monthly_deduction && (
                          <p className="text-xs text-gray-500">
                            Monthly deduction: <span className="font-medium text-gray-700">{formatCurrency(loan.monthly_deduction)}</span>
                          </p>
                        )}

                        {/* Expand toggle */}
                        <button
                          onClick={() => toggleExpand(loan.id)}
                          className="flex items-center gap-1 mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium transition"
                        >
                          {expandedId === loan.id ? (
                            <>
                              <ChevronUp size={14} /> Hide repayments
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} /> View repayments
                            </>
                          )}
                        </button>
                      </div>

                      {/* Expanded Repayment History */}
                      {expandedId === loan.id && (
                        <div className="border-t border-gray-100 bg-gray-50/50">
                          {loan.repayments && loan.repayments.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-gray-500 uppercase tracking-wider">
                                    <th className="px-4 py-2 font-semibold">Date</th>
                                    <th className="px-4 py-2 font-semibold text-right">Amount</th>
                                    <th className="px-4 py-2 font-semibold">Method</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {loan.repayments.map((rep, idx) => (
                                    <tr key={rep.id || idx}>
                                      <td className="px-4 py-2 text-gray-700">{formatDate(rep.date || rep.deduction_date)}</td>
                                      <td className="px-4 py-2 text-right text-gray-900 font-medium tabular-nums">
                                        {formatCurrency(rep.amount)}
                                      </td>
                                      <td className="px-4 py-2 text-gray-500 capitalize">{rep.method || rep.type || 'Payroll'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="px-4 py-4 text-xs text-gray-400 text-center">No repayment records yet</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* All Loans Table */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">All Loan Requests</h2>
            </div>

            {allLoans.length === 0 ? (
              <EmptyState
                icon={Banknote}
                title="No loans"
                message="You have no loan records. Click the button above to request one."
              />
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Loan Type</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Amount</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Months</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Monthly Deduction</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allLoans.map(loan => (
                        <tr key={loan.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-gray-900 capitalize">
                              {(loan.loan_type || loan.type || '').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 tabular-nums">
                            {formatCurrency(loan.amount || loan.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-500">
                            {loan.repayment_months || loan.tenure || '--'}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-500 tabular-nums">
                            {loan.monthly_deduction ? formatCurrency(loan.monthly_deduction) : '--'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {formatDate(loan.created_at || loan.request_date)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={STATUS_VARIANTS[loan.status] || 'default'}>{loan.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden divide-y divide-gray-100">
                  {allLoans.map(loan => (
                    <div key={loan.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {(loan.loan_type || loan.type || '').replace(/_/g, ' ')}
                        </span>
                        <Badge variant={STATUS_VARIANTS[loan.status] || 'default'}>{loan.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mb-1">
                        <span className="font-medium text-gray-700">{formatCurrency(loan.amount || loan.total_amount)}</span>
                        <span>{loan.repayment_months || loan.tenure || '--'} months</span>
                        <span>{formatDate(loan.created_at || loan.request_date)}</span>
                      </div>
                      {loan.reason && <p className="text-xs text-gray-400 truncate">{loan.reason}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Request Loan Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Request Loan"
        maxWidth="480px"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Type</label>
            <select
              required
              value={form.loan_type}
              onChange={e => setForm(f => ({ ...f, loan_type: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            >
              <option value="">Select loan type</option>
              {LOAN_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Period (months)</label>
            <input
              type="number"
              required
              min="1"
              max="60"
              value={form.repayment_months}
              onChange={e => setForm(f => ({ ...f, repayment_months: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              placeholder="e.g. 12"
            />
          </div>

          {monthlyDeduction > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <Calculator size={14} className="text-blue-500" />
              <span className="text-sm text-blue-700">
                Estimated monthly deduction: <span className="font-medium">{formatCurrency(monthlyDeduction)}</span>
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
              placeholder="Reason for loan request..."
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
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
