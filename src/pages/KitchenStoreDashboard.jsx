import { useState, useEffect } from 'react'
import { useUser, isManager } from '../context/AppContext'
import { kitchenRequisitions as reqApi } from '../services/api'
import {
  Warehouse, Package, Clock, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, X, AlertTriangle, ClipboardList
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'

// Status badge variant mapping
const STATUS_VARIANT = {
  draft: 'draft',
  submitted: 'submitted',
  fulfilled: 'success',
  received: 'received',
  closed: 'closed',
  partial: 'partial',
}

// ════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════
export default function KitchenStoreDashboard() {
  const user = useUser()
  const canManage = isManager(user?.role)

  // Stats
  const [stats, setStats] = useState({ new_orders: 0, processing: 0, fulfilled_today: 0 })
  const [statsLoading, setStatsLoading] = useState(true)

  // Requisition list
  const [requisitions, setRequisitions] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState('')

  // Expanded rows
  const [expandedId, setExpandedId] = useState(null)
  const [expandedDetail, setExpandedDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Fulfill modal
  const [fulfillModal, setFulfillModal] = useState(null) // { reqId, lines }
  const [fulfillLines, setFulfillLines] = useState([])
  const [fulfillSaving, setFulfillSaving] = useState(false)

  // ── Load stats + list on mount ──
  useEffect(() => {
    loadStats()
    loadList()
  }, [])

  async function loadStats() {
    setStatsLoading(true)
    try {
      const result = await reqApi.storeStats()
      setStats(result.stats || result || { new_orders: 0, processing: 0, fulfilled_today: 0 })
    } catch (err) {
      setError(err.message)
    } finally {
      setStatsLoading(false)
    }
  }

  async function loadList() {
    setListLoading(true)
    setError('')
    try {
      const result = await reqApi.list('', '', 'submitted')
      setRequisitions(result.requisitions || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setListLoading(false)
    }
  }

  // ── Toggle expand row ──
  async function handleToggleExpand(reqId) {
    if (expandedId === reqId) {
      setExpandedId(null)
      setExpandedDetail(null)
      return
    }
    setExpandedId(reqId)
    setDetailLoading(true)
    try {
      const result = await reqApi.get(reqId)
      setExpandedDetail(result.requisition || result)
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Open fulfill modal ──
  async function openFulfillModal(reqId) {
    setDetailLoading(true)
    try {
      const result = await reqApi.get(reqId)
      const req = result.requisition || result
      const lines = (req.lines || []).map(line => ({
        id: line.id,
        item_name: line.item_name,
        requested_qty: line.qty || line.requested_qty || 0,
        uom: line.uom || '',
        fulfilled_qty: line.fulfilled_qty || line.qty || line.requested_qty || 0,
      }))
      setFulfillLines(lines)
      setFulfillModal({ reqId, req })
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  function updateFulfillQty(lineId, value) {
    setFulfillLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, fulfilled_qty: value } : l
    ))
  }

  async function handleFulfill() {
    if (!fulfillModal) return
    setFulfillSaving(true)
    setError('')
    try {
      const lines = fulfillLines.map(l => ({
        id: l.id,
        fulfilled_qty: parseFloat(l.fulfilled_qty) || 0,
      }))
      await reqApi.fulfill(fulfillModal.reqId, lines)
      setFulfillModal(null)
      setFulfillLines([])
      setExpandedId(null)
      setExpandedDetail(null)
      loadStats()
      loadList()
    } catch (err) {
      setError(err.message)
    } finally {
      setFulfillSaving(false)
    }
  }

  // ── Group requisitions by kitchen ──
  const grouped = {}
  for (const req of requisitions) {
    const kitchen = req.kitchen_name || 'Unknown Kitchen'
    if (!grouped[kitchen]) grouped[kitchen] = []
    grouped[kitchen].push(req)
  }

  return (
    <div className="pb-8" data-guide="nav-store-dashboard">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Warehouse size={22} className="text-blue-600" />
            Store Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage kitchen requisitions and fulfillment</p>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError('')}><X size={16} className="text-red-400" /></button>
        </div>
      )}

      {/* ── Stat Cards ── */}
      {statsLoading ? (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <StatCard
            label="New Orders"
            value={stats.new_orders ?? 0}
            icon={ClipboardList}
            color="#f59e0b"
          />
          <StatCard
            label="Processing"
            value={stats.processing ?? 0}
            icon={Clock}
            color="#3b82f6"
          />
          <StatCard
            label="Fulfilled Today"
            value={stats.fulfilled_today ?? 0}
            icon={CheckCircle2}
            color="#10b981"
          />
        </div>
      )}

      {/* ── Requisition List ── */}
      {listLoading ? (
        <LoadingSpinner message="Loading orders..." />
      ) : requisitions.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No pending requisitions"
          message="All requisitions have been processed"
        />
      ) : (
        <div className="space-y-4" data-guide="store-order-list">
          {Object.entries(grouped).map(([kitchenName, reqs]) => (
            <div key={kitchenName}>
              <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Warehouse size={14} className="text-gray-400" />
                {kitchenName}
                <span className="text-xs font-normal text-gray-400">({reqs.length})</span>
              </h2>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
                {reqs.map(req => (
                  <div key={req.id}>
                    {/* Row */}
                    <button
                      onClick={() => handleToggleExpand(req.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {req.meal_type || req.type_name || 'Requisition'} — {req.date}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            #{req.id} {req.item_count ? `\u00b7 ${req.item_count} items` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={STATUS_VARIANT[req.status] || 'default'}>
                          {req.status}
                        </Badge>
                        {expandedId === req.id ? (
                          <ChevronUp size={16} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={16} className="text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Detail */}
                    {expandedId === req.id && (
                      <div className="px-4 pb-4 bg-gray-50/50">
                        {detailLoading ? (
                          <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                            <Loader2 size={14} className="animate-spin" /> Loading...
                          </div>
                        ) : expandedDetail ? (
                          <>
                            {/* Lines table */}
                            {expandedDetail.lines && expandedDetail.lines.length > 0 && (
                              <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-gray-100 text-gray-500 text-left uppercase tracking-wider">
                                      <th className="px-3 py-2 font-semibold">Item</th>
                                      <th className="px-3 py-2 font-semibold text-right">Requested</th>
                                      <th className="px-3 py-2 font-semibold text-right">UOM</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 bg-white">
                                    {expandedDetail.lines.map(line => (
                                      <tr key={line.id}>
                                        <td className="px-3 py-2 text-gray-900">{line.item_name}</td>
                                        <td className="px-3 py-2 text-right text-gray-700 tabular-nums">
                                          {line.qty || line.requested_qty}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-500">{line.uom}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Fulfill button */}
                            {(req.status === 'submitted') && (
                              <div className="mt-3 flex justify-end">
                                <button
                                  onClick={() => openFulfillModal(req.id)}
                                  data-guide="store-fulfill-btn"
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
                                >
                                  <CheckCircle2 size={16} />
                                  Fulfill
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-gray-400 py-3">No detail available</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Fulfill Modal ── */}
      <Modal
        open={!!fulfillModal}
        onClose={() => { setFulfillModal(null); setFulfillLines([]) }}
        title="Fulfill Requisition"
        maxWidth="560px"
      >
        {fulfillModal && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Enter fulfilled quantities for each line item.
            </p>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {fulfillLines.map(line => (
                <div key={line.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{line.item_name}</p>
                    <p className="text-xs text-gray-400">
                      Requested: {line.requested_qty} {line.uom}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      value={line.fulfilled_qty}
                      onChange={e => updateFulfillQty(line.id, e.target.value)}
                      className="w-24 text-center text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
                      min="0"
                      step="any"
                    />
                    <span className="text-xs text-gray-500 w-8">{line.uom}</span>
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100">
              <button
                onClick={() => { setFulfillModal(null); setFulfillLines([]) }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleFulfill}
                disabled={fulfillSaving}
                data-guide="store-confirm"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                {fulfillSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Confirm Fulfillment
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
