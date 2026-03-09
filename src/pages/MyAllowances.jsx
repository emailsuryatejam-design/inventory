import { useState, useEffect } from 'react'
import { useUser } from '../context/AppContext'
import { selfService as selfServiceApi } from '../services/api'
import { Coins } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

export default function MyAllowances() {
  const user = useUser()
  const [allowances, setAllowances] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAllowances()
  }, [])

  async function loadAllowances() {
    setLoading(true)
    setError('')
    try {
      const result = await selfServiceApi.myAllowances()
      setAllowances(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatCurrency(amount) {
    if (amount == null) return '—'
    return `KES ${Number(amount).toLocaleString()}`
  }

  const totalMonthly = allowances?.allowances?.reduce((sum, a) => sum + Number(a.amount || 0), 0) || 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4" data-guide="my-allowances-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Allowances</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Your current monthly allowances
          </p>
        </div>
      </div>

      {/* Total Summary */}
      {allowances && !error && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-green-700 font-medium">Total Monthly Allowances</p>
          <p className="text-2xl font-bold text-green-800 mt-1">{formatCurrency(totalMonthly)}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadAllowances} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !allowances && <LoadingSpinner message="Loading allowances..." />}

      {/* Allowances Table */}
      {allowances && (
        <div className="bg-white rounded-xl border border-gray-200">
          {(!allowances.allowances || allowances.allowances.length === 0) ? (
            <EmptyState
              icon={Coins}
              title="No allowances found"
              message="You have no allowances assigned at this time"
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Allowance Name</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Amount</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Taxable</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Effective Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allowances.allowances.map((a, idx) => (
                      <tr key={a.id || idx} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">{a.name || a.allowance_name}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-gray-900">{formatCurrency(a.amount)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={a.taxable ? 'warning' : 'ok'}>
                            {a.taxable ? 'Yes' : 'No'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{formatDate(a.effective_date)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {allowances.allowances.map((a, idx) => (
                  <div key={a.id || idx} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{a.name || a.allowance_name}</span>
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(a.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={a.taxable ? 'warning' : 'ok'}>
                        {a.taxable ? 'Taxable' : 'Non-taxable'}
                      </Badge>
                      <span className="text-xs text-gray-400">{formatDate(a.effective_date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
