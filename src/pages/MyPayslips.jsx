import { useState, useEffect } from 'react'
import { useUser } from '../context/AppContext'
import { payslips as payslipsApi } from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { FileText, Download, Eye, X } from 'lucide-react'

const currentYear = new Date().getFullYear()
const YEARS = [currentYear, currentYear - 1, currentYear - 2]

export default function MyPayslips() {
  const user = useUser()
  const [payslipList, setPayslipList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [year, setYear] = useState(currentYear)
  const [viewHtml, setViewHtml] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loadingPayslip, setLoadingPayslip] = useState(null)

  useEffect(() => { loadPayslips() }, [year])

  async function loadPayslips() {
    setLoading(true)
    setError('')
    try {
      const result = await payslipsApi.myPayslips(year)
      setPayslipList(result.payslips || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleView(itemId) {
    setLoadingPayslip(itemId)
    try {
      const result = await payslipsApi.generate(itemId)
      if (result?.html) {
        setViewHtml(result.html)
        setShowModal(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingPayslip(null)
    }
  }

  function handleDownload(itemId, periodName) {
    // Open payslip in new window for print/download
    payslipsApi.generate(itemId).then(result => {
      if (result?.html) {
        const win = window.open('', '_blank')
        win.document.write(result.html)
        win.document.close()
        win.document.title = `Payslip - ${periodName || 'Download'}`
      }
    }).catch(err => {
      setError(err.message)
    })
  }

  function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString()
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6" data-guide="my-payslips-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-green-600" />
            My Payslips
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            View and download your payslips
          </p>
        </div>

        {/* Year Filter */}
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          data-guide="my-payslips-year-filter"
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        >
          {YEARS.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadPayslips} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingSpinner message="Loading payslips..." />}

      {/* Content */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200">
          {payslipList.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No payslips found"
              message={`No payslips available for ${year}`}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Period</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Pay Date</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Gross Pay</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Deductions</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Net Pay</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslipList.map(slip => (
                      <tr key={slip.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{slip.period_name || slip.period}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(slip.pay_date)}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                          {formatCurrency(slip.gross_pay)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-red-600">
                          {formatCurrency(slip.total_deductions)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-gray-900">
                          {formatCurrency(slip.net_pay)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleView(slip.id)}
                              disabled={loadingPayslip === slip.id}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition disabled:opacity-50"
                              title="View payslip"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => handleDownload(slip.id, slip.period_name || slip.period)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                              title="Download payslip"
                            >
                              <Download size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {payslipList.map(slip => (
                  <div key={slip.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">{slip.period_name || slip.period}</p>
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">
                        {formatCurrency(slip.net_pay)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
                      <span>{formatDate(slip.pay_date)}</span>
                      <span>Gross: {formatCurrency(slip.gross_pay)}</span>
                      <span className="text-red-500">Ded: {formatCurrency(slip.total_deductions)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleView(slip.id)}
                        disabled={loadingPayslip === slip.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition disabled:opacity-50"
                      >
                        <Eye size={12} /> View
                      </button>
                      <button
                        onClick={() => handleDownload(slip.id, slip.period_name || slip.period)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition"
                      >
                        <Download size={12} /> Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Payslip Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setViewHtml('') }}
        title="Payslip"
        maxWidth="800px"
      >
        {viewHtml ? (
          <div
            className="payslip-preview overflow-auto max-h-[70vh]"
            dangerouslySetInnerHTML={{ __html: viewHtml }}
          />
        ) : (
          <LoadingSpinner message="Loading payslip..." />
        )}
      </Modal>
    </div>
  )
}
