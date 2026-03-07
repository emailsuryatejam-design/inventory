import { useState, useEffect } from 'react'
import { FileText, Eye } from 'lucide-react'

const DEFAULT_OPTIONS = {
  showCompanyLogo: true,
  showBankDetails: true,
  showStatutoryBreakdown: true,
  showQRCode: false,
  showEmployeePhoto: false,
  showDepartment: true,
  showGrade: true,
  showEarningsBreakdown: true,
  showDeductionsBreakdown: true,
  showNetPay: true,
  showYTDTotals: false,
  companyName: 'WebSquare',
  companyAddress: '',
  companyPhone: '',
}

export default function PayslipTemplates() {
  const [options, setOptions] = useState(() => {
    try {
      const saved = localStorage.getItem('ws_payslip_template')
      return saved ? { ...DEFAULT_OPTIONS, ...JSON.parse(saved) } : DEFAULT_OPTIONS
    } catch {
      return DEFAULT_OPTIONS
    }
  })

  useEffect(() => {
    localStorage.setItem('ws_payslip_template', JSON.stringify(options))
  }, [options])

  function toggleOption(key) {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleTextChange(key, value) {
    setOptions(prev => ({ ...prev, [key]: value }))
  }

  function resetDefaults() {
    setOptions(DEFAULT_OPTIONS)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-green-600" />
            Payslip Templates
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Customize how payslips are displayed and printed
          </p>
        </div>
        <button
          onClick={resetDefaults}
          className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
        >
          Reset Defaults
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="space-y-4">
          {/* Company Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Company Information</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={options.companyName}
                  onChange={e => handleTextChange('companyName', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Address</label>
                <input
                  type="text"
                  value={options.companyAddress}
                  onChange={e => handleTextChange('companyAddress', e.target.value)}
                  placeholder="e.g. P.O. Box 1234, Dar es Salaam"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={options.companyPhone}
                  onChange={e => handleTextChange('companyPhone', e.target.value)}
                  placeholder="e.g. +255 123 456 789"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Display Options */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Display Options</h2>
            <div className="space-y-3">
              {[
                { key: 'showCompanyLogo', label: 'Show Company Logo', desc: 'Display company logo at the top of the payslip' },
                { key: 'showEmployeePhoto', label: 'Show Employee Photo', desc: 'Include employee photo on the payslip' },
                { key: 'showDepartment', label: 'Show Department', desc: 'Display the employee department' },
                { key: 'showGrade', label: 'Show Job Grade', desc: 'Display the employee job grade' },
                { key: 'showBankDetails', label: 'Show Bank Details', desc: 'Include bank account information' },
                { key: 'showEarningsBreakdown', label: 'Show Earnings Breakdown', desc: 'Itemize all earnings (basic, allowances)' },
                { key: 'showDeductionsBreakdown', label: 'Show Deductions Breakdown', desc: 'Itemize all deductions (PAYE, NSSF, etc.)' },
                { key: 'showStatutoryBreakdown', label: 'Show Statutory Breakdown', desc: 'Show PAYE, NSSF, NHIF breakdown separately' },
                { key: 'showNetPay', label: 'Show Net Pay', desc: 'Highlight the net pay amount' },
                { key: 'showYTDTotals', label: 'Show Year-to-Date Totals', desc: 'Include cumulative YTD amounts' },
                { key: 'showQRCode', label: 'Show QR Code', desc: 'Add a QR code for payslip verification' },
              ].map(opt => (
                <label key={opt.key} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={options[opt.key]}
                    onChange={() => toggleOption(opt.key)}
                    className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                      {opt.label}
                    </span>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Eye size={16} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">Payslip Preview</h2>
          </div>

          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm">
            {/* Payslip Header */}
            <div className="bg-green-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  {options.showCompanyLogo && (
                    <div className="w-8 h-8 bg-white/20 rounded mb-2 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">WS</span>
                    </div>
                  )}
                  <h3 className="text-white text-lg font-bold">{options.companyName || 'Company'}</h3>
                  {options.companyAddress && (
                    <p className="text-green-200 text-xs mt-0.5">{options.companyAddress}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-white text-sm font-medium">PAYSLIP</p>
                  <p className="text-green-200 text-xs">March 2026</p>
                </div>
              </div>
            </div>

            {/* Employee Info */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                {options.showEmployeePhoto && (
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-gray-400">JD</span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">John Doe</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span>EMP-001</span>
                    {options.showDepartment && <span>Operations</span>}
                    {options.showGrade && <span>Grade B</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Earnings & Deductions */}
            <div className="px-6 py-4">
              <div className="grid grid-cols-2 gap-6">
                {/* Earnings */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Earnings</h4>
                  {options.showEarningsBreakdown ? (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Basic Salary</span>
                        <span className="text-gray-900">500,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Housing</span>
                        <span className="text-gray-900">100,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Transport</span>
                        <span className="text-gray-900">50,000</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-1.5 font-medium">
                        <span className="text-gray-700">Gross Pay</span>
                        <span className="text-gray-900">650,000</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm">
                      <div className="flex justify-between font-medium">
                        <span className="text-gray-700">Gross Pay</span>
                        <span className="text-gray-900">650,000</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Deductions */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Deductions</h4>
                  {options.showDeductionsBreakdown ? (
                    <div className="space-y-1.5 text-sm">
                      {options.showStatutoryBreakdown ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">PAYE</span>
                            <span className="text-red-600">78,000</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">NSSF</span>
                            <span className="text-red-600">65,000</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">NHIF</span>
                            <span className="text-red-600">15,000</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Statutory</span>
                          <span className="text-red-600">158,000</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-gray-200 pt-1.5 font-medium">
                        <span className="text-gray-700">Total Deductions</span>
                        <span className="text-red-600">158,000</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm">
                      <div className="flex justify-between font-medium">
                        <span className="text-gray-700">Total Deductions</span>
                        <span className="text-red-600">158,000</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Net Pay */}
            {options.showNetPay && (
              <div className="mx-6 mb-4 bg-green-50 rounded-lg px-4 py-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-green-800">NET PAY</span>
                  <span className="text-lg font-bold text-green-700">TZS 492,000</span>
                </div>
              </div>
            )}

            {/* Bank Details */}
            {options.showBankDetails && (
              <div className="px-6 pb-4">
                <div className="bg-gray-50 rounded-lg px-4 py-2.5">
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Bank:</span> CRDB Bank | <span className="font-medium">Account:</span> **** **** 4521
                  </p>
                </div>
              </div>
            )}

            {/* YTD Totals */}
            {options.showYTDTotals && (
              <div className="px-6 pb-4">
                <div className="bg-blue-50 rounded-lg px-4 py-2.5">
                  <p className="text-xs text-blue-600 font-medium mb-1">Year-to-Date</p>
                  <div className="flex justify-between text-xs text-blue-700">
                    <span>Gross: 1,950,000</span>
                    <span>Deductions: 474,000</span>
                    <span>Net: 1,476,000</span>
                  </div>
                </div>
              </div>
            )}

            {/* QR Code */}
            {options.showQRCode && (
              <div className="px-6 pb-4 flex justify-end">
                <div className="w-16 h-16 bg-gray-100 border border-gray-200 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-400">QR</span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">
                This is a computer-generated payslip. No signature required.
              </p>
              {options.companyPhone && (
                <p className="text-xs text-gray-400 text-center mt-0.5">
                  Contact: {options.companyPhone}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
