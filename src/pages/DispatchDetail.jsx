import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { dispatch as dispatchApi } from '../services/api'
import { ArrowLeft, Truck, Package, MapPin, Hash } from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value || '—'}</span>
    </div>
  )
}

export default function DispatchDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDispatch()
  }, [id])

  async function loadDispatch() {
    setLoading(true)
    setError('')
    try {
      const result = await dispatchApi.get(id)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatValue(v) {
    if (!v && v !== 0) return '—'
    return `TZS ${Math.round(v).toLocaleString()}`
  }

  if (loading) return <LoadingSpinner message="Loading dispatch..." />

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={loadDispatch} className="ml-2 underline">Retry</button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { dispatch, lines } = data

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app/dispatch" className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900 font-mono">{dispatch.dispatch_number}</h1>
            <Badge variant={dispatch.status} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {dispatch.camp_name} · {formatDate(dispatch.dispatched_at)}
          </p>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <Package size={18} className="text-gray-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{dispatch.total_items}</p>
              <p className="text-xs text-gray-500">Items</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <Hash size={18} className="text-gray-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-gray-900 font-mono">{dispatch.order_number}</p>
              <p className="text-xs text-gray-500">Order</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <MapPin size={18} className="text-gray-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-gray-900">{dispatch.camp_code}</p>
              <p className="text-xs text-gray-500">Destination</p>
            </div>
          </div>

          {/* Dispatch Lines */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Dispatch Items ({lines.length})</h2>
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Item</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 py-2">Requested</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 py-2">Approved</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 py-2">Dispatched</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Unit Cost</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(line => (
                    <tr key={line.id} className="border-b border-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium text-gray-900">{line.item_name}</p>
                        <p className="text-xs text-gray-400">{line.item_code} · {line.uom}</p>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-sm text-gray-500">{line.requested_qty ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-sm text-gray-500">{line.approved_qty ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-sm font-semibold text-gray-900">{line.dispatched_qty}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-sm text-gray-500">{formatValue(line.unit_cost)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-sm font-medium text-gray-900">{formatValue(line.line_value)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={5} className="px-4 py-2.5 text-right text-sm font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-900">{formatValue(dispatch.total_value)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {lines.map(line => (
                <div key={line.id} className="px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{line.item_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{line.item_code} · {line.uom}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-semibold text-gray-900">{line.dispatched_qty}</p>
                      <p className="text-xs text-gray-500">{formatValue(line.line_value)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {/* Total bar */}
              <div className="px-4 py-3 bg-gray-50 flex justify-between">
                <span className="text-sm font-semibold text-gray-700">Total</span>
                <span className="text-sm font-bold text-gray-900">{formatValue(dispatch.total_value)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel — Info */}
        <div className="mt-4 lg:mt-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Dispatch Details</h3>
            <InfoRow label="Dispatch #" value={dispatch.dispatch_number} />
            <InfoRow label="Status" value={<Badge variant={dispatch.status} />} />
            <InfoRow label="Destination" value={`${dispatch.camp_code} — ${dispatch.camp_name}`} />
            <InfoRow label="Dispatched By" value={dispatch.dispatched_by} />
            <InfoRow label="Dispatch Date" value={formatDate(dispatch.dispatched_at)} />
            <InfoRow label="Vehicle" value={dispatch.vehicle_number} />
            <InfoRow
              label="Order"
              value={
                <Link to={`/app/orders/${dispatch.order_id}`} className="text-blue-600 hover:text-blue-800 font-mono">
                  {dispatch.order_number}
                </Link>
              }
            />
            {dispatch.notes && (
              <div className="pt-2">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2">{dispatch.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
