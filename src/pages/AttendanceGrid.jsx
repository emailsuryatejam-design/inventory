import { useState, useEffect } from 'react'
import { hrAttendance } from '../services/api'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { CalendarDays, Grid3X3, ChevronLeft, ChevronRight, Clock, Save } from 'lucide-react'

const STATUS_OPTIONS = ['present', 'absent', 'half_day', 'on_leave', 'rest_day']

const STATUS_CONFIG = {
  present:  { label: 'Present',  short: 'P', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  absent:   { label: 'Absent',   short: 'A', color: 'bg-red-100 text-red-800',     dot: 'bg-red-500' },
  half_day: { label: 'Half Day', short: 'H', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  on_leave: { label: 'On Leave', short: 'L', color: 'bg-blue-100 text-blue-800',   dot: 'bg-blue-500' },
  holiday:  { label: 'Holiday',  short: 'HO', color: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
  rest_day: { label: 'Rest Day', short: 'R', color: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400' },
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function AttendanceGrid() {
  const [view, setView] = useState('daily')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setView('daily')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition ${
              view === 'daily' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarDays size={16} />
            Daily
          </button>
          <button
            onClick={() => setView('monthly')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition ${
              view === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Grid3X3 size={16} />
            Monthly
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <span key={key} className={`text-xs px-2 py-1 rounded ${cfg.color}`}>{cfg.label}</span>
        ))}
      </div>

      {view === 'daily' ? <DailyView /> : <MonthlyView />}
    </div>
  )
}

// ── Daily View ────────────────────────────────────────
function DailyView() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [changes, setChanges] = useState({}) // employee_id -> updated fields
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadDaily()
  }, [date])

  async function loadDaily() {
    setLoading(true)
    setError('')
    setChanges({})
    try {
      const result = await hrAttendance.daily(date)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function cycleStatus(employeeId, currentStatus) {
    const idx = STATUS_OPTIONS.indexOf(currentStatus)
    const nextIdx = (idx + 1) % STATUS_OPTIONS.length
    const nextStatus = STATUS_OPTIONS[nextIdx]

    setChanges(prev => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || {}),
        status: nextStatus,
      },
    }))
  }

  function getDisplayStatus(emp) {
    if (changes[emp.employee_id]?.status) {
      return changes[emp.employee_id].status
    }
    return emp.status || 'absent'
  }

  async function saveChanges() {
    if (Object.keys(changes).length === 0) return
    setSaving(true)
    setError('')
    try {
      const entries = Object.entries(changes).map(([employeeId, fields]) => ({
        employee_id: Number(employeeId),
        date,
        status: fields.status || 'present',
        ...fields,
      }))
      await hrAttendance.bulk(entries)
      setChanges({})
      loadDaily()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function changeDate(offset) {
    const d = new Date(date)
    d.setDate(d.getDate() + offset)
    setDate(d.toISOString().split('T')[0])
  }

  const hasChanges = Object.keys(changes).length > 0

  return (
    <div>
      {/* Date Picker */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft size={18} />
        </button>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        />
        <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronRight size={18} />
        </button>

        {hasChanges && (
          <button
            onClick={saveChanges}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 ml-auto"
          >
            <Save size={16} />
            {saving ? 'Saving...' : `Save (${Object.keys(changes).length})`}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadDaily} className="ml-2 underline">Retry</button>
        </div>
      )}

      {loading && !data && <LoadingSpinner message="Loading attendance..." />}

      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {data.attendance.length === 0 ? (
            <EmptyState icon={Clock} title="No employees found" message="Add employees to track attendance" />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Employee</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Clock In</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Clock Out</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Hours</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attendance.map(emp => {
                      const status = getDisplayStatus(emp)
                      const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.absent
                      const isModified = !!changes[emp.employee_id]

                      return (
                        <tr key={emp.employee_id} className={`border-b border-gray-50 hover:bg-gray-50 transition ${isModified ? 'bg-yellow-50' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{emp.employee_name}</p>
                            <p className="text-xs text-gray-400">{emp.employee_no}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{emp.clock_in || '--'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{emp.clock_out || '--'}</td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700">
                            {emp.hours_worked !== null ? Number(emp.hours_worked).toFixed(1) : '--'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => cycleStatus(emp.employee_id, status)}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition hover:ring-2 hover:ring-green-300 ${cfg.color}`}
                            >
                              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {data.attendance.map(emp => {
                  const status = getDisplayStatus(emp)
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.absent
                  const isModified = !!changes[emp.employee_id]

                  return (
                    <div key={emp.employee_id} className={`px-4 py-3 ${isModified ? 'bg-yellow-50' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{emp.employee_name}</p>
                          <p className="text-xs text-gray-400">{emp.employee_no}</p>
                        </div>
                        <button
                          onClick={() => cycleStatus(emp.employee_id, status)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${cfg.color}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {emp.clock_in && <span>In: {emp.clock_in}</span>}
                        {emp.clock_out && <span>Out: {emp.clock_out}</span>}
                        {emp.hours_worked !== null && <span>{Number(emp.hours_worked).toFixed(1)}h</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Monthly View ──────────────────────────────────────
function MonthlyView() {
  const now = new Date()
  const [month, setMonth] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadMonthly()
  }, [month])

  async function loadMonthly() {
    setLoading(true)
    setError('')
    try {
      const result = await hrAttendance.monthly(month)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function changeMonth(offset) {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + offset, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const daysInMonth = data?.days_in_month || 30
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Parse month for display
  const [displayYear, displayMonth] = month.split('-').map(Number)

  return (
    <div>
      {/* Month Picker */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {MONTHS[displayMonth - 1]} {displayYear}
        </span>
        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronRight size={18} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadMonthly} className="ml-2 underline">Retry</button>
        </div>
      )}

      {loading && !data && <LoadingSpinner message="Loading monthly data..." />}

      {data && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          {data.grid.length === 0 ? (
            <EmptyState icon={Grid3X3} title="No employees found" message="Add employees to track attendance" />
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left font-medium text-gray-500 px-3 py-2 sticky left-0 bg-white z-10 min-w-[140px]">
                    Employee
                  </th>
                  {dayNumbers.map(d => (
                    <th key={d} className="text-center font-medium text-gray-400 px-0.5 py-2 min-w-[26px]">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.grid.map(emp => (
                  <tr key={emp.employee_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-1.5 sticky left-0 bg-white z-10">
                      <p className="text-sm font-medium text-gray-900 truncate">{emp.employee_name}</p>
                      <p className="text-gray-400">{emp.employee_no}</p>
                    </td>
                    {dayNumbers.map(d => {
                      const status = emp.days[d]
                      const cfg = status ? STATUS_CONFIG[status] : null
                      return (
                        <td key={d} className="px-0.5 py-1.5 text-center">
                          {cfg ? (
                            <span
                              className={`inline-block w-5 h-5 rounded text-[9px] font-bold leading-5 ${cfg.color}`}
                              title={cfg.label}
                            >
                              {cfg.short}
                            </span>
                          ) : (
                            <span className="inline-block w-5 h-5 rounded bg-gray-50 text-[9px] text-gray-300 leading-5">-</span>
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
