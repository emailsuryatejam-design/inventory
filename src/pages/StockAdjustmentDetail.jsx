import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUser, isManager } from '../context/AppContext'
import { stockAdjustments as adjApi } from '../services/api'
import { useToast } from '../components/ui/Toast'
import { ArrowLeft, Check, X, Loader2, ClipboardEdit } from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const TYPE_LABELS = {
  damage: 'Damage',
  expiry: 'Expiry',
  correction: 'Correction',
  write_off: 'Write Off',
  found: 'Found',
  transfer: 'Transfer',
}

const STATUS_VARIANTS = {
  draft: 'out',
  submitted: 'low',
  approved: 'ok',
  rejected: 'critical',
}

export default function StockAdjustmentDetail() {
  const { id } = useParams()
  const user = useUser()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => { loadAdjustment() }, [id])

  async function loadAdjustment() {
    setLoading(true)
    try {
      const result = await adjApi.get(id)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canApprove = isManager(user?.role) && data?.adjustment?.status === 'submitted'

  async function handleApprove() {
    if (!confirm('Approve this adjustment? Stock balances will be updated.')) return
    setProcessing(true)
    try {
      await adjApi.approve(id)
      toast.success('Adjustment approved — stock updated')
      loadAdjustment()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleReject() {
    if (!confirm('Reject this adjustment?')) return
    setProcessing(true)
    try {
      await adjApi.reject(id)
      toast.success('Adjustment rejected')
      loadAdjustment()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <LoadingSpinner message="Loading adjustment..." />
  if (error) return (
    <div className="text-center py-16">
      <p className="text-red-600 mb-4">{error}</p>
      <Link to="/app/stock-adjustments" className="text-green-600 font-medium">Back to Adjustments</Link>
    </div>
  )
  if (!data) return null

  const adj = data.adjustment
  const lines = data.lines || []

  const totalValueImpact = lines.reduce((sum, l) => sum + (l.value_impact || 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app/stock-adjustments" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-mono text-gray-400">{adj.adjustment_number}</span>
            <Badge variant={STATUS_VARIANTS[adj.status] || 'out'}>{adj.status}</Badge>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {TYPE_LABELS[adj.adjustment_type] || adj.adjustment_type} Adjustment
          </h1>
        </div>
        {canApprove && (
          <div className="flex items-center gap-2">
            <button onClick={handleReject} disabled={processing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50">
              {processing ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
              Reject
            </button>
            <button onClick={handleApprove} disabled={processing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
              {processing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Approve
            </button>
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-medium text-gray-500 mb-3">Details</h3>
          <div className="space-y-2">
            <InfoRow label="Type" value={TYPE_LABELS[adj.adjustment_type] || adj.adjustment_type} />
            <InfoRow label="Camp" value={adj.camp_name || adj.camp_code || '—'} />
            <InfoRow label="Created by" value={adj.created_by_name || '—'} />
            <InfoRow label="Created" value={formatDate(adj.created_at)} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-medium text-gray-500 mb-3">Approval</h3>
          <div className="space-y-2">
            <InfoRow label="Status" value={adj.status} />
            <InfoRow label="Approved by" value={adj.approved_by_name || '—'} />
            <InfoRow label="Approved at" value={adj.approved_at ? formatDate(adj.approved_at) : '—'} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-medium text-gray-500 mb-3">Summary</h3>
          <div className="space-y-2">
            <InfoRow label="Items" value={`${lines.length} line items`} />
            <InfoRow label="Total Value Impact"
              value={totalValueImpact !== 0 ? `TZS ${Math.round(Math.abs(totalValueImpact)).toLocaleString()}` : '—'}
              highlight={totalValueImpact < 0 ? 'red' : totalValueImpact > 0 ? 'green' : ''} />
          </div>
        </div>
      </div>

      {/* Reason */}
      {adj.reason && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h3 className="text-xs font-medium text-gray-500 mb-2">Reason</h3>
          <p className="text-sm text-gray-700">{adj.reason}</p>
        </div>
      )}

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardEdit size={18} />
            Adjustment Lines ({lines.length})
          </h2>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Item</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Current Qty</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Adjustment</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">New Qty</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Unit Cost</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Value Impact</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(line => (
                <tr key={line.id} className="border-b border-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/app/items/${line.item_id}`} className="text-sm font-medium text-gray-900 hover:text-green-600">
                      {line.item_name || line.item_code}
                    </Link>
                    <p className="text-xs text-gray-400">{line.item_code}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-600">{line.current_qty != null ? line.current_qty : '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-semibold ${
                      line.adjustment_qty < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {line.adjustment_qty > 0 ? '+' : ''}{line.adjustment_qty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-600">{line.new_qty != null ? line.new_qty : '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-500">
                      {line.unit_cost ? `TZS ${Math.round(line.unit_cost).toLocaleString()}` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-medium ${
                      (line.value_impact || 0) < 0 ? 'text-red-600' : (line.value_impact || 0) > 0 ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {line.value_impact ? `TZS ${Math.round(Math.abs(line.value_impact)).toLocaleString()}` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">{line.reason || '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden divide-y divide-gray-100">
          {lines.map(line => (
            <div key={line.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-sm font-medium text-gray-900">{line.item_name || line.item_code}</span>
                  <span className="text-xs text-gray-400 ml-2">{line.item_code}</span>
                </div>
                <span className={`text-sm font-semibold ${
                  line.adjustment_qty < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {line.adjustment_qty > 0 ? '+' : ''}{line.adjustment_qty}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {line.current_qty != null && <span>Current: {line.current_qty}</span>}
                {line.new_qty != null && <span>New: {line.new_qty}</span>}
                {line.value_impact && (
                  <span className={line.value_impact < 0 ? 'text-red-500' : 'text-green-500'}>
                    TZS {Math.round(Math.abs(line.value_impact)).toLocaleString()}
                  </span>
                )}
              </div>
              {line.reason && <p className="text-xs text-gray-500 mt-1">{line.reason}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, highlight }) {
  let colorClass = 'text-gray-700'
  if (highlight === 'red') colorClass = 'text-red-600 font-medium'
  if (highlight === 'green') colorClass = 'text-green-600 font-medium'

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-sm ${colorClass}`}>{value}</span>
    </div>
  )
}
