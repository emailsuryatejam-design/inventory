import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3, Users, Building2, FileText, CalendarDays, Wallet,
  ClipboardCheck, BanknoteIcon, Receipt, UserCheck, CreditCard,
} from 'lucide-react'

const REPORT_TYPES = [
  {
    key: 'payroll_summary',
    title: 'Payroll Summary',
    description: 'Monthly payroll totals by period',
    icon: BarChart3,
    color: 'blue',
  },
  {
    key: 'employee_list',
    title: 'Employee Directory',
    description: 'All employees with department and salary details',
    icon: Users,
    color: 'green',
  },
  {
    key: 'department_costs',
    title: 'Department Costs',
    description: 'Payroll cost breakdown by department',
    icon: Building2,
    color: 'purple',
  },
  {
    key: 'statutory',
    title: 'Statutory Returns',
    description: 'PAYE, NSSF, NHIF and housing levy summaries',
    icon: FileText,
    color: 'red',
  },
  {
    key: 'leave_summary',
    title: 'Leave Summary',
    description: 'Leave balances and usage by employee',
    icon: CalendarDays,
    color: 'amber',
  },
  {
    key: 'loan_report',
    title: 'Loan Report',
    description: 'Active loans and outstanding balances',
    icon: Wallet,
    color: 'indigo',
  },
  {
    key: 'attendance_report',
    title: 'Attendance Report',
    description: 'Monthly attendance summary by employee',
    icon: ClipboardCheck,
    color: 'teal',
  },
  {
    key: 'advance_report',
    title: 'Advance Report',
    description: 'Salary advances issued and recovered',
    icon: BanknoteIcon,
    color: 'orange',
  },
  {
    key: 'expense_report',
    title: 'Expense Report',
    description: 'Expense claims summary and status',
    icon: Receipt,
    color: 'pink',
  },
  {
    key: 'headcount',
    title: 'Headcount Report',
    description: 'Employee count by department and status',
    icon: UserCheck,
    color: 'cyan',
  },
  {
    key: 'bank_file',
    title: 'Bank File',
    description: 'Payment file for bank upload with net pay',
    icon: CreditCard,
    color: 'emerald',
  },
]

const COLOR_MAP = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  teal: 'bg-teal-50 text-teal-600',
  orange: 'bg-orange-50 text-orange-600',
  pink: 'bg-pink-50 text-pink-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  emerald: 'bg-emerald-50 text-emerald-600',
}

export default function PayrollReports() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 size={22} className="text-green-600" />
          Payroll Reports
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Select a report type to generate
        </p>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {REPORT_TYPES.map(report => {
          const Icon = report.icon
          const colorClasses = COLOR_MAP[report.color] || COLOR_MAP.blue
          return (
            <Link
              key={report.key}
              to={`/app/payroll-reports/${report.key}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition group"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorClasses}`}>
                <Icon size={20} />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 group-hover:text-green-600 transition">
                {report.title}
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {report.description}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
