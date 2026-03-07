import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { hrEmployees as hrEmployeesApi } from '../services/api'
import { useUser, isManager } from '../context/AppContext'
import { Users, Plus, ChevronRight } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'resigned', label: 'Resigned' },
]

const STATUS_BADGE = {
  active: 'ok',
  suspended: 'low',
  terminated: 'out',
  resigned: 'out',
  probation: 'pending',
}

export default function HREmployees() {
  const user = useUser()
  const canCreate = isManager(user?.role)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    loadEmployees()
  }, [search, departmentId, status, page])

  async function loadEmployees() {
    setLoading(true)
    setError('')
    try {
      const params = { page, per_page: 25 }
      if (search) params.search = search
      if (departmentId) params.department_id = departmentId
      if (status) params.employment_status = status
      const result = await hrEmployeesApi.list(params)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(value) {
    setSearch(value)
    setPage(1)
  }

  function getInitial(employee) {
    return (employee.first_name?.[0] || '?').toUpperCase()
  }

  const employees = data?.employees || []
  const departments = data?.departments || []

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} employee{data?.pagination?.total !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <Link
            to="/app/hr-employees/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Employee</span>
          </Link>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search by name or employee no..."
          />
        </div>
        <select
          value={departmentId}
          onChange={e => { setDepartmentId(e.target.value); setPage(1) }}
          className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadEmployees} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && <LoadingSpinner message="Loading employees..." />}

      {/* Employee List */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {employees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No employees found"
              message={search ? `No employees matching "${search}"` : 'No employees yet'}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Employee No</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Name</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Department</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Job Title</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-gray-900">{emp.employee_no}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/hr-employees/${emp.id}`} className="text-sm font-medium text-gray-900 hover:text-green-600">
                            {emp.first_name} {emp.last_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{emp.department_name || '--'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{emp.job_title || '--'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={STATUS_BADGE[emp.employment_status] || 'pending'}>
                            {emp.employment_status || 'Unknown'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/hr-employees/${emp.id}`}>
                            <ChevronRight size={16} className="text-gray-400" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {employees.map(emp => (
                  <Link
                    key={emp.id}
                    to={`/app/hr-employees/${emp.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-green-700">{getInitial(emp)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-gray-400">{emp.employee_no}</span>
                        <Badge variant={STATUS_BADGE[emp.employment_status] || 'pending'}>
                          {emp.employment_status || 'Unknown'}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{emp.department_name || 'No dept'}</span>
                        {emp.job_title && (
                          <>
                            <span className="text-xs text-gray-300">*</span>
                            <span className="text-xs text-gray-400">{emp.job_title}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {data.pagination && (
                <div className="px-4 pb-4">
                  <Pagination
                    page={data.pagination.page}
                    totalPages={data.pagination.total_pages}
                    total={data.pagination.total}
                    perPage={data.pagination.per_page}
                    onChange={(p) => setPage(p)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
