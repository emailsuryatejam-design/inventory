import { useState, useEffect } from 'react'
import { useUser, isManager } from '../context/AppContext'
import { bankExport as bankExportApi } from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import {
  Building2, Download, FileSpreadsheet, CheckCircle2, AlertCircle,
} from 'lucide-react'

const BANK_FORMATS = [
  { value: 'generic', label: 'Generic CSV' },
  { value: 'kcb', label: 'KCB' },
  { value: 'equity', label: 'Equity' },
  { value: 'stanbic', label: 'Stanbic' },
  { value: 'crdb', label: 'CRDB' },
  { value: 'nmb', label: 'NMB' },
]

export default function BankExport() {
  const user = useUser()
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedRunId, setSelectedRunId] = useState('')
  const [selectedFormat, setSelectedFormat] = useState('generic')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => { loadRuns() }, [])

  async function loadRuns() {
    setLoading(true)
    setError('')
    try {
      const data = await bankExportApi.listRuns()
      setRuns(data.runs || [])
      if (data.runs?.length > 0) {
        setSelectedRunId(String(data.runs[0].id))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    if (!selectedRunId) {
      setError('Please select a payroll run')
      return
    }
    setGenerating(true)
    setError('')
    setSuccess('')
    setResult(null)
    try {
      const data = await bankExportApi.generate(Number(selectedRunId), selectedFormat)
      setResult(data)
      setSuccess('Bank export file generated successfully')
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  function handleDownload() {
    if (!result?.csv_data) return
    const blob = new Blob([result.csv_data], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.filename || 'bank_export.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (!isManager(user?.role)) {
    return (
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
        You do not have permission to access this page.
      </div>
    )
  }

  if (loading) return <LoadingSpinner message="Loading payroll runs..." />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6" data-guide="bank-export-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={22} className="text-green-600" />
            Bank Export
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Generate bank-ready CSV files for payroll payments
          </p>
        </div>
      </div>

      {/* Error / Success Messages */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto underline">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
          <CheckCircle2 size={16} className="shrink-0" />
          {success}
        </div>
      )}

      {runs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={FileSpreadsheet}
            title="No payroll runs available"
            message="Only approved or paid payroll runs can be exported to bank files"
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {/* Selection Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Payroll Run Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payroll Run</label>
              <select
                value={selectedRunId}
                onChange={e => { setSelectedRunId(e.target.value); setResult(null); setSuccess('') }}
                data-guide="bank-export-run-select"
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">Select a payroll run</option>
                {runs.map(run => (
                  <option key={run.id} value={run.id}>
                    {run.period_name || run.name} — {run.status}
                  </option>
                ))}
              </select>
            </div>

            {/* Bank Format Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Format</label>
              <select
                value={selectedFormat}
                onChange={e => { setSelectedFormat(e.target.value); setResult(null); setSuccess('') }}
                data-guide="bank-export-format-select"
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                {BANK_FORMATS.map(fmt => (
                  <option key={fmt.value} value={fmt.value}>{fmt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedRunId}
            data-guide="bank-export-btn"
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            <FileSpreadsheet size={16} />
            {generating ? 'Generating...' : 'Generate Export'}
          </button>

          {/* Result */}
          {result && (
            <div className="mt-6 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Export Result</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Filename</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{result.filename}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Records</p>
                  <p className="text-sm font-medium text-gray-900">{result.record_count?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Amount</p>
                  <p className="text-sm font-medium text-gray-900">{Number(result.total_amount || 0).toLocaleString()}</p>
                </div>
              </div>

              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
              >
                <Download size={16} />
                Download CSV
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
