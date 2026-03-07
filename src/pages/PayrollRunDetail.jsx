import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { payrollRuns as runApi } from '../services/api'
import { useToast } from '../components/ui/Toast'
import {
  ArrowLeft, Banknote, Loader2, CheckCircle2, XCircle, Send,
  DollarSign, Users, TrendingDown, Building2
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'

const STATUS_VARIANTS = {
  draft: 'pending',
  review: 'low',
  approved: 'ok',
  paid: 'ok',
  cancelled: 'out',
}

export default function PayrollRunDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [run, setRun] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState('')

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [runResult, itemsResult] = await Promise.all([
        runApi.get(id),
        runApi.items(id),
      ])
      setRun(runResult.run || runResult.payroll_run || runResult)
      setItems(itemsResult.items || itemsResult.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(action, label) {
    setActionLoading(action)
    setError('')
    try {
      if (action === 'review') {
        // Submit for review - use approve with review action or a general update
        await runApi.approve(id)
      } else if (action === 'approve') {
        await runApi.approve(id)
      } else if (action === 'mark_paid') {
        await runApi.markPaid(id)
      } else if (action === 'cancel') {
        await runApi.cancel(id)
      }
      toast.success(`Payroll run ${label.toLowerCase()} successfully`)
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  function formatCurrency(value) {
    if (value == null) return '--'
    return `KES ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  if (loading) return <LoadingSpinner message="Loading payroll run..." />

  if (error && !run) return (
    <div className="text-center py-16">
      <p className="text-red-600 mb-4">{error}</p>
      <Link to="/app/payroll-runs" className="text-green-600 font-medium">Back to Payroll Runs</Link>
    </div>
  )

  if (!run) return null

  const status = run.status

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app/payroll-runs" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-bold text-gray-900">
              {run.period_name || `Payroll Run #${run.id}`}
            </h1>
            <Badge variant={STATUS_VARIANTS[status] || 'out'}>
              {status}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            Created {formatDateTime(run.created_at)}
            {run.approved_at && ` -- Approved ${formatDateTime(run.approved_at)}`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {status === 'draft' && (
            <button
              onClick={() => handleAction('review', 'Submitted for review')}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition"
            >
              {actionLoading === 'review' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              <span className="hidden sm:inline">Submit for Review</span>
            </button>
          )}
          {status === 'review' && (
            <button
              onClick={() => handleAction('approve', 'Approved')}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-lg transition"
            >
              {actionLoading === 'approve' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              <span className="hidden sm:inline">Approve</span>
            </button>
          )}
          {status === 'approved' && (
            <button
              onClick={() => handleAction('mark_paid', 'Marked as paid')}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-lg transition"
            >
              {actionLoading === 'mark_paid' ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
              <span className="hidden sm:inline">Mark as Paid</span>
            </button>
          )}
          {status !== 'paid' && status !== 'cancelled' && (
            <button
              onClick={() => handleAction('cancel', 'Cancelled')}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded-lg transition border border-red-200"
            >
              {actionLoading === 'cancel' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              <span className="hidden sm:inline">Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Gross Pay"
          value={formatCurrency(run.total_gross)}
          icon={DollarSign}
          color="#059669"
        />
        <StatCard
          label="Deductions"
          value={formatCurrency(run.total_deductions)}
          icon={TrendingDown}
          color="#dc2626"
        />
        <StatCard
          label="Net Pay"
          value={formatCurrency(run.total_net)}
          icon={Banknote}
          color="#2563eb"
        />
        <StatCard
          label="Employer Cost"
          value={formatCurrency(run.total_employer_cost)}
          icon={Building2}
          color="#7c3aed"
          subtitle={`${run.employee_count || items.length} employees`}
        />
      </div>

      {/* Employee Items Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            Employee Payroll Items ({items.length})
          </h2>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No payroll items"
            message="No employee payroll items found for this run"
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Employee</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Basic</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Allowances</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Gross</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">PAYE</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">NSSF</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">NHIF</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Housing</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Loan Ded.</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3 font-semibold">Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {item.first_name} {item.last_name}
                        </p>
                        {item.employee_no && (
                          <p className="text-xs text-gray-400">{item.employee_no}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-600">
                          {Number(item.basic_salary).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-600">
                          {Number(item.total_allowances || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {Number(item.gross_pay).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-red-600">
                          {Number(item.paye || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-red-600">
                          {Number(item.nssf_employee || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-red-600">
                          {Number(item.nhif || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-red-600">
                          {Number(item.housing_levy || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-red-600">
                          {Number(item.loan_deductions || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold text-green-700">
                          {Number(item.net_pay).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      Totals ({items.length} employees)
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {items.reduce((s, i) => s + Number(i.basic_salary || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {items.reduce((s, i) => s + Number(i.total_allowances || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {items.reduce((s, i) => s + Number(i.gross_pay || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-red-700">
                      {items.reduce((s, i) => s + Number(i.paye || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-red-700">
                      {items.reduce((s, i) => s + Number(i.nssf_employee || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-red-700">
                      {items.reduce((s, i) => s + Number(i.nhif || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-red-700">
                      {items.reduce((s, i) => s + Number(i.housing_levy || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-red-700">
                      {items.reduce((s, i) => s + Number(i.loan_deductions || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-green-700">
                      {items.reduce((s, i) => s + Number(i.net_pay || 0), 0).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {items.map(item => (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {item.first_name} {item.last_name}
                      </p>
                      {item.employee_no && (
                        <p className="text-xs text-gray-400">{item.employee_no}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-green-700">
                        KES {Number(item.net_pay).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-gray-400">Net Pay</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Gross:</span>
                      <span className="ml-1 font-medium text-gray-700">
                        {Number(item.gross_pay).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">PAYE:</span>
                      <span className="ml-1 text-red-600">
                        {Number(item.paye || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">NSSF:</span>
                      <span className="ml-1 text-red-600">
                        {Number(item.nssf_employee || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">NHIF:</span>
                      <span className="ml-1 text-red-600">
                        {Number(item.nhif || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Housing:</span>
                      <span className="ml-1 text-red-600">
                        {Number(item.housing_levy || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Loans:</span>
                      <span className="ml-1 text-red-600">
                        {Number(item.loan_deductions || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
