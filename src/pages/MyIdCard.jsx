import { useState, useEffect } from 'react'
import { useUser } from '../context/AppContext'
import { selfService as selfServiceApi } from '../services/api'
import { CreditCard, Printer, User, Building2 } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function MyIdCard() {
  const user = useUser()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await selfServiceApi.myIdCard()
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

  const emp = data?.employee || data || {}
  const company = data?.company || {}
  const companyName = company.name || company.company_name || 'WebSquare'

  return (
    <div data-guide="my-id-card-header">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard size={22} className="text-green-600" />
            My ID Card
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            View and print your employee identification card
          </p>
        </div>
        {data && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Print Card</span>
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={load} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingSpinner message="Loading your ID card..." />}

      {/* ID Card */}
      {!loading && data && (
        <div className="flex justify-center">
          <div className="print:m-0" id="id-card-preview">
            {/* Front of ID Card */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden max-w-sm w-full shadow-lg">
              {/* Gradient Header */}
              <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-5">
                <div className="flex items-center gap-3">
                  {company.logo_url ? (
                    <img
                      src={company.logo_url}
                      alt={companyName}
                      className="w-10 h-10 rounded-lg bg-white/20 object-contain"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                      <Building2 size={20} className="text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-white text-lg font-bold tracking-wide">{companyName}</h3>
                    <p className="text-green-200 text-xs mt-0.5">Employee Identification Card</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6">
                {/* Photo */}
                <div className="w-28 h-32 bg-gray-100 border-2 border-gray-200 rounded-xl mx-auto mb-4 flex items-center justify-center overflow-hidden">
                  {emp.photo_url || emp.avatar_url ? (
                    <img
                      src={emp.photo_url || emp.avatar_url}
                      alt={emp.first_name || emp.name || 'Employee'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={40} className="text-gray-300" />
                  )}
                </div>

                {/* Name & Title */}
                <div className="text-center mb-4">
                  <h4 className="text-lg font-bold text-gray-900">
                    {emp.first_name && emp.last_name
                      ? `${emp.first_name} ${emp.last_name}`
                      : emp.name || user?.name || 'Employee'}
                  </h4>
                  <p className="text-sm text-green-600 font-medium mt-0.5">
                    {emp.job_title || emp.grade_name || emp.position || 'Employee'}
                  </p>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Employee No</span>
                    <span className="font-mono font-medium text-gray-900">
                      {emp.employee_no || emp.emp_no || '--'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Department</span>
                    <span className="font-medium text-gray-900">
                      {emp.department_name || emp.department || '--'}
                    </span>
                  </div>
                  {(emp.id_number || emp.national_id) && (
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500">ID Number</span>
                      <span className="font-mono font-medium text-gray-900">
                        {emp.id_number || emp.national_id}
                      </span>
                    </div>
                  )}
                  {emp.hire_date && (
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500">Joined</span>
                      <span className="font-medium text-gray-900">
                        {new Date(emp.hire_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 text-center">
                  This card is property of {companyName}. If found, please return to HR Department.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No data */}
      {!loading && !data && !error && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CreditCard size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Unable to load your ID card information</p>
        </div>
      )}
    </div>
  )
}
