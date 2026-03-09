import { useState, useEffect } from 'react'
import { useUser } from '../context/AppContext'
import { selfService as selfServiceApi } from '../services/api'
import { FileText, Printer, Building2 } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function MyIntroLetter() {
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

  const empName = emp.first_name && emp.last_name
    ? `${emp.first_name} ${emp.last_name}`
    : emp.name || user?.name || 'Employee'
  const empNo = emp.employee_no || emp.emp_no || 'N/A'
  const jobTitle = emp.job_title || emp.grade_name || emp.position || 'Employee'
  const department = emp.department_name || emp.department || 'General'
  const joinDate = emp.hire_date
    ? new Date(emp.hire_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'N/A'
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div data-guide="my-intro-letter-header">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-green-600" />
            My Introduction Letter
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            View and print your employee introduction letter
          </p>
        </div>
        {data && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Print Letter</span>
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
      {loading && <LoadingSpinner message="Loading your introduction letter..." />}

      {/* Letter */}
      {!loading && data && (
        <div className="flex justify-center">
          <div
            className="bg-white rounded-xl border border-gray-200 shadow-sm w-full max-w-2xl print:border-0 print:shadow-none print:max-w-none"
            id="intro-letter-preview"
          >
            {/* Company Letterhead */}
            <div className="border-b-2 border-green-600 px-8 py-6 print:px-0">
              <div className="flex items-center gap-3">
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={companyName}
                    className="w-12 h-12 rounded-lg object-contain"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
                    <Building2 size={24} className="text-green-600" />
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{companyName}</h3>
                  {(company.address || company.phone || company.email) && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[company.address, company.phone, company.email].filter(Boolean).join(' | ')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Letter Content */}
            <div className="px-8 py-8 print:px-0">
              {/* Date */}
              <div className="text-right mb-8">
                <p className="text-sm text-gray-600">Date: {today}</p>
              </div>

              {/* Subject */}
              <div className="mb-6">
                <h4 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                  TO WHOM IT MAY CONCERN
                </h4>
              </div>

              {/* Subject Line */}
              <div className="mb-6">
                <p className="text-sm text-gray-700 font-semibold">
                  RE: INTRODUCTION LETTER - {empName.toUpperCase()}
                </p>
              </div>

              {/* Body */}
              <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
                <p>Dear Sir/Madam,</p>

                <p>
                  This is to certify that <strong>{empName}</strong> (Employee No: <strong>{empNo}</strong>) is
                  a bona fide employee of <strong>{companyName}</strong>, serving in the capacity
                  of <strong>{jobTitle}</strong> in the <strong>{department}</strong> department
                  since <strong>{joinDate}</strong>.
                </p>

                {/* Employee Summary Table */}
                <div className="bg-gray-50 rounded-lg p-4 my-6">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="py-2 text-gray-500 font-medium w-40">Full Name</td>
                        <td className="py-2 text-gray-900">{empName}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="py-2 text-gray-500 font-medium">Employee No</td>
                        <td className="py-2 text-gray-900 font-mono">{empNo}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="py-2 text-gray-500 font-medium">Job Title</td>
                        <td className="py-2 text-gray-900">{jobTitle}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="py-2 text-gray-500 font-medium">Department</td>
                        <td className="py-2 text-gray-900">{department}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-gray-500 font-medium">Date of Joining</td>
                        <td className="py-2 text-gray-900">{joinDate}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p>
                  This letter is issued upon the request of the above-named employee for whatever
                  legal purpose it may serve.
                </p>

                <p>
                  Should you require any further information or verification, please do not hesitate
                  to contact us.
                </p>

                <p>Yours faithfully,</p>

                {/* Signature Block */}
                <div className="mt-10 pt-4">
                  <div className="w-48 border-t-2 border-gray-300 pt-2">
                    <p className="text-sm font-semibold text-gray-900">HR Department</p>
                    <p className="text-xs text-gray-500">{companyName}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No data */}
      {!loading && !data && !error && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Unable to load your information for the introduction letter</p>
        </div>
      )}
    </div>
  )
}
