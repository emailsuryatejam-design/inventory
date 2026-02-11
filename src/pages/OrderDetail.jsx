import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUser, isManager } from '../context/AppContext'
import { orders as ordersApi } from '../services/api'
import {
  ArrowLeft, Check, X, MessageSquare, AlertTriangle,
  Clock, Loader2, Send
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function OrderDetail() {
  const { id } = useParams()
  const user = useUser()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Review state
  const [reviewing, setReviewing] = useState(false)
  const [lineActions, setLineActions] = useState({})
  const [reviewNotes, setReviewNotes] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Query state
  const [queryMessage, setQueryMessage] = useState('')
  const [sendingQuery, setSendingQuery] = useState(false)

  useEffect(() => {
    loadOrder()
  }, [id])

  async function loadOrder() {
    setLoading(true)
    try {
      const result = await ordersApi.get(id)
      setData(result)
      // Initialize line actions
      const actions = {}
      result.lines.forEach(l => { actions[l.id] = { action: 'approved', approved_qty: l.requested_qty, note: '' } })
      setLineActions(actions)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canReview = isManager(user?.role) && data?.order?.status &&
    ['submitted', 'pending_review', 'queried'].includes(data.order.status)

  function setLineAction(lineId, field, value) {
    setLineActions(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: value }
    }))
  }

  async function handleApproveAll() {
    setSubmittingReview(true)
    try {
      const lines = data.lines.map(l => ({
        line_id: l.id,
        action: 'approved',
      }))
      await ordersApi.approve(id, lines)
      await loadOrder()
      setReviewing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmittingReview(false)
    }
  }

  async function handleRejectAll() {
    if (!reviewNotes.trim()) {
      setError('Please provide a reason for rejection')
      return
    }
    setSubmittingReview(true)
    try {
      await ordersApi.reject(id, reviewNotes)
      await loadOrder()
      setReviewing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmittingReview(false)
    }
  }

  async function handleSubmitReview() {
    setSubmittingReview(true)
    try {
      const lines = Object.entries(lineActions).map(([lineId, action]) => ({
        line_id: parseInt(lineId),
        action: action.action,
        approved_qty: action.action === 'adjusted' ? action.approved_qty : undefined,
        note: action.note || undefined,
      }))
      await ordersApi.approve(id, lines)
      await loadOrder()
      setReviewing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmittingReview(false)
    }
  }

  async function handleSendQuery() {
    if (!queryMessage.trim()) return
    setSendingQuery(true)
    try {
      await ordersApi.query(id, queryMessage)
      setQueryMessage('')
      await loadOrder()
    } catch (err) {
      setError(err.message)
    } finally {
      setSendingQuery(false)
    }
  }

  if (loading) return <LoadingSpinner message="Loading order..." />

  if (error && !data) return (
    <div className="text-center py-16">
      <p className="text-red-600 mb-4">{error}</p>
      <Link to="/app/orders" className="text-green-600 font-medium">Back to Orders</Link>
    </div>
  )

  if (!data) return null

  const order = data.order
  const formatValue = (v) => v ? `TZS ${Math.round(v).toLocaleString()}` : '—'
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app/orders" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-mono text-gray-400">{order.order_number}</span>
            <Badge variant={order.status} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{order.camp_name}</h1>
        </div>
        {canReview && !reviewing && (
          <button
            onClick={() => setReviewing(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
          >
            Review Order
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
        {/* Order Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400">Items</p>
                <p className="text-lg font-bold text-gray-900">{order.total_items}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Value</p>
                <p className="text-lg font-bold text-gray-900">{formatValue(order.total_value)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Flagged</p>
                <p className={`text-lg font-bold ${order.flagged_items > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {order.flagged_items}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Created</p>
                <p className="text-sm text-gray-700">{formatDate(order.created_at)}</p>
                <p className="text-xs text-gray-400">by {order.created_by}</p>
              </div>
            </div>
            {order.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Order Lines */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Order Lines</h2>
            </div>

            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Item</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Req</th>
                    {order.status !== 'submitted' && order.status !== 'draft' && (
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Approved</th>
                    )}
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Camp Stock</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">HO Stock</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 py-2">Status</th>
                    {reviewing && <th className="text-center text-xs font-medium text-gray-500 px-4 py-2">Action</th>}
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
                        <span className="text-sm font-semibold text-gray-900">{line.requested_qty}</span>
                      </td>
                      {order.status !== 'submitted' && order.status !== 'draft' && (
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-semibold ${
                            line.stores_action === 'rejected' ? 'text-red-600' :
                            line.stores_action === 'adjusted' ? 'text-amber-600' : 'text-green-600'
                          }`}>
                            {line.approved_qty ?? '—'}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-500">{line.camp_stock}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm ${line.ho_stock <= 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {line.ho_stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={line.validation_status === 'flagged' ? 'danger' : line.validation_status === 'review' ? 'warning' : 'success'}>
                          {line.validation_status}
                        </Badge>
                        {line.validation_note && (
                          <p className="text-xs text-gray-400 mt-0.5" title={line.validation_note}>
                            <AlertTriangle size={10} className="inline" /> {line.validation_note.substring(0, 30)}...
                          </p>
                        )}
                      </td>
                      {reviewing && (
                        <td className="px-4 py-3">
                          <select
                            value={lineActions[line.id]?.action || 'approved'}
                            onChange={(e) => setLineAction(line.id, 'action', e.target.value)}
                            className="text-xs px-2 py-1 border border-gray-300 rounded-lg"
                          >
                            <option value="approved">Approve</option>
                            <option value="adjusted">Adjust</option>
                            <option value="rejected">Reject</option>
                          </select>
                          {lineActions[line.id]?.action === 'adjusted' && (
                            <input
                              type="number"
                              value={lineActions[line.id]?.approved_qty || ''}
                              onChange={(e) => setLineAction(line.id, 'approved_qty', parseFloat(e.target.value) || 0)}
                              className="w-16 text-xs px-2 py-1 border border-gray-300 rounded-lg mt-1"
                              min="0"
                              placeholder="Qty"
                            />
                          )}
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
                      <p className="text-sm font-bold text-gray-900">x{line.requested_qty}</p>
                      {line.approved_qty != null && line.approved_qty !== line.requested_qty && (
                        <p className="text-xs text-amber-600">→ {line.approved_qty}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={line.validation_status === 'flagged' ? 'danger' : line.validation_status === 'review' ? 'warning' : 'success'}>
                      {line.validation_status}
                    </Badge>
                    <span className="text-xs text-gray-400">Camp: {line.camp_stock}</span>
                    <span className="text-xs text-gray-400">HO: {line.ho_stock}</span>
                  </div>
                  {reviewing && (
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={lineActions[line.id]?.action || 'approved'}
                        onChange={(e) => setLineAction(line.id, 'action', e.target.value)}
                        className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg"
                      >
                        <option value="approved">Approve</option>
                        <option value="adjusted">Adjust</option>
                        <option value="rejected">Reject</option>
                      </select>
                      {lineActions[line.id]?.action === 'adjusted' && (
                        <input
                          type="number"
                          value={lineActions[line.id]?.approved_qty || ''}
                          onChange={(e) => setLineAction(line.id, 'approved_qty', parseFloat(e.target.value) || 0)}
                          className="w-20 text-xs px-2 py-1.5 border border-gray-300 rounded-lg"
                          min="0"
                          placeholder="New Qty"
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Review Actions */}
          {reviewing && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Review notes (required for rejection)..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none mb-3"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleApproveAll}
                  disabled={submittingReview}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  <Check size={16} /> Approve All
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={submittingReview}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  {submittingReview ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Submit Review
                </button>
                <button
                  onClick={handleRejectAll}
                  disabled={submittingReview}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  <X size={16} /> Reject All
                </button>
                <button
                  onClick={() => setReviewing(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock size={16} /> Timeline
            </h3>
            <div className="space-y-3">
              <TimelineItem label="Created" date={order.created_at} by={order.created_by} />
              {order.submitted_at && <TimelineItem label="Submitted" date={order.submitted_at} />}
              {order.stores_reviewed_at && (
                <TimelineItem label="Reviewed" date={order.stores_reviewed_at} by={order.stores_manager} />
              )}
              {order.stores_notes && (
                <div className="ml-5 pl-3 border-l-2 border-gray-200">
                  <p className="text-xs text-gray-500 italic">{order.stores_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Messages / Queries */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MessageSquare size={16} /> Messages
            </h3>
            {data.queries.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">No messages</p>
            ) : (
              <div className="space-y-3 mb-3">
                {data.queries.map(q => (
                  <div key={q.id} className={`rounded-lg p-3 text-sm ${
                    q.sender_role === 'stores_manager' || q.sender_role === 'director'
                      ? 'bg-blue-50 text-blue-900'
                      : 'bg-gray-50 text-gray-700'
                  }`}>
                    <p className="font-medium text-xs mb-1">{q.sender} · {q.sender_role?.replace(/_/g, ' ')}</p>
                    <p>{q.message}</p>
                    <p className="text-xs opacity-60 mt-1">
                      {new Date(q.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {/* Send Message */}
            <div className="flex gap-2">
              <input
                type="text"
                value={queryMessage}
                onChange={(e) => setQueryMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleSendQuery()}
              />
              <button
                onClick={handleSendQuery}
                disabled={sendingQuery || !queryMessage.trim()}
                className="p-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg transition"
              >
                {sendingQuery ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
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
