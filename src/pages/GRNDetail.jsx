import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUser, isManager } from '../context/AppContext'
import { grn as grnApi } from '../services/api'
import { useToast } from '../components/ui/Toast'
import {
  ArrowLeft, Check, Clock, Loader2, Building2, FileText, PackageCheck, Truck
} from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const STATUS_COLORS = {
  draft: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
}

export default function GRNDetail() {
  const { id } = useParams()
  const user = useUser()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    loadGRN()
  }, [id])

  async function loadGRN() {
    setLoading(true)
    try {
      const result = await grnApi.get(id)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const g = data?.grn
  const lines = data?.lines || []
  const canConfirm = g?.status === 'draft' && (isManager(user?.role) || ['procurement_officer', 'camp_storekeeper'].includes(user?.role))

  async function handleConfirm() {
    setConfirming(true)
    setError('')
    try {
      await grnApi.confirm(id)
      toast.success('GRN confirmed — stock updated')
      await loadGRN()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirming(false)
    }
  }

  function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatDateTime(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  function formatCurrency(v) {
    if (v == null) return '—'
    return `KES ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  if (loading) return <LoadingSpinner message="Loading GRN..." />

  if (error && !data) return (
    <div className="text-center py-16">
      <p className="text-red-600 mb-4">{error}</p>
      <Link to="/app/grn" className="text-green-600 font-medium">Back to GRNs</Link>
    </div>
  )

  if (!g) return null

  const totalReceived = lines.reduce((sum, l) => sum + Number(l.received_qty || 0), 0)
  const totalRejected = lines.reduce((sum, l) => sum + Number(l.rejected_qty || 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app/grn" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-mono text-gray-400">{g.grn_number}</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[g.status] || 'bg-gray-100 text-gray-600'}`}>
              {g.status}
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{g.supplier_name}</h1>
        </div>

        {canConfirm && (
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition"
          >
            {confirming ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Confirm & Update Stock
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400">Line Items</p>
                <p className="text-lg font-bold text-gray-900">{lines.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Received</p>
                <p className="text-lg font-bold text-green-700">{totalReceived}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Rejected</p>
                <p className={`text-lg font-bold ${totalRejected > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {totalRejected}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Value</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(g.total_value)}</p>
              </div>
            </div>
          </div>

          {/* Lines */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Received Items</h2>
            </div>

            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Item</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Ordered</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Received</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Rejected</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Unit Cost</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(line => (
                    <tr key={line.id} className="border-b border-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/app/items/${line.item_id}`} className="text-sm font-medium text-gray-900 hover:text-green-600">
                          {line.item_name}
                        </Link>
                        <p className="text-xs text-gray-400">
                          {line.item_code}
                          {line.batch_number && ` · Batch: ${line.batch_number}`}
                          {line.expiry_date && ` · Exp: ${formatDate(line.expiry_date)}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-500">{line.ordered_qty || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-green-700">{line.received_qty}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {Number(line.rejected_qty) > 0 ? (
                          <div>
                            <span className="text-sm font-semibold text-red-600">{line.rejected_qty}</span>
                            {line.rejection_reason && (
                              <p className="text-xs text-red-400 mt-0.5">{line.rejection_reason}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-600">{formatCurrency(line.unit_cost)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(line.line_total)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-gray-100">
              {lines.map(line => (
                <div key={line.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{line.item_name}</p>
                      <p className="text-xs text-gray-400">{line.item_code}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(line.line_total)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs">
                    <span className="text-gray-500">Ordered: {line.ordered_qty || '—'}</span>
                    <span className="text-green-700 font-medium">Rcvd: {line.received_qty}</span>
                    {Number(line.rejected_qty) > 0 && (
                      <span className="text-red-600 font-medium">Rej: {line.rejected_qty}</span>
                    )}
                  </div>
                  {line.batch_number && (
                    <p className="text-xs text-gray-400 mt-1">Batch: {line.batch_number}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* PO Link */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText size={16} /> Purchase Order
            </h3>
            <Link
              to={`/app/purchase-orders/${g.po_id}`}
              className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
            >
              <FileText size={18} className="text-blue-600" />
              <span className="text-sm font-mono font-medium text-blue-700">{g.po_number}</span>
            </Link>
          </div>

          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Building2 size={16} /> Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Supplier</span>
                <span className="text-gray-900 font-medium">{g.supplier_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Camp</span>
                <span className="text-gray-900 font-medium">{g.camp_name || g.camp_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Received Date</span>
                <span className="text-gray-900 font-medium">{formatDate(g.received_date)}</span>
              </div>
              {g.delivery_note_ref && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery Note</span>
                  <span className="text-gray-900 font-medium">{g.delivery_note_ref}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock size={16} /> Timeline
            </h3>
            <div className="space-y-3">
              <TimelineItem label="Created" date={g.created_at} by={g.received_by_name} />
              {g.confirmed_at && <TimelineItem label="Confirmed" date={g.confirmed_at} by={g.confirmed_by_name} />}
            </div>
          </div>

          {/* Notes */}
          {g.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
              <p className="text-sm text-gray-600">{g.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TimelineItem({ label, date, by }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">
          {date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
          {by && ` · ${by}`}
        </p>
      </div>
    </div>
  )
}
