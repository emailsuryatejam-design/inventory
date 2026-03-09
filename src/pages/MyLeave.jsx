import { useState, useEffect, useMemo } from 'react'
import { useUser } from '../context/AppContext'
import { selfService as selfServiceApi } from '../services/api'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import {
  CalendarDays, Plus, X, TreePalm, AlertTriangle,
  Loader2, Clock, CheckCircle2, XCircle
} from 'lucide-react'

const STATUS_VARIANTS = {
  pending: 'pending',
  approved: 'ok',
  rejected: 'out',
  cancelled: 'cancelled',
}

const LEAVE_TYPES = [
  'Annual',
  'Sick',
  'Maternity',
  'Paternity',
  'Compassionate',
  'Unpaid',
  'Study',
]

function getWorkingDays(startDate, endDate) {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (end < start) return 0
  let count = 0
  const current = new Date(start)
  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

function formatDate(dateStr) {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function MyLeave() {
  const user = useUser()
  const currentYear = new Date().getFullYear()

  const [year, setYear] = useState(currentYear)
  const [balance, setBalance] = useState(null)
  const [leaves, setLeaves] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
  })

  // Cancel confirm
  const [cancelId, setCancelId] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  const yearOptions = useMemo(() => {
    const years = []
    for (let y = currentYear - 2; y <= currentYear + 1; y++) years.push(y)
    return years
  }, [currentYear])

  useEffect(() => {
    loadData()
  }, [year])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [balanceRes, leavesRes] = await Promise.all([
        selfServiceApi.leaveBalance(year),
        selfServiceApi.myLeave(year),
      ])
      setBalance(balanceRes.balance || balanceRes)
      setLeaves(leavesRes.leaves || leavesRes)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openRequestModal() {
    setForm({ leave_type: '', start_date: '', end_date: '', reason: '' })
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await selfServiceApi.requestLeave({
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
        days: workingDays,
      })
      setShowModal(false)
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(id) {
    setCancelling(true)
    setError('')
    try {
      await selfServiceApi.cancelLeave(id)
      setCancelId(null)
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setCancelling(false)
    }
  }

  const workingDays = getWorkingDays(form.start_date, form.end_date)

  // Normalize balance to array
  const balanceList = Array.isArray(balance) ? balance : (balance ? Object.entries(balance).map(([type, data]) => ({
    leave_type: type,
    ...(typeof data === 'object' ? data : { entitled: data, used: 0, remaining: data }),
  })) : [])

  // Normalize leaves to array
  const leaveList = Array.isArray(leaves) ? leaves : []

  return (
    <div className="pb-8" data-guide="my-leave-header">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays size={22} className="text-green-600" />
            My Leave
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your leave requests and balances</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={openRequestModal}
            data-guide="my-leave-apply"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Request Leave</span>
          </button>
        </div>
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

      {loading && !balance && <LoadingSpinner message="Loading leave data..." />}

      {!loading && balance && (
        <>
          {/* Leave Balances */}
          {balanceList.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 lg:p-5 mb-4" style={{ boxShadow: 'var(--shadow-xs)' }}>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Leave Balances — {year}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {balanceList.map(item => {
                  const entitled = Number(item.entitled || item.total || 0)
                  const used = Number(item.used || item.taken || 0)
                  const remaining = Number(item.remaining ?? (entitled - used))
                  const pct = entitled > 0 ? Math.min((used / entitled) * 100, 100) : 0
                  return (
                    <div key={item.leave_type} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900 capitalize">{item.leave_type}</span>
                        <span className="text-xs text-gray-400">{used}/{entitled} used</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-1.5">
                        <div
                          className={`h-2 rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{remaining}</span> day{remaining !== 1 ? 's' : ''} remaining
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Leave History */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Leave Requests</h2>
            </div>

            {leaveList.length === 0 ? (
              <EmptyState
                icon={TreePalm}
                title="No leave requests"
                message={`No leave requests found for ${year}`}
              />
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Leave Type</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Start Date</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">End Date</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Days</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveList.map(leave => (
                        <tr key={leave.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-gray-900 capitalize">{leave.leave_type}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(leave.start_date)}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(leave.end_date)}</td>
                          <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">{leave.days || '--'}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={STATUS_VARIANTS[leave.status] || 'default'}>{leave.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {leave.status === 'pending' && (
                              <button
                                onClick={() => setCancelId(leave.id)}
                                className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline transition"
                              >
                                Cancel
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
                  {leaveList.map(leave => (
                    <div key={leave.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 capitalize">{leave.leave_type}</span>
                        <Badge variant={STATUS_VARIANTS[leave.status] || 'default'}>{leave.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mb-1">
                        <span>{formatDate(leave.start_date)} - {formatDate(leave.end_date)}</span>
                        <span className="font-medium text-gray-700">{leave.days || '--'} day(s)</span>
                      </div>
                      {leave.reason && <p className="text-xs text-gray-400 truncate">{leave.reason}</p>}
                      {leave.status === 'pending' && (
                        <button
                          onClick={() => setCancelId(leave.id)}
                          className="mt-2 flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                        >
                          <XCircle size={12} /> Cancel
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Request Leave Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Request Leave"
        maxWidth="480px"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
            <select
              required
              value={form.leave_type}
              onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            >
              <option value="">Select leave type</option>
              {LEAVE_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                required
                value={form.end_date}
                min={form.start_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {form.start_date && form.end_date && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <Clock size={14} className="text-blue-500" />
              <span className="text-sm text-blue-700">
                <span className="font-medium">{workingDays}</span> working day{workingDays !== 1 ? 's' : ''} (excludes weekends)
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
              placeholder="Reason for leave..."
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
              disabled={submitting || workingDays === 0}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        title="Cancel Leave Request"
        maxWidth="400px"
      >
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to cancel this leave request? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setCancelId(null)}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition"
            >
              Keep
            </button>
            <button
              onClick={() => handleCancel(cancelId)}
              disabled={cancelling}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {cancelling ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              {cancelling ? 'Cancelling...' : 'Cancel Leave'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
