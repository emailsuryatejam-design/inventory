import { useState, useEffect } from 'react'
import { leaveTypes as ltApi, leaveRequests as lrApi, hrEmployees } from '../services/api'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { Calendar, ClipboardList, Settings, Plus, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'

const TABS = [
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'requests', label: 'Requests', icon: ClipboardList },
  { key: 'types', label: 'Leave Types', icon: Settings },
]

const STATUS_VARIANTS = {
  pending: 'pending',
  approved: 'ok',
  rejected: 'out',
}

const LEAVE_COLORS = [
  'bg-blue-200 text-blue-800',
  'bg-green-200 text-green-800',
  'bg-purple-200 text-purple-800',
  'bg-yellow-200 text-yellow-800',
  'bg-pink-200 text-pink-800',
  'bg-indigo-200 text-indigo-800',
  'bg-red-200 text-red-800',
  'bg-teal-200 text-teal-800',
]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function LeaveManagement() {
  const [activeTab, setActiveTab] = useState('calendar')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Leave Management</h1>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none mb-4">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition ${
                activeTab === tab.key
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'calendar' && <LeaveCalendarTab />}
      {activeTab === 'requests' && <LeaveRequestsTab />}
      {activeTab === 'types' && <LeaveTypesTab />}
    </div>
  )
}

