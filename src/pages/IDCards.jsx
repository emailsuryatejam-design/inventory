import { useState, useEffect } from 'react'
import { hrEmployees } from '../services/api'
import { CreditCard, Printer, Search } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'

export default function IDCards() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await hrEmployees.list()
      setEmployees(result.employees || result.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  // Filter
  const filtered = employees.filter(emp => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (emp.first_name || '').toLowerCase().includes(s) ||
      (emp.last_name || '').toLowerCase().includes(s) ||
      (emp.employee_no || '').toLowerCase().includes(s) ||
      (emp.department_name || '').toLowerCase().includes(s)
    )
  })

  const perPage = 20
  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard size={22} className="text-green-600" />
            ID Cards
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Generate employee ID cards
          </p>
        </div>
        {selectedEmployee && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Print ID Card</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee List */}
        <div>
          <div className="mb-4">
            <SearchInput
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
              placeholder="Search employees..."
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
              <button onClick={load} className="ml-2 underline">Retry</button>
            </div>
          )}

          {/* Loading */}
          {loading && <LoadingSpinner message="Loading employees..." />}

          {/* Employee List */}
          {!loading && (
            <div className="bg-white rounded-xl border border-gray-200">
              {paginated.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="No employees found"
                  message="Add employees to generate ID cards"
                />
              ) : (
                <>
                  <div className="divide-y divide-gray-100">
                    {paginated.map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => setSelectedEmployee(emp)}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left ${
                          selectedEmployee?.id === emp.id ? 'bg-green-50 border-l-2 border-green-500' : ''
                        }`}
                      >
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-gray-500">
                            {(emp.first_name?.[0] || '')}{(emp.last_name?.[0] || '')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate block">
                            {emp.first_name} {emp.last_name}
                          </span>
                          <p className="text-xs text-gray-400">
                            {emp.employee_no} | {emp.department_name || 'No department'}
                          </p>
                        </div>
                        <CreditCard size={16} className="text-gray-400 flex-shrink-0" />
                      </button>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="px-4 pb-4">
                      <Pagination
                        page={page}
                        totalPages={totalPages}
                        total={filtered.length}
                        perPage={perPage}
                        onChange={setPage}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ID Card Preview */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Card Preview</h2>
          {selectedEmployee ? (
            <div className="print:m-0" id="id-card-preview">
              {/* Front of ID Card */}
              <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden max-w-sm mx-auto shadow-lg">
                {/* Header Strip */}
                <div className="bg-green-600 px-6 py-4">
                  <h3 className="text-white text-lg font-bold tracking-wide">WebSquare</h3>
                  <p className="text-green-200 text-xs mt-0.5">Employee Identification Card</p>
                </div>

                {/* Body */}
                <div className="p-6">
                  {/* Photo Placeholder */}
                  <div className="w-24 h-28 bg-gray-100 border-2 border-gray-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
                    <span className="text-3xl font-bold text-gray-300">
                      {(selectedEmployee.first_name?.[0] || '')}{(selectedEmployee.last_name?.[0] || '')}
                    </span>
                  </div>

                  {/* Employee Details */}
                  <div className="text-center mb-4">
                    <h4 className="text-lg font-bold text-gray-900">
                      {selectedEmployee.first_name} {selectedEmployee.last_name}
                    </h4>
                    <p className="text-sm text-green-600 font-medium mt-0.5">
                      {selectedEmployee.job_title || selectedEmployee.grade_name || 'Employee'}
                    </p>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500">Employee No</span>
                      <span className="font-mono font-medium text-gray-900">{selectedEmployee.employee_no}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500">Department</span>
                      <span className="font-medium text-gray-900">{selectedEmployee.department_name || '--'}</span>
                    </div>
                    {selectedEmployee.hire_date && (
                      <div className="flex justify-between py-1.5 border-b border-gray-100">
                        <span className="text-gray-500">Joined</span>
                        <span className="font-medium text-gray-900">
                          {new Date(selectedEmployee.hire_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 text-center">
                    This card is property of WebSquare. If found, please return to HR Department.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <CreditCard size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Select an employee to preview their ID card</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
