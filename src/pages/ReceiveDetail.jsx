import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUser } from '../context/AppContext'
import { receive as receiveApi } from '../services/api'
import {
  ArrowLeft, Check, PackageCheck, Loader2, AlertTriangle
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function ReceiveDetail() {
  const { id } = useParams()
  const user = useUser()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Confirm state
  const [confirming, setConfirming] = useState(false)
  const [lineInputs, setLineInputs] = useState({})
  const [confirmNotes, setConfirmNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadReceipt()
  }, [id])

  async function loadReceipt() {
    setLoading(true)
    try {
      const result = await receiveApi.get(id)
      setData(result)
      // Initialize line inputs
      const inputs = {}
      result.lines.forEach(l => {
        inputs[l.id] = {
          received_qty: l.received_qty !== null ? l.received_qty : l.dispatched_qty,
          condition_status: l.condition_status || 'good',
          notes: l.notes || '',
        }
      })
      setLineInputs(inputs)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function setLineInput(lineId, field, value) {
    setLineInputs(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: value }
    }))
  }

  async function handleConfirm() {
    setSubmitting(true)
    setError('')
    try {
      const lines = Object.entries(lineInputs).map(([lineId, input]) => ({
        line_id: parseInt(lineId),
        received_qty: parseFloat(input.received_qty) || 0,
        condition_status: input.condition_status,
        notes: input.notes || null,
      }))
      await receiveApi.confirm(id, lines)
      setConfirming(false)
      await loadReceipt()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function acceptAllDispatched() {
    const inputs = {}
    data.lines.forEach(l => {
      inputs[l.id] = {
        received_qty: l.dispatched_qty,
        condition_status: 'good',
        notes: '',
      }
    })
    setLineInputs(inputs)
  }

  if (loading) return <LoadingSpinner message="Loading receipt..." />

  if (error && !data) return (
    <div className="text-center py-16">
      <p className="text-red-600 mb-4">{error}</p>
      <Link to="/app/receive" className="text-green-600 font-medium">Back to Receipts</Link>
    </div>
  )

  if (!data) return null

  const receipt = data.receipt
  const isConfirmed = receipt.status === 'confirmed'
  const canConfirm = !isConfirmed && ['camp_storekeeper', 'camp_manager', 'stores_manager', 'admin'].includes(user?.role)

  const formatValue = (v) => v ? `TZS ${Math.round(v).toLocaleString()}` : '—'
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app/receive" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-mono text-gray-400">{receipt.receipt_number}</span>
            <Badge variant={receipt.status} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{receipt.camp_name}</h1>
        </div>
        {canConfirm && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
          >
            <PackageCheck size={18} />
            Confirm Receipt
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError('')} className="ml-auto underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400">Items</p>
                <p className="text-lg font-bold text-gray-900">{data.lines.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Value</p>
                <p className="text-lg font-bold text-gray-900">{formatValue(receipt.total_value)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Dispatch</p>
                <p className="text-sm text-gray-700 font-mono">{receipt.dispatch_number || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Received</p>
                <p className="text-sm text-gray-700">{formatDate(receipt.received_date || receipt.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Receipt Lines */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Receipt Lines</h2>
              {confirming && (
                <button
                  onClick={acceptAllDispatched}
                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  Accept all as dispatched
                </button>
              )}
            </div>

            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Item</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Dispatched</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Received</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Unit Cost</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Value</th>
                    {confirming && <th className="text-center text-xs font-medium text-gray-500 px-4 py-2">Condition</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map(line => (
                    <tr key={line.id} className="border-b border-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/app/items/${line.item_id}`} className="text-sm font-medium text-gray-900 hover:text-green-600">
                          {line.item_name}
                        </Link>
                        <p className="text-xs text-gray-400">{line.item_code} · {line.uom}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-900">{line.dispatched_qty}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {confirming ? (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setLineInput(line.id, 'received_qty', Math.max(0, parseFloat(lineInputs[line.id]?.received_qty || 0) - 1))}
                              className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-xs">−</button>
                            <span className="w-12 text-center text-sm font-bold">{lineInputs[line.id]?.received_qty ?? ''}</span>
                            <button type="button" onClick={() => setLineInput(line.id, 'received_qty', parseFloat(lineInputs[line.id]?.received_qty || 0) + 1)}
                              className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-xs">+</button>
                          </div>
                        ) : (
                          <span className={`text-sm font-semibold ${
                            line.received_qty !== null && line.received_qty < line.dispatched_qty
                              ? 'text-amber-600' : 'text-green-600'
                          }`}>
                            {line.received_qty !== null ? line.received_qty : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-500">{formatValue(line.unit_cost)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-600">{formatValue(line.total_value)}</span>
                      </td>
                      {confirming && (
                        <td className="px-4 py-3 text-center">
                          <select
                            value={lineInputs[line.id]?.condition_status || 'good'}
                            onChange={(e) => setLineInput(line.id, 'condition_status', e.target.value)}
                            className="text-xs px-2 py-1 border border-gray-300 rounded-lg"
                          >
                            <option value="good">Good</option>
                            <option value="damaged">Damaged</option>
                            <option value="short">Short</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-gray-100">
              {data.lines.map(line => (
                <div key={line.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{line.item_name}</p>
                      <p className="text-xs text-gray-400">{line.item_code} · {line.uom}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">Dispatched: {line.dispatched_qty}</p>
                      {!confirming && (
                        <p className={`text-sm font-bold ${
                          line.received_qty !== null && line.received_qty < line.dispatched_qty
                            ? 'text-amber-600' : 'text-green-600'
                        }`}>
                          Received: {line.received_qty !== null ? line.received_qty : '—'}
                        </p>
                      )}
                    </div>
                  </div>
                  {confirming && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setLineInput(line.id, 'received_qty', Math.max(0, parseFloat(lineInputs[line.id]?.received_qty || 0) - 1))}
                          className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-xs">−</button>
                        <span className="w-12 text-center text-sm font-bold">{lineInputs[line.id]?.received_qty ?? ''}</span>
                        <button type="button" onClick={() => setLineInput(line.id, 'received_qty', parseFloat(lineInputs[line.id]?.received_qty || 0) + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-xs">+</button>
                      </div>
                      <select
                        value={lineInputs[line.id]?.condition_status || 'good'}
                        onChange={(e) => setLineInput(line.id, 'condition_status', e.target.value)}
                        className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg"
                      >
                        <option value="good">Good</option>
                        <option value="damaged">Damaged</option>
                        <option value="short">Short</option>
                      </select>
                    </div>
                  )}
                  {line.notes && (
                    <p className="text-xs text-gray-400 mt-1 italic">{line.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Confirm Actions */}
          {confirming && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <textarea
                value={confirmNotes}
                onChange={(e) => setConfirmNotes(e.target.value)}
                placeholder="Receipt notes (optional)..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none mb-3"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
                >
                  {submitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Confirming...</>
                  ) : (
                    <><Check size={16} /> Confirm Receipt</>
                  )}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Receipt Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Receipt Info</h3>
            <div className="space-y-3">
              <InfoRow label="Camp" value={`${receipt.camp_code} — ${receipt.camp_name}`} />
              <InfoRow label="Dispatch #" value={receipt.dispatch_number || '—'} />
              {receipt.order_number && (
                <InfoRow
                  label="Order #"
                  value={
                    <Link to={`/app/orders/${receipt.order_id}`} className="text-green-600 hover:underline font-mono text-sm">
                      {receipt.order_number}
                    </Link>
                  }
                />
              )}
              <InfoRow label="Received By" value={receipt.received_by || '—'} />
              <InfoRow label="Dispatched By" value={receipt.dispatched_by || '—'} />
              <InfoRow label="Status" value={<Badge variant={receipt.status} />} />
              <InfoRow label="Date" value={formatDate(receipt.received_date || receipt.created_at)} />
            </div>
            {receipt.notes && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{receipt.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  )
}
