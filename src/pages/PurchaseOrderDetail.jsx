import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useUser, isManager } from '../context/AppContext'
import { purchaseOrders as poApi } from '../services/api'
import { useToast } from '../components/ui/Toast'
import {
  ArrowLeft, Check, X, Send, Clock, Loader2,
  Building2, FileText, PackagePlus, Ban, Truck
} from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  sent: 'bg-indigo-100 text-indigo-700',
  partial_received: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

function POBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  )
}

export default function PurchaseOrderDetail() {
  const { id } = useParams()
  const user = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState('')

  useEffect(() => {
    loadPO()
  }, [id])

  async function loadPO() {
    setLoading(true)
    try {
      const result = await poApi.get(id)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const po = data?.purchase_order
  const lines = data?.lines || []
  const grns = data?.grns || []
  const canApprove = isManager(user?.role) && po?.status === 'submitted'
  const canSend = po?.status === 'approved'
  const canCancel = po?.status && ['draft', 'submitted'].includes(po.status)
  const canCreateGRN = po?.status && ['sent', 'partial_received', 'approved'].includes(po.status)

  async function handleAction(action) {
    setActionLoading(action)
    setError('')
    try {
      if (action === 'approve') {
        await poApi.approve(id)
        toast.success('Purchase order approved')
      } else if (action === 'send') {
        await poApi.send(id)
        toast.success('Purchase order marked as sent')
      } else if (action === 'cancel') {
        await poApi.cancel(id)
        toast.warning('Purchase order cancelled')
      }
      await loadPO()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatDateTime(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function formatCurrency(v) {
    if (v == null) return '—'
    return `KES ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  if (loading) return <LoadingSpinner message="Loading purchase order..." />

  if (error && !data) return (
    <div className="text-center py-16">
      <p className="text-red-600 mb-4">{error}</p>
      <Link to="/app/purchase-orders" className="text-green-600 font-medium">Back to Purchase Orders</Link>
    </div>
  )

  if (!po) return null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app/purchase-orders" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-mono text-gray-400">{po.po_number}</span>
            <POBadge status={po.status} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{po.supplier_name}</h1>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {canCreateGRN && (
            <Link
              to={`/app/grn/new?po_id=${po.id}`}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
            >
              <PackagePlus size={16} />
              <span className="hidden sm:inline">Create GRN</span>
            </Link>
          )}
          {canApprove && (
            <button
              onClick={() => handleAction('approve')}
              disabled={!!actionLoading}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
            >
              {actionLoading === 'approve' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Approve
            </button>
          )}
          {canSend && (
            <button
              onClick={() => handleAction('send')}
              disabled={!!actionLoading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
            >
              {actionLoading === 'send' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Mark Sent
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => handleAction('cancel')}
              disabled={!!actionLoading}
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2.5 rounded-lg text-sm font-medium transition"
            >
              {actionLoading === 'cancel' ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
              Cancel
            </button>
          )}
        </div>
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
          {/* Summary Cards */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400">Items</p>
                <p className="text-lg font-bold text-gray-900">{lines.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Subtotal</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(po.subtotal)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Tax</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(po.tax_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Grand Total</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(po.grand_total)}</p>
              </div>
            </div>
          </div>

          {/* Order Lines */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">PO Lines</h2>
            </div>

            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Item</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Qty</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Unit Price</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Tax</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Total</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(line => {
                    const pct = line.quantity > 0 ? Math.round((line.received_qty / line.quantity) * 100) : 0
                    return (
                      <tr key={line.id} className="border-b border-gray-50">
                        <td className="px-4 py-3">
                          <Link to={`/app/items/${line.item_id}`} className="text-sm font-medium text-gray-900 hover:text-green-600">
                            {line.item_name}
                          </Link>
                          <p className="text-xs text-gray-400">{line.item_code}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-semibold text-gray-900">{line.quantity}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-600">{formatCurrency(line.unit_price)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-500">{line.tax_rate}%</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-gray-900">{formatCurrency(line.line_total)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-semibold ${
                            pct >= 100 ? 'text-green-600' : pct > 0 ? 'text-amber-600' : 'text-gray-400'
                          }`}>
                            {line.received_qty || 0}
                          </span>
                          {line.quantity > 0 && (
                            <span className="text-xs text-gray-400 ml-1">({pct}%)</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-gray-100">
              {lines.map(line => {
                const pct = line.quantity > 0 ? Math.round((line.received_qty / line.quantity) * 100) : 0
                return (
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
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                      <span>Qty: {line.quantity}</span>
                      <span>@ {formatCurrency(line.unit_price)}</span>
                      <span className={pct >= 100 ? 'text-green-600 font-medium' : pct > 0 ? 'text-amber-600 font-medium' : ''}>
                        Rcvd: {line.received_qty || 0} ({pct}%)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Linked GRNs */}
          {grns.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Goods Received Notes</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {grns.map(g => (
                  <Link
                    key={g.id}
                    to={`/app/grn/${g.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Truck size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-medium text-gray-900">{g.grn_number}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(g.received_date)} · {g.status}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(g.total_value)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Supplier Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Building2 size={16} /> Supplier
            </h3>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">{po.supplier_name}</p>
              {po.supplier_code && (
                <p className="text-xs text-gray-400">{po.supplier_code}</p>
              )}
              <div className="pt-2 space-y-1.5 text-xs text-gray-500">
                <p>Payment Terms: <span className="text-gray-900 font-medium">{po.payment_terms || 30} days</span></p>
                <p>Currency: <span className="text-gray-900 font-medium">{po.currency || 'KES'}</span></p>
                {po.delivery_date && (
                  <p>Delivery Date: <span className="text-gray-900 font-medium">{formatDate(po.delivery_date)}</span></p>
                )}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock size={16} /> Timeline
            </h3>
            <div className="space-y-3">
              <TimelineItem label="Created" date={po.created_at} by={po.created_by_name} />
              {po.approved_at && <TimelineItem label="Approved" date={po.approved_at} by={po.approved_by_name} />}
              {po.sent_at && <TimelineItem label="Sent to Supplier" date={po.sent_at} />}
            </div>
          </div>

          {/* Notes */}
          {po.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
              <p className="text-sm text-gray-600">{po.notes}</p>
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
