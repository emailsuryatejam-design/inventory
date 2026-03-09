import { useState, useEffect } from 'react'
import { useUser, isManager } from '../context/AppContext'
import { kitchenRequisitions } from '../services/api'
import {
  PackageCheck, AlertTriangle, X, Loader2, ChevronDown,
  ChevronUp, CheckCircle2, AlertOctagon, Truck
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

export default function KitchenReceiveSupply() {
  const user = useUser()
  const canConfirm = isManager(user?.role) || user?.role === 'chef'

  const [requisitions, setRequisitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expandedReq, setExpandedReq] = useState(null)
  const [receivedQtys, setReceivedQtys] = useState({}) // { `${reqId}-${lineId}`: qty }
  const [confirmingId, setConfirmingId] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const data = await kitchenRequisitions.list(null, null, 'fulfilled')
      const reqs = data.requisitions || []
      setRequisitions(reqs)

      // Initialize received quantities from fulfilled quantities
      const initial = {}
      for (const req of reqs) {
        for (const line of (req.lines || [])) {
          const key = `${req.id}-${line.id}`
          initial[key] = line.received_qty != null
            ? String(line.received_qty)
            : String(line.fulfilled_qty || 0)
        }
      }
      setReceivedQtys(initial)

      // Auto-expand first requisition
      if (reqs.length > 0 && !expandedReq) {
        setExpandedReq(reqs[0].id)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleReceivedChange(reqId, lineId, value) {
    const key = `${reqId}-${lineId}`
    setReceivedQtys(prev => ({ ...prev, [key]: value }))
  }

  function toggleExpand(reqId) {
    setExpandedReq(prev => prev === reqId ? null : reqId)
  }

  function hasDispute(reqId) {
    const req = requisitions.find(r => r.id === reqId)
    if (!req) return false
    for (const line of (req.lines || [])) {
      const key = `${reqId}-${line.id}`
      const received = parseFloat(receivedQtys[key]) || 0
      const fulfilled = parseFloat(line.fulfilled_qty) || 0
      if (received !== fulfilled) return true
    }
    return false
  }

  function lineHasDispute(reqId, line) {
    const key = `${reqId}-${line.id}`
    const received = parseFloat(receivedQtys[key]) || 0
    const fulfilled = parseFloat(line.fulfilled_qty) || 0
    return received !== fulfilled
  }

  async function handleConfirmReceipt(reqId) {
    setConfirmingId(reqId)
    setError('')
    setSuccess('')
    try {
      const req = requisitions.find(r => r.id === reqId)
      const lines = (req?.lines || []).map(line => {
        const key = `${reqId}-${line.id}`
        return {
          line_id: line.id,
          received_qty: parseFloat(receivedQtys[key]) || 0,
        }
      })

      await kitchenRequisitions.confirmReceipt(reqId, lines)
      setSuccess(`Receipt confirmed for requisition #${reqId}${hasDispute(reqId) ? ' (disputes flagged)' : ''}`)
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirmingId(null)
    }
  }

  // Count disputes across all requisitions
  const totalDisputes = requisitions.reduce((count, req) => {
    for (const line of (req.lines || [])) {
      if (lineHasDispute(req.id, line)) count++
    }
    return count
  }, 0)

  return (
    <div data-guide="nav-receive-supply">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Truck size={22} className="text-blue-600" />
            Receive Supply
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Confirm received quantities from fulfilled requisitions
          </p>
        </div>
        {totalDisputes > 0 && (
          <Badge variant="warning">
            {totalDisputes} mismatch{totalDisputes !== 1 ? 'es' : ''}
          </Badge>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')}><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading fulfilled requisitions..." />
      ) : requisitions.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="No supplies to receive"
          message="All fulfilled requisitions have been confirmed. Check back later."
        />
      ) : (
        <div className="space-y-3">
          {requisitions.map(req => {
            const isExpanded = expandedReq === req.id
            const reqHasDispute = hasDispute(req.id)
            const isConfirming = confirmingId === req.id

            return (
              <div
                key={req.id}
                className={`bg-white rounded-xl border overflow-hidden transition ${
                  reqHasDispute ? 'border-amber-300' : 'border-gray-200'
                }`}
              >
                {/* Requisition header - collapsible */}
                <button
                  onClick={() => toggleExpand(req.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-left min-w-0">
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        Requisition #{req.id}
                        {reqHasDispute && (
                          <span data-guide="receive-flag-dispute">
                            <Badge variant="warning">Dispute</Badge>
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {req.kitchen_name || 'Kitchen'} &middot; {req.meal_type || 'N/A'} &middot; {req.date || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={req.status}>{req.status}</Badge>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Expanded line items */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_70px_80px_40px] gap-2 px-4 py-2 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      <span>Item</span>
                      <span className="text-center">Fulfilled</span>
                      <span className="text-center">Received</span>
                      <span className="text-center"></span>
                    </div>

                    {/* Line items */}
                    {(req.lines || []).map(line => {
                      const key = `${req.id}-${line.id}`
                      const fulfilled = parseFloat(line.fulfilled_qty) || 0
                      const isDisputed = lineHasDispute(req.id, line)

                      return (
                        <div
                          key={line.id}
                          className={`grid grid-cols-[1fr_70px_80px_40px] gap-2 px-4 py-2.5 border-b border-gray-50 items-center ${
                            isDisputed ? 'bg-amber-50/50' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{line.item_name}</p>
                            <p className="text-[10px] text-gray-400">
                              Requested: {line.requested_qty || line.qty || '—'} {line.uom}
                            </p>
                          </div>
                          <p className="text-sm text-center text-gray-700 tabular-nums">{fulfilled}</p>
                          <div>
                            <input
                              type="number"
                              value={receivedQtys[key] || ''}
                              onChange={e => handleReceivedChange(req.id, line.id, e.target.value)}
                              min="0"
                              step="0.1"
                              data-guide="receive-check-qty"
                              className={`w-full text-center text-xs border rounded px-1 py-1.5 focus:outline-none focus:ring-1 ${
                                isDisputed
                                  ? 'border-amber-300 focus:ring-amber-300 focus:border-amber-400 bg-amber-50'
                                  : 'border-gray-200 focus:ring-green-300 focus:border-green-400'
                              }`}
                            />
                          </div>
                          <div className="flex justify-center">
                            {isDisputed ? (
                              <AlertOctagon size={16} className="text-amber-500" title="Quantity mismatch" />
                            ) : (
                              <CheckCircle2 size={16} className="text-green-500" title="Match" />
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* Dispute summary for this requisition */}
                    {reqHasDispute && (
                      <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 flex items-center gap-1.5">
                        <AlertOctagon size={13} />
                        Some quantities do not match. A dispute will be flagged on confirmation.
                      </div>
                    )}

                    {/* Confirm Receipt button */}
                    {canConfirm && (
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                        <button
                          onClick={() => handleConfirmReceipt(req.id)}
                          disabled={isConfirming}
                          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition disabled:opacity-50 ${
                            reqHasDispute
                              ? 'bg-amber-500 hover:bg-amber-600 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {isConfirming ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              Confirming...
                            </>
                          ) : reqHasDispute ? (
                            <>
                              <AlertOctagon size={16} />
                              Confirm with Dispute
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={16} />
                              Confirm Receipt
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
