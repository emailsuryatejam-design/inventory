import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../context/AppContext'
import { hrDashboard as api } from '../services/api'
import {
  Users, Calculator, CalendarDays, Wallet, ChevronRight, Plus,
  Building2, ClipboardCheck, BarChart3, FileText, BanknoteIcon,
} from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function PayrollDashboard() {
  const user = useUser()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const result = await api.get()
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function greeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) return <LoadingSpinner message="Loading dashboard..." />
  if (error) return (
    <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg">
      {error}
      <button onClick={load} className="ml-2 underline">Retry</button>
    </div>
  )

  const stats = data?.stats || {}

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{greeting()}, {user?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Payroll & HR Dashboard</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Employees"
          value={stats.totalEmployees || 0}
          icon={Users}
          color="blue"
          link="/app/hr-employees"
        />
        <StatCard
          label="Monthly Payroll"
          value={`TZS ${(stats.monthlyPayroll || 0).toLocaleString()}`}
          icon={Calculator}
          color="green"
          link="/app/payroll-runs"
        />
        <StatCard
          label="Pending Leave"
          value={stats.pendingLeave || 0}
          icon={CalendarDays}
          color="amber"
          link="/app/leave"
        />
        <StatCard
          label="Active Loans"
          value={stats.activeLoans || 0}
          icon={Wallet}
          color="purple"
          link="/app/hr-loans"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <QuickAction to="/app/payroll-runs/new" icon={Calculator} label="Run Payroll" desc="Process monthly payroll" />
            <QuickAction to="/app/hr-employees/new" icon={Users} label="Add Employee" desc="Register a new team member" />
            <QuickAction to="/app/leave" icon={CalendarDays} label="Leave Calendar" desc="View & approve leave requests" />
            <QuickAction to="/app/attendance" icon={ClipboardCheck} label="Attendance" desc="Track daily attendance" />
            <QuickAction to="/app/payroll-reports" icon={BarChart3} label="Reports" desc="Generate payroll reports" />
          </div>
        </div>

        {/* Modules Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">HR Modules</h2>
          <div className="grid grid-cols-2 gap-3">
            <ModuleCard to="/app/hr-employees" icon={Users} label="Employees" count={stats.totalEmployees || 0} color="#3b82f6" />
            <ModuleCard to="/app/departments" icon={Building2} label="Departments" count={stats.totalDepartments || 0} color="#10b981" />
            <ModuleCard to="/app/hr-loans" icon={Wallet} label="Loans" count={stats.activeLoans || 0} color="#8b5cf6" />
            <ModuleCard to="/app/salary-advances" icon={BanknoteIcon} label="Advances" count={stats.pendingAdvances || 0} color="#f59e0b" />
            <ModuleCard to="/app/contracts" icon={FileText} label="Contracts" count={stats.activeContracts || 0} color="#6366f1" />
            <ModuleCard to="/app/shifts" icon={ClipboardCheck} label="Shifts" count={stats.totalShifts || 0} color="#64748b" />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {data?.recentActivity?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {data.recentActivity.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                <span className="text-gray-600 flex-1">{a.action}</span>
                <span className="text-xs text-gray-400">{a.created_at}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function QuickAction({ to, icon: Icon, label, desc }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition group"
    >
      <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-green-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition" />
    </Link>
  )
}

function ModuleCard({ to, icon: Icon, label, count, color }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-3 py-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15', color }}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-lg font-semibold text-gray-900">{count}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </Link>
  )
}
