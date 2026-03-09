import { useState, useEffect } from 'react'
import { useUser, isManager } from '../context/AppContext'
import { kitchenRequisitions } from '../services/api'
import {
  CalendarCheck, ChevronLeft, ChevronRight, AlertTriangle,
  X, Loader2, PackageCheck, Undo2, UtensilsCrossed, Lock
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

// Format YYYY-MM-DD using LOCAL time (never UTC)
function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr() { return toDateStr(new Date()) }

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function isToday(dateStr) {
  return dateStr === todayStr()
}

const MEAL_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  supper: 'Supper',
}

const MEAL_COLORS = {
  breakfast: 'bg-amber-50 border-amber-200',
  lunch: 'bg-orange-50 border-orange-200',
  dinner: 'bg-indigo-50 border-indigo-200',
  snack: 'bg-green-50 border-green-200',
  supper: 'bg-purple-50 border-purple-200',
}

export default function KitchenDayClose() {
  const user = useUser()
  const canClose = isManager(user?.role) || user?.role === 'chef'

  const [date, setDate] = useState(todayStr())
  const [summary, setSummary] = useState(null)
  const [requisitions, setRequisitions] = useState([])
  const [unusedQtys, setUnusedQtys] = useState({}) // { `${reqId}-${lineId}`: qty }
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [date])

  async function loadData() {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const data = await kitchenRequisitions.daySummary(date)
      setSummary(data.summary || null)
      const reqs = data.requisitions || []
      setRequisitions(reqs)

      // Initialize unused quantities from existing data
      const initial = {}
      for (const req of reqs) {
        if (req.status === 'received' || req.status === 'fulfilled' || req.status === 'confirmed') {
          for (const line of (req.lines || [])) {
            const key = `${req.id}-${line.id}`
            initial[key] = line.unused_qty != null ? String(line.unused_qty) : '0'
          }
        }
      }
      setUnusedQtys(initial)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function changeDate(days) {
    setDate(prev => {
      const d = new Date(prev + 'T00:00:00')
      d.setDate(d.getDate() + days)
      return toDateStr(d)
    })
  }

  function handleUnusedChange(reqId, lineId, value) {
    const key = `${reqId}-${lineId}`
    setUnusedQtys(prev => ({ ...prev, [key]: value }))
  }

  async function handleCloseDay() {
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      // Build unused lines payload grouped by requisition
      const unusedByReq = {}
      for (const [key, qty] of Object.entries(unusedQtys)) {
        const [reqId, lineId] = key.split('-')
        if (!unusedByReq[reqId]) unusedByReq[reqId] = []
        unusedByReq[reqId].push({
          line_id: parseInt(lineId),
          unused_qty: parseFloat(qty) || 0,
        })
      }

      await kitchenRequisitions.closeWithUnused({
        date,
        requisitions: Object.entries(unusedByReq).map(([reqId, lines]) => ({
          requisition_id: parseInt(reqId),
          unused_lines: lines,
        })),
      })

      setSuccess('Day closed successfully. All unused quantities recorded.')
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Group requisitions by meal type
  const groupedByMeal = {}
  for (const req of requisitions) {
    const meal = req.meal_type || 'other'
    if (!groupedByMeal[meal]) groupedByMeal[meal] = []
    groupedByMeal[meal].push(req)
  }

  // Compute summary totals
  const closableReqs = requisitions.filter(
    r => r.status === 'received' || r.status === 'fulfilled' || r.status === 'confirmed'
  )
  const allLines = closableReqs.flatMap(r => r.lines || [])
  const totalReceived = allLines.reduce((s, l) => s + (parseFloat(l.received_qty) || parseFloat(l.fulfilled_qty) || 0), 0)
  const totalUnused = Object.values(unusedQtys).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const netConsumed = totalReceived - totalUnused

  const isDayClosed = summary?.is_closed || false

  return (
    <div data-guide="nav-day-close">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarCheck size={22} className="text-green-600" />
            Day Close
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Record unused quantities and close the kitchen day</p>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => changeDate(-1)}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Previous</span>
          </button>

          <div className="text-center">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="text-lg font-bold text-gray-900 bg-transparent border-none text-center cursor-pointer focus:outline-none"
            />
            {isToday(date) ? (
              <span className="block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium mx-auto w-fit">Today</span>
            ) : (
              <button
                onClick={() => setDate(todayStr())}
                className="block text-xs text-green-600 hover:text-green-700 font-medium mx-auto"
              >
                Go to Today
              </button>
            )}
          </div>

          <button
            onClick={() => changeDate(1)}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight size={18} />
          </button>
        </div>
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
          <PackageCheck size={16} />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')}><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading day summary..." />
      ) : requisitions.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No requisitions for this day"
          message="There are no fulfilled or received requisitions to close for the selected date."
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <PackageCheck size={20} className="mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold text-gray-900">{Math.round(totalReceived)}</p>
              <p className="text-xs text-gray-500">Total Received</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <Undo2 size={20} className="mx-auto text-amber-500 mb-1" />
              <p className="text-2xl font-bold text-gray-900">{Math.round(totalUnused)}</p>
              <p className="text-xs text-gray-500">Total Unused</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <UtensilsCrossed size={20} className="mx-auto text-green-500 mb-1" />
              <p className="text-2xl font-bold text-gray-900">{Math.round(netConsumed)}</p>
              <p className="text-xs text-gray-500">Net Consumed</p>
            </div>
          </div>

          {/* Day closed banner */}
          {isDayClosed && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm text-gray-600">
              <Lock size={16} className="text-gray-400" />
              This day has already been closed. Unused quantities are locked.
            </div>
          )}

          {/* Requisitions grouped by meal type */}
          {Object.entries(groupedByMeal).map(([meal, reqs]) => (
            <div key={meal} className="mb-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                  meal === 'breakfast' ? 'bg-amber-400' :
                  meal === 'lunch' ? 'bg-orange-400' :
                  meal === 'dinner' ? 'bg-indigo-400' :
                  meal === 'snack' ? 'bg-green-400' : 'bg-gray-400'
                }`} />
                {MEAL_LABELS[meal] || meal}
                <span className="text-xs text-gray-400 font-normal">({reqs.length} requisition{reqs.length !== 1 ? 's' : ''})</span>
              </h2>

              {reqs.map(req => {
                const isClosable = req.status === 'received' || req.status === 'fulfilled' || req.status === 'confirmed'
                return (
                  <div
                    key={req.id}
                    className={`bg-white rounded-xl border mb-2 overflow-hidden ${MEAL_COLORS[meal] || 'border-gray-200'}`}
                  >
                    {/* Requisition header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          #{req.id} {req.kitchen_name && `- ${req.kitchen_name}`}
                        </p>
                        <p className="text-xs text-gray-400">{req.created_at || formatDate(date)}</p>
                      </div>
                      <Badge variant={req.status}>{req.status}</Badge>
                    </div>

                    {/* Line items */}
                    {isClosable && (req.lines || []).length > 0 && (
                      <div>
                        {/* Column headers */}
                        <div className="grid grid-cols-[1fr_70px_70px_80px] gap-2 px-4 py-2 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          <span>Item</span>
                          <span className="text-center">Received</span>
                          <span className="text-center">Unused</span>
                          <span className="text-center">Consumed</span>
                        </div>

                        {(req.lines || []).map(line => {
                          const key = `${req.id}-${line.id}`
                          const received = parseFloat(line.received_qty) || parseFloat(line.fulfilled_qty) || 0
                          const unused = parseFloat(unusedQtys[key]) || 0
                          const consumed = received - unused

                          return (
                            <div
                              key={line.id}
                              className="grid grid-cols-[1fr_70px_70px_80px] gap-2 px-4 py-2.5 border-b border-gray-50 items-center"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{line.item_name}</p>
                                <p className="text-[10px] text-gray-400">{line.uom}</p>
                              </div>
                              <p className="text-sm text-center text-gray-700 tabular-nums">{received}</p>
                              <div>
                                <input
                                  type="number"
                                  value={unusedQtys[key] || ''}
                                  onChange={e => handleUnusedChange(req.id, line.id, e.target.value)}
                                  disabled={isDayClosed}
                                  min="0"
                                  max={received}
                                  step="0.1"
                                  data-guide="day-close-unused-qty"
                                  className="w-full text-center text-xs border border-gray-200 rounded px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-300 focus:border-green-400 disabled:bg-gray-50 disabled:text-gray-400"
                                />
                              </div>
                              <p className={`text-sm text-center tabular-nums font-medium ${
                                consumed < 0 ? 'text-red-600' : 'text-green-700'
                              }`}>
                                {consumed.toFixed(1)}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Non-closable status message */}
                    {!isClosable && (
                      <div className="px-4 py-3 text-xs text-gray-400">
                        This requisition is not ready for day close (status: {req.status})
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Close Day Button */}
          {canClose && !isDayClosed && closableReqs.length > 0 && (
            <div className="sticky bottom-4 mt-4">
              <button
                onClick={handleCloseDay}
                disabled={submitting}
                data-guide="day-close-submit"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg transition disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Closing Day...
                  </>
                ) : (
                  <>
                    <CalendarCheck size={18} />
                    Close Day - {formatDate(date)}
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
