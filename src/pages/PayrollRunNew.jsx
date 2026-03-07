import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { payrollPeriods as periodApi, payrollRuns as runApi } from '../services/api'
import {
  ArrowLeft, Banknote, Loader2, CheckCircle2, AlertTriangle, ChevronRight, Users
} from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function PayrollRunNew() {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Step 1: Period selection
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(null)

  // Step 3: Submission
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [newRunId, setNewRunId] = useState(null)

  useEffect(() => {
    loadPeriods()
  }, [])

  async function loadPeriods() {
    setLoading(true)
    setError('')
    try {
      const result = await periodApi.list()
      const all = result.periods || result.data || []
      // Only show open periods
      const open = all.filter(p => p.status === 'open')
      setPeriods(open)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSelectPeriod(periodId) {
    setSelectedPeriodId(periodId)
    const p = periods.find(p => String(p.id) === String(periodId))
    setSelectedPeriod(p || null)
  }

  function goToStep2() {
    if (!selectedPeriodId) {
      setError('Please select a payroll period')
      return
    }
    setError('')
    setStep(2)
  }

  function goBack() {
    if (step === 2) {
      setStep(1)
    }
  }

  async function handleRunPayroll() {
    setError('')
    setSubmitting(true)
    try {
      const result = await runApi.create({ period_id: parseInt(selectedPeriodId) })
      const runId = result.id || result.run?.id || result.payroll_run?.id
      setNewRunId(runId)
      setSubmitted(true)
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading) return <LoadingSpinner message="Loading payroll periods..." />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app/payroll-runs" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Run Payroll</h1>
          <p className="text-sm text-gray-500">
            Step {step} of 3
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex-1 flex items-center gap-2">
            <div className={`h-2 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-green-500' : 'bg-gray-200'
            }`} />
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Step 1: Select Period */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Select Payroll Period</h2>
          <p className="text-sm text-gray-500 mb-4">Choose an open period to process payroll for</p>

          {periods.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle size={32} className="text-amber-500 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-2">No open payroll periods available</p>
              <Link
                to="/app/payroll-periods"
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Create a payroll period first
              </Link>
            </div>
          ) : (
            <>
              <select
                value={selectedPeriodId}
                onChange={e => handleSelectPeriod(e.target.value)}
                className="w-full px-3 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none mb-4"
              >
                <option value="">-- Select a period --</option>
                {periods.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatDate(p.start_date)} - {formatDate(p.end_date)})
                  </option>
                ))}
              </select>

              {selectedPeriod && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Period</p>
                      <p className="font-medium text-gray-900">{selectedPeriod.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Type</p>
                      <p className="font-medium text-gray-900 capitalize">
                        {selectedPeriod.period_type?.replace('_', '-')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Start</p>
                      <p className="font-medium text-gray-900">{formatDate(selectedPeriod.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Pay Date</p>
                      <p className="font-medium text-gray-900">{formatDate(selectedPeriod.pay_date)}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={goToStep2}
                disabled={!selectedPeriodId}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition"
              >
                Continue
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Review & Confirm</h2>
          <p className="text-sm text-gray-500 mb-6">Review the details below before processing payroll</p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Processing payroll for: {selectedPeriod?.name}
                </p>
                <p className="text-sm text-gray-600">
                  This will process payroll for all active employees in the system.
                  Each employee's gross pay, statutory deductions (PAYE, NSSF, NHIF, Housing Levy),
                  and loan/advance deductions will be calculated automatically.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Period Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Period:</span>
                <span className="ml-2 font-medium text-gray-900">{selectedPeriod?.name}</span>
              </div>
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-2 font-medium text-gray-900 capitalize">
                  {selectedPeriod?.period_type?.replace('_', '-')}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Start Date:</span>
                <span className="ml-2 font-medium text-gray-900">{formatDate(selectedPeriod?.start_date)}</span>
              </div>
              <div>
                <span className="text-gray-500">End Date:</span>
                <span className="ml-2 font-medium text-gray-900">{formatDate(selectedPeriod?.end_date)}</span>
              </div>
              <div>
                <span className="text-gray-500">Pay Date:</span>
                <span className="ml-2 font-medium text-gray-900">{formatDate(selectedPeriod?.pay_date)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              Back
            </button>
            <button
              onClick={handleRunPayroll}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold rounded-lg transition"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Processing Payroll...
                </>
              ) : (
                <>
                  <Banknote size={18} />
                  Run Payroll
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {step === 3 && submitted && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Payroll Processed Successfully</h2>
          <p className="text-sm text-gray-500 mb-6">
            Payroll has been calculated for period: {selectedPeriod?.name}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/app/payroll-runs"
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              All Runs
            </Link>
            {newRunId && (
              <button
                onClick={() => navigate(`/app/payroll-runs/${newRunId}`)}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition"
              >
                View Payroll Run
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
