import { useState, useEffect } from 'react'
import { hrEmployees } from '../services/api'
import { FileText, Printer, Loader2 } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function IntroLetters() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [companyName, setCompanyName] = useState('WebSquare')
  const [showPreview, setShowPreview] = useState(false)

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

  const selectedEmployee = employees.find(e => String(e.id) === String(selectedEmployeeId))

  function generateLetterBody() {
    if (!selectedEmployee) return ''

    const empName = `${selectedEmployee.first_name} ${selectedEmployee.last_name}`
    const empNo = selectedEmployee.employee_no || 'N/A'
    const jobTitle = selectedEmployee.job_title || selectedEmployee.grade_name || 'Employee'
    const department = selectedEmployee.department_name || 'General'
    const hireDate = selectedEmployee.hire_date
      ? new Date(selectedEmployee.hire_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'N/A'

    if (customBody) return customBody

    return `To whom it may concern,

This is to certify that ${empName} (Employee No: ${empNo}) is employed by ${companyName} as ${jobTitle} in the ${department} department since ${hireDate}.

This letter is issued upon the request of the above-named employee for whatever purpose it may serve.

Should you require any further information, please do not hesitate to contact us.

Yours faithfully,

___________________________
HR Department
${companyName}`
  }

  function handleGenerate() {
    if (!selectedEmployeeId) return
    setShowPreview(true)
  }

  function handlePrint() {
    window.print()
  }

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-green-600" />
            Introduction Letters
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Generate employee introduction and confirmation letters
          </p>
        </div>
        {showPreview && (
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

      {loading && <LoadingSpinner message="Loading employees..." />}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 print:hidden">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Letter Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                <select
                  value={selectedEmployeeId}
                  onChange={e => { setSelectedEmployeeId(e.target.value); setShowPreview(false) }}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                >
                  <option value="">Select employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_no})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="e.g. To Whom It May Concern"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="WebSquare"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Letter Body</label>
                <textarea
                  value={customBody}
                  onChange={e => setCustomBody(e.target.value)}
                  rows={6}
                  placeholder="Leave empty to use the default template..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">Leave empty to auto-generate from template</p>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!selectedEmployeeId}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-lg transition"
              >
                Generate Letter
              </button>
            </div>
          </div>

          {/* Letter Preview */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 print:hidden">Letter Preview</h2>
            {showPreview && selectedEmployee ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm print:border-0 print:shadow-none print:p-0" id="letter-preview">
                {/* Letter Header */}
                <div className="border-b-2 border-green-600 pb-4 mb-6">
                  <h3 className="text-xl font-bold text-gray-900">{companyName}</h3>
                  <p className="text-xs text-gray-500 mt-1">Employee Introduction Letter</p>
                </div>

                {/* Date */}
                <div className="text-right mb-6">
                  <p className="text-sm text-gray-600">Date: {today}</p>
                </div>

                {/* Recipient */}
                {recipientName && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-700 font-medium">{recipientName}</p>
                  </div>
                )}

                {/* Letter Body */}
                <div className="whitespace-pre-line text-sm text-gray-700 leading-relaxed mb-8">
                  {generateLetterBody()}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center print:hidden">
                <FileText size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  Select an employee and click Generate to preview the letter
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
