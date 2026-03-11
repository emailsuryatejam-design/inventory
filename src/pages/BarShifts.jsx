import { useState, useEffect, useCallback } from 'react'
import { useUser } from '../context/AppContext'
import { barShifts as api } from '../services/api'
import {
  Clock, Play, Square, Plus, Minus, DollarSign,
  Loader2, AlertTriangle, ChevronRight, RefreshCw
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function BarShifts() {
  const user = useUser()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentShift, setCurrentShift] = useState(null)
  const [shifts, setShifts] = useState([])
  const [pagination, setPagination] = useState(null)

  // Open shift form
  const [showOpenForm, setShowOpenForm] = useState(false)
  const [openingFloat, setOpeningFloat] = useState('')

  // Cash entry form
  const [showCashEntry, setShowCashEntry] = useState(false)
  const [cashEntryType, setCashEntryType] = useState('cash_in')
  const [cashAmount, setCashAmount] = useState('')
  const [cashReason, setCashReason] = useState('')

  // Close shift form
  const [showCloseForm, setShowCloseForm] = useState(false)
  const [closingCash, setClosingCash] = useState('')
  const [closeNotes, setCloseNotes] = useState('')

  // Detail view
  const [selectedShift, setSelectedShift] = useState(null)
  const [shiftDetail, setShiftDetail] = useState(null)

  const [submitting, setSubmitting] = useState(false)

  const fetchShifts = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.list({ page })
      setCurrentShift(data.current_shift)
      setShifts(data.shifts || [])
      setPagination(data.pagination)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchShifts() }, [fetchShifts])

  const handleOpenShift = async (e) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      await api.open(parseFloat(openingFloat) || 0)
      setShowOpenForm(false)
      setOpeningFloat('')
      fetchShifts()
    } catch (e) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCashEntry = async (e) => {
    e.preventDefault()
    if (!currentShift) return
    try {
      setSubmitting(true)
      await api.cashEntry(currentShift.id, cashEntryType, parseFloat(cashAmount), cashReason)
      setShowCashEntry(false)
      setCashAmount('')
      setCashReason('')
      if (selectedShift?.id === currentShift.id) loadDetail(currentShift.id)
      fetchShifts()
    } catch (e) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseShift = async (e) => {
    e.preventDefault()
    if (!currentShift) return
    try {
      setSubmitting(true)
      const result = await api.close(currentShift.id, parseFloat(closingCash), closeNotes || null)
      setShowCloseForm(false)
      setClosingCash('')
      setCloseNotes('')
      setSelectedShift(null)
      setShiftDetail(null)
      fetchShifts()
      // Show variance
      const shift = result.shift
      if (shift && shift.variance !== null) {
        const v = shift.variance
        const msg = v === 0 ? 'Shift closed. Cash balanced perfectly!'
          : v > 0 ? `Shift closed. Overage of ${v.toFixed(2)}`
          : `Shift closed. Shortage of ${Math.abs(v).toFixed(2)}`
        alert(msg)
      }
    } catch (e) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const loadDetail = async (id) => {
    try {
      const data = await api.get(id)
      setShiftDetail(data)
      setSelectedShift(data.shift)
    } catch (e) {
      alert(e.message)
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '—'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m`
  }

  const formatTime = (dt) => {
    if (!dt) return '—'
    return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const formatMoney = (v) => (v ?? 0).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  if (loading && !shifts.length) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bar Shifts</h1>
          <p className="text-sm text-gray-500">Manage cash shifts and reconciliation</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchShifts()} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          {!currentShift && (
            <button onClick={() => setShowOpenForm(true)} className="flex items-center gap-1.5 text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Play className="w-4 h-4" /> Open Shift
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}

      {/* Current Shift Banner */}
      {currentShift && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-green-900">{currentShift.shift_number} — Active</div>
                <div className="text-sm text-green-700">
                  Opened by {currentShift.opened_by} at {formatTime(currentShift.opened_at)}
                  {' · '}Float: {formatMoney(currentShift.opening_float)}
                  {' · '}Sales: {formatMoney(currentShift.total_sales)}
                  {' · '}{currentShift.tab_count} tabs
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCashEntry(true)} className="text-sm px-3 py-1.5 border border-green-300 rounded-lg text-green-700 hover:bg-green-100">
                <Plus className="w-4 h-4 inline mr-1" />Cash Entry
              </button>
              <button onClick={() => { loadDetail(currentShift.id); }} className="text-sm px-3 py-1.5 border border-green-300 rounded-lg text-green-700 hover:bg-green-100">
                Details
              </button>
              <button onClick={() => setShowCloseForm(true)} className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700">
                <Square className="w-4 h-4 inline mr-1" />Close Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Detail Panel */}
      {shiftDetail && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{selectedShift.shift_number} Details</h2>
            <button onClick={() => { setShiftDetail(null); setSelectedShift(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Opening Float" value={formatMoney(selectedShift.opening_float)} />
            <Stat label="Total Sales" value={formatMoney(selectedShift.total_sales)} />
            <Stat label="Tabs" value={selectedShift.tab_count} />
            {selectedShift.status === 'closed' && (
              <>
                <Stat label="Closing Cash" value={formatMoney(selectedShift.closing_cash)} />
                <Stat label="Expected Cash" value={formatMoney(selectedShift.expected_cash)} />
                <Stat label="Variance" value={formatMoney(selectedShift.variance)} className={selectedShift.variance < 0 ? 'text-red-600' : selectedShift.variance > 0 ? 'text-blue-600' : 'text-green-600'} />
              </>
            )}
          </div>

          {/* Tab Summary */}
          {shiftDetail.tab_summary && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Payment Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>Cash: <span className="font-medium">{formatMoney(shiftDetail.tab_summary.cash_sales)}</span></div>
                <div>Card: <span className="font-medium">{formatMoney(shiftDetail.tab_summary.card_sales)}</span></div>
                <div>M-Pesa: <span className="font-medium">{formatMoney(shiftDetail.tab_summary.mpesa_sales)}</span></div>
                <div>Room Charge: <span className="font-medium">{formatMoney(shiftDetail.tab_summary.room_charge_sales)}</span></div>
              </div>
            </div>
          )}

          {/* Cash Entries */}
          {shiftDetail.cash_entries && shiftDetail.cash_entries.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Cash Entries</h3>
              <div className="space-y-2">
                {shiftDetail.cash_entries.map(e => (
                  <div key={e.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      {e.entry_type === 'cash_in' ? <Plus className="w-4 h-4 text-green-500" /> : <Minus className="w-4 h-4 text-red-500" />}
                      <span>{e.reason}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-medium ${e.entry_type === 'cash_in' ? 'text-green-600' : 'text-red-600'}`}>
                        {e.entry_type === 'cash_in' ? '+' : '-'}{formatMoney(e.amount)}
                      </span>
                      <span className="text-gray-400">{e.created_by} · {formatTime(e.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Shift History */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-medium text-gray-700">Shift History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Shift #</th>
                <th className="px-4 py-2">Opened</th>
                <th className="px-4 py-2">Closed</th>
                <th className="px-4 py-2 text-right">Float</th>
                <th className="px-4 py-2 text-right">Sales</th>
                <th className="px-4 py-2 text-right">Variance</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shifts.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => loadDetail(s.id)}>
                  <td className="px-4 py-2.5 font-medium">{s.shift_number}</td>
                  <td className="px-4 py-2.5 text-gray-500">{formatTime(s.opened_at)}</td>
                  <td className="px-4 py-2.5 text-gray-500">{formatTime(s.closed_at)}</td>
                  <td className="px-4 py-2.5 text-right">{formatMoney(s.opening_float)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatMoney(s.total_sales)}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${s.variance < 0 ? 'text-red-600' : s.variance > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                    {s.variance !== null ? formatMoney(s.variance) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={s.status === 'open' ? 'success' : 'default'}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5"><ChevronRight className="w-4 h-4 text-gray-400" /></td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No shifts yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open Shift Modal */}
      {showOpenForm && (
        <Modal onClose={() => setShowOpenForm(false)} title="Open New Shift">
          <form onSubmit={handleOpenShift} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Float (Cash in Drawer)</label>
              <input type="number" step="0.01" min="0" value={openingFloat} onChange={e => setOpeningFloat(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="0.00" autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowOpenForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : <Play className="w-4 h-4 inline mr-1" />}
                Open Shift
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Cash Entry Modal */}
      {showCashEntry && (
        <Modal onClose={() => setShowCashEntry(false)} title="Record Cash Entry">
          <form onSubmit={handleCashEntry} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={cashEntryType} onChange={e => setCashEntryType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="cash_in">Cash In</option>
                <option value="cash_out">Cash Out</option>
                <option value="paid_out">Paid Out</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input type="number" step="0.01" min="0.01" value={cashAmount} onChange={e => setCashAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="0.00" required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input type="text" value={cashReason} onChange={e => setCashReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Reason for cash entry" required />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCashEntry(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {submitting && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}Record
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Close Shift Modal */}
      {showCloseForm && currentShift && (
        <Modal onClose={() => setShowCloseForm(false)} title="Close Shift">
          <form onSubmit={handleCloseShift} className="space-y-4">
            <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
              <strong>{currentShift.shift_number}</strong> — Float: {formatMoney(currentShift.opening_float)}, Sales: {formatMoney(currentShift.total_sales)}, Tabs: {currentShift.tab_count}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Closing Cash Count</label>
              <input type="number" step="0.01" min="0" value={closingCash} onChange={e => setClosingCash(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Count all cash in drawer" required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea value={closeNotes} onChange={e => setCloseNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" rows={2} placeholder="Shift notes..." />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCloseForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {submitting && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}Close Shift
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Stat({ label, value, className = '' }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-semibold ${className}`}>{value}</div>
    </div>
  )
}

function Modal({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}

function X(props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
}