// ── Calendar Tab ──────────────────────────────────────
function LeaveCalendarTab() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadCalendar()
  }, [month, year])

  async function loadCalendar() {
    setLoading(true)
    setError('')
    try {
      const result = await lrApi.calendar(month, year)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function prevMonth() {
    if (month === 1) {
      setMonth(12)
      setYear(y => y - 1)
    } else {
      setMonth(m => m - 1)
    }
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1)
      setYear(y => y + 1)
    } else {
      setMonth(m => m + 1)
    }
  }

  const daysInMonth = data?.days_in_month || new Date(year, month, 0).getDate()
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Build a color map for leave type codes
  const leaveTypeColorMap = {}
  let colorIdx = 0
  if (data?.calendar) {
    data.calendar.forEach(emp => {
      Object.values(emp.days).forEach(d => {
        if (d.leave_type_code && !leaveTypeColorMap[d.leave_type_code]) {
          leaveTypeColorMap[d.leave_type_code] = LEAVE_COLORS[colorIdx % LEAVE_COLORS.length]
          colorIdx++
        }
      })
    })
  }

  return (
    <div>
      {/* Month Picker */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          >
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Legend */}
      {Object.keys(leaveTypeColorMap).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(leaveTypeColorMap).map(([code, color]) => (
            <span key={code} className={`text-xs px-2 py-1 rounded ${color}`}>{code}</span>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadCalendar} className="ml-2 underline">Retry</button>
        </div>
      )}

      {loading && !data && <LoadingSpinner message="Loading calendar..." />}

      {data && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          {data.calendar.length === 0 ? (
            <EmptyState icon={Calendar} title="No employees found" message="Add employees to see the leave calendar" />
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left font-medium text-gray-500 px-3 py-2 sticky left-0 bg-white z-10 min-w-[140px]">
                    Employee
                  </th>
                  {dayNumbers.map(d => (
                    <th key={d} className="text-center font-medium text-gray-400 px-1 py-2 min-w-[28px]">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.calendar.map(emp => (
                  <tr key={emp.employee_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-1.5 sticky left-0 bg-white z-10">
                      <p className="text-sm font-medium text-gray-900 truncate">{emp.employee_name}</p>
                      <p className="text-gray-400">{emp.employee_no}</p>
                    </td>
                    {dayNumbers.map(d => {
                      const leave = emp.days[d]
                      return (
                        <td key={d} className="px-0.5 py-1.5 text-center">
                          {leave ? (
                            <span
                              className={`inline-block w-6 h-6 rounded text-[10px] font-medium leading-6 ${leaveTypeColorMap[leave.leave_type_code] || 'bg-gray-200 text-gray-700'}`}
                              title={leave.leave_type}
                            >
                              {leave.leave_type_code?.charAt(0) || 'L'}
                            </span>
                          ) : (
                            <span className="inline-block w-6 h-6" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── Requests Tab ──────────────────────────────────────
function LeaveRequestsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [rejectId, setRejectId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  // Form state
  const [employees, setEmployees] = useState([])
  const [leaveTypesList, setLeaveTypesList] = useState([])
  const [form, setForm] = useState({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', reason: '' })

  useEffect(() => {
    loadRequests()
  }, [statusFilter, page])

  async function loadRequests() {
    setLoading(true)
    setError('')
    try {
      const params = { page, per_page: 20 }
      if (statusFilter) params.status = statusFilter
      const result = await lrApi.list(params)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function openCreateModal() {
    try {
      const [empRes, ltRes] = await Promise.all([hrEmployees.list({ status: 'active' }), ltApi.list()])
      setEmployees(empRes.employees || [])
      setLeaveTypesList(ltRes.leave_types || [])
      setForm({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', reason: '' })
      setShowModal(true)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await lrApi.create({
        employee_id: Number(form.employee_id),
        leave_type_id: Number(form.leave_type_id),
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
      })
      setShowModal(false)
      loadRequests()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove(id) {
    try {
      await lrApi.approve(id)
      loadRequests()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleReject() {
    if (!rejectId) return
    try {
      await lrApi.reject(rejectId, rejectReason)
      setRejectId(null)
      setRejectReason('')
      loadRequests()
    } catch (err) {
      setError(err.message)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const STATUS_TABS = [
    { key: '', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ]

  return (
    <div>
      {/* Header with Create button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
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
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Request</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadRequests} className="ml-2 underline">Retry</button>
        </div>
      )}

      {loading && !data && <LoadingSpinner message="Loading requests..." />}

      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {data.requests.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No leave requests" message="Create a new leave request to get started" />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Employee</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Leave Type</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Start</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">End</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Days</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.requests.map(req => (
                      <tr key={req.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{req.employee_name}</p>
                          <p className="text-xs text-gray-400">{req.employee_no}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{req.leave_type_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(req.start_date)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(req.end_date)}</td>
                        <td className="px-4 py-3 text-center text-sm font-medium text-gray-700">{req.days}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={STATUS_VARIANTS[req.status] || 'out'}>{req.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {req.status === 'pending' && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleApprove(req.id)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                                title="Approve"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => { setRejectId(req.id); setRejectReason('') }}
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
                {data.requests.map(req => (
                  <div key={req.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">{req.employee_name}</p>
                      <Badge variant={STATUS_VARIANTS[req.status] || 'out'}>{req.status}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{req.leave_type_name} -- {req.days} day(s)</p>
                    <p className="text-xs text-gray-400">{formatDate(req.start_date)} - {formatDate(req.end_date)}</p>
                    {req.reason && <p className="text-xs text-gray-400 mt-1 truncate">{req.reason}</p>}
                    {req.status === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() => { setRejectId(req.id); setRejectReason('') }}
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
              <h2 className="text-lg font-semibold text-gray-900">New Leave Request</h2>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                <select
                  required
                  value={form.leave_type_id}
                  onChange={e => setForm(f => ({ ...f, leave_type_id: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                >
                  <option value="">Select type</option>
                  {leaveTypesList.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>
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
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
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
                  disabled={submitting}
                  className="px-4 py-2.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Reject Leave Request</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for rejection</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                  placeholder="Enter reason..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setRejectId(null)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  className="px-4 py-2.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Leave Types Tab ───────────────────────────────────
function LeaveTypesTab() {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingType, setEditingType] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '', code: '', default_days: '', is_paid: true, accrual_method: 'annual', gender_restriction: '', is_active: true,
  })

  useEffect(() => {
    loadTypes()
  }, [])

  async function loadTypes() {
    setLoading(true)
    setError('')
    try {
      const result = await ltApi.list()
      setTypes(result.leave_types || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditingType(null)
    setForm({ name: '', code: '', default_days: '', is_paid: true, accrual_method: 'annual', gender_restriction: '', is_active: true })
    setShowModal(true)
  }

  function openEdit(lt) {
    setEditingType(lt)
    setForm({
      name: lt.name,
      code: lt.code,
      default_days: lt.default_days,
      is_paid: lt.is_paid,
      accrual_method: lt.accrual_method || 'annual',
      gender_restriction: lt.gender_restriction || '',
      is_active: lt.is_active,
    })
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        name: form.name,
        code: form.code,
        default_days: Number(form.default_days) || 0,
        is_paid: form.is_paid ? 1 : 0,
        accrual_method: form.accrual_method,
        gender_restriction: form.gender_restriction || null,
        is_active: form.is_active ? 1 : 0,
      }
      if (editingType) {
        await ltApi.update(editingType.id, payload)
      } else {
        await ltApi.create(payload)
      }
      setShowModal(false)
      loadTypes()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{types.length} leave types</p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Type</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadTypes} className="ml-2 underline">Retry</button>
        </div>
      )}

      {loading && !types.length && <LoadingSpinner message="Loading leave types..." />}

      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200">
          {types.length === 0 ? (
            <EmptyState icon={Settings} title="No leave types" message="Add leave types to manage employee leave" />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Name</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Code</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Default Days</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Paid</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Gender</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Active</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.map(lt => (
                      <tr
                        key={lt.id}
                        onClick={() => openEdit(lt)}
                        className="border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{lt.name}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-500">{lt.code}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-700">{lt.default_days}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={lt.is_paid ? 'ok' : 'out'}>{lt.is_paid ? 'Yes' : 'No'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{lt.gender_restriction || 'All'}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={lt.is_active ? 'ok' : 'out'}>{lt.is_active ? 'Active' : 'Inactive'}</Badge>
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
                {types.map(lt => (
                  <div
                    key={lt.id}
                    onClick={() => openEdit(lt)}
                    className="px-4 py-3 hover:bg-gray-50 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">{lt.name}</p>
                      <Badge variant={lt.is_active ? 'ok' : 'out'}>{lt.is_active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="font-mono">{lt.code}</span>
                      <span>--</span>
                      <span>{lt.default_days} days</span>
                      <span>--</span>
                      <span>{lt.is_paid ? 'Paid' : 'Unpaid'}</span>
                      {lt.gender_restriction && (
                        <>
                          <span>--</span>
                          <span>{lt.gender_restriction}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingType ? 'Edit Leave Type' : 'New Leave Type'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="Annual Leave"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="AL"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Days</label>
                  <input
                    type="number"
                    min="0"
                    value={form.default_days}
                    onChange={e => setForm(f => ({ ...f, default_days: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender Restriction</label>
                  <select
                    value={form.gender_restriction}
                    onChange={e => setForm(f => ({ ...f, gender_restriction: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
                    <option value="">All</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.is_paid}
                    onChange={e => setForm(f => ({ ...f, is_paid: e.target.checked }))}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Paid Leave
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Active
                </label>
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
                  {submitting ? 'Saving...' : editingType ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
