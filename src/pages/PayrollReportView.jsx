import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { payrollReports } from '../services/api'
import { ArrowLeft, Printer, Loader2 } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const REPORT_TITLES = {
  payroll_summary: 'Payroll Summary',
  employee_list: 'Employee Directory',
  department_costs: 'Department Costs',
  statutory: 'Statutory Returns',
  leave_summary: 'Leave Summary',
  loan_report: 'Loan Report',
  attendance_report: 'Attendance Report',
  advance_report: 'Advance Report',
  expense_report: 'Expense Report',
  headcount: 'Headcount Report',
  bank_file: 'Bank File',
}

export default function PayrollReportView() {
  const { type } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  )
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))

  async function generateReport() {
    setLoading(true)
    setError('')
    setData(null)
    try {
      const result = await payrollReports.get(type, { start_date: startDate, end_date: endDate })
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  const title = REPORT_TITLES[type] || type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Report'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/app/payroll-reports"
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft size={18} className="text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Generate and view report data</p>
          </div>
        </div>
        {data?.rows?.length > 0 && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Print</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={generateReport}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={generateReport} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingSpinner message="Generating report..." />}

      {/* Results Table */}
      {data && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 print:border-0 print:shadow-none">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 print:border-b-2">
            <h2 className="text-sm font-semibold text-gray-900">{data.title || title}</h2>
            <span className="text-xs text-gray-500">{data.rows?.length || 0} rows</span>
          </div>

          {(!data.rows || data.rows.length === 0) ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No data found for the selected period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {(data.headers || []).map((header, idx) => (
                      <th
                        key={idx}
                        className="text-left text-xs font-medium text-gray-500 px-4 py-3 whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-700">
                          {typeof cell === 'number'
                            ? Number(cell).toLocaleString()
                            : cell || '-'
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!data && !loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">Select a date range and click Generate to view the report</p>
        </div>
      )}
    </div>
  )
}
