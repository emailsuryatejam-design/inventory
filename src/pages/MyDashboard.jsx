import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../context/AppContext'
import { selfService as selfServiceApi, payslips as payslipsApi } from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import StatCard from '../components/ui/StatCard'
import {
  Wallet, CalendarDays, CreditCard, Clock,
  FileText, ChevronRight, Download, MapPin,
  PalmtreeIcon,
} from 'lucide-react'

export default function MyDashboard() {
  const user = useUser()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await selfServiceApi.dashboard()
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadPayslip(itemId) {
    setDownloading(itemId)
    try {
      const result = await payslipsApi.generate(itemId)
      if (result?.html) {
        const win = window.open('', '_blank')
        win.document.write(result.html)
        win.document.close()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloading(null)
    }
  }

  function greeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString()
  }

  if (loading) return <LoadingSpinner message="Loading your dashboard..." />

  if (error) return (
    <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg">
      {error}
      <button onClick={load} className="ml-2 underline">Retry</button>
    </div>
  )

  const stats = data?.stats || {}
  const recentPayslips = data?.recent_payslips || []
  const upcomingLeave = data?.upcoming_leave || []
  const fieldSummary = data?.field_summary || null

  return (
    <div>
      {/* Header */}
      <div className="mb-6" data-guide="my-dashboard-header">
        <h1 className="text-xl font-bold text-gray-900">
          {greeting()}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Your self-service dashboard</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Net Pay (Latest)"
          value={formatCurrency(stats.net_pay)}
          icon={Wallet}
          color="#10b981"
        />
        <StatCard
          label="Leave Balance"
          value={stats.leave_balance ?? '--'}
          icon={CalendarDays}
          color="#3b82f6"
          subtitle="days remaining"
        />
        <StatCard
          label="Active Loans"
          value={stats.active_loans ?? 0}
          icon={CreditCard}
          color="#8b5cf6"
        />
        <StatCard
          label="Pending Requests"
          value={stats.pending_requests ?? 0}
          icon={Clock}
          color="#f59e0b"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/app/my-payslips"
            data-guide="my-payslips-link"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition group"
          >
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">My Payslips</p>
              <p className="text-xs text-gray-400">View and download payslips</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition" />
          </Link>

          <Link
            to="/app/my-leave"
            data-guide="my-leave-apply"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition group"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <PalmtreeIcon size={18} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">My Leave</p>
              <p className="text-xs text-gray-400">Apply and track leave</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition" />
          </Link>

          <Link
            to="/app/my-loans"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition group"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <CreditCard size={18} className="text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">My Loans</p>
              <p className="text-xs text-gray-400">View loan details</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition" />
          </Link>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payslips */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Payslips</h2>
            <Link to="/app/my-payslips" className="text-xs text-green-600 hover:text-green-700 font-medium">
              View All
            </Link>
          </div>

          {recentPayslips.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No recent payslips</p>
          ) : (
            <div className="space-y-3">
              {recentPayslips.slice(0, 3).map(slip => (
                <div key={slip.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{slip.period_name || slip.period}</p>
                    <p className="text-xs text-gray-400">{slip.pay_date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900 tabular-nums">
                      {formatCurrency(slip.net_pay)}
                    </span>
                    <button
                      onClick={() => handleDownloadPayslip(slip.id)}
                      disabled={downloading === slip.id}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded transition disabled:opacity-50"
                      title="View payslip"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Leave */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Upcoming Leave</h2>
            <Link to="/app/my-leave" className="text-xs text-green-600 hover:text-green-700 font-medium">
              Apply
            </Link>
          </div>

          {upcomingLeave.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No upcoming leave scheduled</p>
          ) : (
            <div className="space-y-3">
              {upcomingLeave.map((leave, i) => (
                <div key={leave.id || i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <CalendarDays size={14} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{leave.leave_type || leave.type}</p>
                    <p className="text-xs text-gray-400">
                      {leave.start_date} — {leave.end_date} ({leave.days || 0} days)
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    leave.status === 'approved' ? 'bg-green-50 text-green-700'
                    : leave.status === 'pending' ? 'bg-amber-50 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}>
                    {leave.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Field Work Summary */}
      {fieldSummary && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Field Work Today</h2>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <MapPin size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-900">
                <span className="font-semibold">{fieldSummary.visits_today ?? 0}</span> visits today
              </p>
              {fieldSummary.last_check_in && (
                <p className="text-xs text-gray-400">Last check-in: {fieldSummary.last_check_in}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
