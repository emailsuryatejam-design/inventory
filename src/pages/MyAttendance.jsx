import { useState, useEffect, useMemo } from 'react'
import { useUser } from '../context/AppContext'
import { selfService as selfServiceApi } from '../services/api'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import {
  Clock, LogIn, LogOut, AlertTriangle, X, Loader2,
  CalendarCheck, CalendarX, Timer, Hourglass, MapPin,
  CheckCircle2
} from 'lucide-react'

const STATUS_VARIANTS = {
  present: 'ok',
  absent: 'out',
  late: 'warning',
  'half-day': 'pending',
  holiday: 'info',
  leave: 'info',
  weekend: 'default',
}

function formatTime(timeStr) {
  if (!timeStr) return '--'
  // Handle both "HH:mm:ss" and ISO timestamps
  if (timeStr.includes('T')) {
    return new Date(timeStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  // "HH:mm:ss" or "HH:mm"
  const parts = timeStr.split(':')
  return `${parts[0]}:${parts[1]}`
}

function formatDateShort(dateStr) {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function MyAttendance() {
  const user = useUser()

  const [month, setMonth] = useState(getCurrentMonth)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Check in/out state
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [locationError, setLocationError] = useState('')

  useEffect(() => {
    loadAttendance()
  }, [month])

  async function loadAttendance() {
    setLoading(true)
    setError('')
    try {
      const result = await selfServiceApi.myAttendance(month)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function getLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        position => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
        err => reject(new Error(`Location error: ${err.message}`)),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  }

  async function handleCheckIn() {
    setCheckingIn(true)
    setLocationError('')
    setError('')
    try {
      const location = await getLocation()
      await selfServiceApi.checkIn({
        latitude: location.latitude,
        longitude: location.longitude,
      })
      loadAttendance()
    } catch (err) {
      if (err.message.includes('Location')) {
        setLocationError(err.message)
      } else {
        setError(err.message)
      }
    } finally {
      setCheckingIn(false)
    }
  }

  async function handleCheckOut() {
    setCheckingOut(true)
    setLocationError('')
    setError('')
    try {
      const location = await getLocation()
      await selfServiceApi.checkOut({
        latitude: location.latitude,
        longitude: location.longitude,
      })
      loadAttendance()
    } catch (err) {
      if (err.message.includes('Location')) {
        setLocationError(err.message)
      } else {
        setError(err.message)
      }
    } finally {
      setCheckingOut(false)
    }
  }

  // Normalize data
  const records = data?.attendance || data?.records || (Array.isArray(data) ? data : [])
  const summary = data?.summary || {}
  const todayRecord = data?.today || null

  // Stats
  const presentDays = Number(summary.present || summary.present_days || 0)
  const absentDays = Number(summary.absent || summary.absent_days || 0)
  const lateDays = Number(summary.late || summary.late_days || 0)
  const totalHours = Number(summary.total_hours || 0)
  const overtimeHours = Number(summary.overtime || summary.overtime_hours || 0)

  // Month list for selector (last 12 months)
  const monthOptions = useMemo(() => {
    const options = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      options.push({ value, label })
    }
    return options
  }, [])

  return (
    <div className="pb-8" data-guide="my-attendance-header">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Clock size={22} className="text-indigo-600" />
            My Attendance
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your attendance and working hours</p>
        </div>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        >
          {monthOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
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

      {locationError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3 flex items-center gap-2">
          <MapPin size={16} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 flex-1">{locationError}</p>
          <button onClick={() => setLocationError('')}>
            <X size={16} className="text-amber-400" />
          </button>
        </div>
      )}

      {/* Check In / Check Out Buttons */}
      <div
        className="bg-white rounded-xl border border-gray-100 p-4 lg:p-5 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3"
        style={{ boxShadow: 'var(--shadow-xs)' }}
      >
        <div>
          <p className="text-sm font-medium text-gray-700">
            {todayRecord?.check_in
              ? `Checked in at ${formatTime(todayRecord.check_in)}`
              : 'You have not checked in today'
            }
          </p>
          {todayRecord?.check_out && (
            <p className="text-xs text-gray-400 mt-0.5">Checked out at {formatTime(todayRecord.check_out)}</p>
          )}
        </div>
        <div className="flex items-center gap-2" data-guide="my-attendance-checkin">
          <button
            onClick={handleCheckIn}
            disabled={checkingIn}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            {checkingIn ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {checkingIn ? 'Locating...' : 'Check In'}
          </button>
          <button
            onClick={handleCheckOut}
            disabled={checkingOut}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            {checkingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
            {checkingOut ? 'Locating...' : 'Check Out'}
          </button>
        </div>
      </div>

      {loading && !data && <LoadingSpinner message="Loading attendance..." />}

      {!loading && data && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            <StatCard
              label="Present"
              value={presentDays}
              icon={CalendarCheck}
              color="#10b981"
              subtitle="days"
            />
            <StatCard
              label="Absent"
              value={absentDays}
              icon={CalendarX}
              color="#ef4444"
              subtitle="days"
            />
            <StatCard
              label="Late"
              value={lateDays}
              icon={Timer}
              color="#f59e0b"
              subtitle="days"
            />
            <StatCard
              label="Total Hours"
              value={totalHours.toFixed(1)}
              icon={Clock}
              color="#3b82f6"
              subtitle="hrs"
            />
            <StatCard
              label="Overtime"
              value={overtimeHours.toFixed(1)}
              icon={Hourglass}
              color="#8b5cf6"
              subtitle="hrs"
            />
          </div>

          {/* Attendance Records */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">
                Attendance Records
                {records.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-gray-400">({records.length} days)</span>
                )}
              </h2>
            </div>

            {records.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No attendance records"
                message={`No records found for the selected month`}
              />
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Check In</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Check Out</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Hours</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Late</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record, idx) => (
                        <tr
                          key={record.id || record.date || idx}
                          className="border-b border-gray-50 hover:bg-gray-50 transition"
                        >
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-gray-900">
                              {formatDateShort(record.date)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">
                            {formatTime(record.check_in || record.clock_in)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">
                            {formatTime(record.check_out || record.clock_out)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 tabular-nums">
                            {record.hours != null ? Number(record.hours).toFixed(1) : '--'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={STATUS_VARIANTS[record.status] || 'default'}>
                              {record.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {record.is_late || record.late ? (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                                <Timer size={12} />
                                {record.late_minutes ? `${record.late_minutes}m` : 'Yes'}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">--</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden divide-y divide-gray-100">
                  {records.map((record, idx) => (
                    <div key={record.id || record.date || idx} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {formatDateShort(record.date)}
                        </span>
                        <div className="flex items-center gap-2">
                          {(record.is_late || record.late) && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                              <Timer size={11} />
                              {record.late_minutes ? `${record.late_minutes}m` : 'Late'}
                            </span>
                          )}
                          <Badge variant={STATUS_VARIANTS[record.status] || 'default'}>
                            {record.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <LogIn size={11} className="text-green-500" />
                          {formatTime(record.check_in || record.clock_in)}
                        </span>
                        <span className="flex items-center gap-1">
                          <LogOut size={11} className="text-red-500" />
                          {formatTime(record.check_out || record.clock_out)}
                        </span>
                        {record.hours != null && (
                          <span className="font-medium text-gray-700">
                            {Number(record.hours).toFixed(1)} hrs
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
