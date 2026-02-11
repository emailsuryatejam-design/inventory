import { useState } from 'react'
import { useUser, useSelectedCamp, isManager } from '../context/AppContext'
import { reports as reportsApi } from '../services/api'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const REPORT_TYPES = [
  { key: 'stock_summary', label: 'Stock Summary', desc: 'Stock levels and values by camp' },
  { key: 'movement_history', label: 'Movement History', desc: 'All stock movements in period' },
  { key: 'order_summary', label: 'Order Summary', desc: 'Orders overview by camp' },
  { key: 'consumption', label: 'Consumption', desc: 'Issue/consumption analysis' },
]

export default function Reports() {
  const user = useUser()
  const { camps } = useSelectedCamp()
  const [type, setType] = useState('stock_summary')
  const [campId, setCampId] = useState('')
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().slice(0, 10))
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function runReport() {
    setLoading(true)
    setError('')
    setData(null)
    try {
      const params = { date_from: dateFrom, date_to: dateTo }
      if (campId) params.camp_id = campId
      const res = await reportsApi.get(type, params)
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Reports</h1>

      {/* Filters */}
      <div data-guide="report-filters" className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Report Type</label>
            <select
              data-guide="report-type-select"
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {REPORT_TYPES.map(r => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Camp</label>
            <select
              value={campId}
              onChange={e => setCampId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Camps</option>
              {camps?.map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runReport}
              disabled={loading}
              data-guide="report-generate-btn"
              className="w-full bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      {loading && <LoadingSpinner message="Generating report..." />}

      {/* Results */}
      {data && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">
              {REPORT_TYPES.find(r => r.key === data.report_type)?.label}
            </h2>
            <span className="text-xs text-gray-500">
              {data.period?.from} to {data.period?.to}
            </span>
          </div>

          {data.data?.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No data found for selected period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {Object.keys(data.data[0] || {}).map(key => (
                      <th key={key} className="text-left text-xs font-medium text-gray-500 pb-2 px-2 whitespace-nowrap">
                        {key.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="py-2 px-2 whitespace-nowrap">
                          {typeof val === 'number'
                            ? Number(val).toLocaleString()
                            : val || '-'
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 text-xs text-gray-400">
            {data.data?.length} rows
          </div>
        </div>
      )}
    </div>
  )
}
