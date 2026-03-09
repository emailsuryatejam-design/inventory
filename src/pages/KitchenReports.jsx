import { useState, useEffect } from 'react'
import { useUser, isManager } from '../context/AppContext'
import { kitchenRequisitions, kitchens as kitchensApi } from '../services/api'
import {
  BarChart3, Calendar, AlertTriangle, X, ChefHat,
  TrendingUp, Trash2, AlertOctagon, ClipboardList, Loader2
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

// Format YYYY-MM-DD using LOCAL time
function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr() { return toDateStr(new Date()) }

function sevenDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return toDateStr(d)
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_ORDER = ['draft', 'submitted', 'pending_review', 'fulfilled', 'received', 'confirmed', 'closed', 'cancelled']

const MEAL_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  supper: 'Supper',
}

export default function KitchenReports() {
  const user = useUser()

  // Filters
  const [dateFrom, setDateFrom] = useState(sevenDaysAgo())
  const [dateTo, setDateTo] = useState(todayStr())
  const [selectedKitchen, setSelectedKitchen] = useState('')
  const [kitchensList, setKitchensList] = useState([])

  // Report data
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load kitchens list
  useEffect(() => {
    async function loadKitchens() {
      try {
        const data = await kitchensApi.list()
        setKitchensList(data.kitchens || [])
      } catch {
        // Silently fail - kitchen dropdown just won't show
      }
    }
    loadKitchens()
  }, [])

  // Load report data when filters change
  useEffect(() => {
    loadReport()
  }, [dateFrom, dateTo, selectedKitchen])

  async function loadReport() {
    setLoading(true)
    setError('')
    try {
      // Fetch day summaries for each day in range
      const allRequisitions = []
      const allSummaries = []

      // Iterate through each date in range
      const start = new Date(dateFrom + 'T00:00:00')
      const end = new Date(dateTo + 'T00:00:00')
      const promises = []

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = toDateStr(d)
        promises.push(
          kitchenRequisitions.daySummary(dateStr, selectedKitchen || undefined)
            .then(data => ({
              date: dateStr,
              summary: data.summary || null,
              requisitions: data.requisitions || [],
            }))
            .catch(() => ({ date: dateStr, summary: null, requisitions: [] }))
        )
      }

      const results = await Promise.all(promises)

      for (const result of results) {
        allSummaries.push(result.summary)
        allRequisitions.push(...result.requisitions)
      }

      // Build report sections
      const report = buildReport(allRequisitions, allSummaries)
      setReportData(report)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function buildReport(requisitions, summaries) {
    // 1. Requisition Summary
    const totalOrders = requisitions.length
    const byStatus = {}
    const byMeal = {}
    for (const req of requisitions) {
      const status = req.status || 'unknown'
      byStatus[status] = (byStatus[status] || 0) + 1
      const meal = req.meal_type || 'other'
      byMeal[meal] = (byMeal[meal] || 0) + 1
    }

    // 2. Top Items - aggregate all line items
    const itemMap = {}
    for (const req of requisitions) {
      for (const line of (req.lines || [])) {
        const name = line.item_name || 'Unknown'
        if (!itemMap[name]) {
          itemMap[name] = { name, uom: line.uom || '', total_qty: 0, count: 0 }
        }
        itemMap[name].total_qty += parseFloat(line.requested_qty || line.qty || 0)
        itemMap[name].count += 1
      }
    }
    const topItems = Object.values(itemMap)
      .sort((a, b) => b.total_qty - a.total_qty)
      .slice(0, 15)

    // 3. Unused/Waste - items with highest unused quantities
    const wasteMap = {}
    for (const req of requisitions) {
      if (req.status !== 'closed' && req.status !== 'confirmed' && req.status !== 'received') continue
      for (const line of (req.lines || [])) {
        if (!line.unused_qty || parseFloat(line.unused_qty) <= 0) continue
        const name = line.item_name || 'Unknown'
        if (!wasteMap[name]) {
          wasteMap[name] = { name, uom: line.uom || '', total_unused: 0, total_received: 0, count: 0 }
        }
        wasteMap[name].total_unused += parseFloat(line.unused_qty) || 0
        wasteMap[name].total_received += parseFloat(line.received_qty) || parseFloat(line.fulfilled_qty) || 0
        wasteMap[name].count += 1
      }
    }
    const wasteItems = Object.values(wasteMap)
      .sort((a, b) => b.total_unused - a.total_unused)
      .slice(0, 15)

    // 4. Dispute History - requisitions that had disputes
    const disputes = requisitions.filter(req => {
      if (req.has_dispute) return true
      for (const line of (req.lines || [])) {
        const received = parseFloat(line.received_qty)
        const fulfilled = parseFloat(line.fulfilled_qty)
        if (!isNaN(received) && !isNaN(fulfilled) && received !== fulfilled) return true
      }
      return false
    })

    return {
      totalOrders,
      byStatus,
      byMeal,
      topItems,
      wasteItems,
      disputes,
    }
  }

  return (
    <div data-guide="kitchen-reports-header">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={22} className="text-purple-600" />
            Kitchen Reports
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Requisition analytics and waste tracking</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4" data-guide="kitchen-reports-date-range">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Date From */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Date To */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Kitchen Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Kitchen</label>
            <div className="relative">
              <ChefHat size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedKitchen}
                onChange={e => setSelectedKitchen(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none appearance-none bg-white"
              >
                <option value="">All Kitchens</option>
                {kitchensList.map(k => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick range buttons */}
        <div className="flex gap-2 mt-3">
          {[
            { label: 'Today', fn: () => { setDateFrom(todayStr()); setDateTo(todayStr()) } },
            { label: '7 Days', fn: () => { setDateFrom(sevenDaysAgo()); setDateTo(todayStr()) } },
            { label: '30 Days', fn: () => {
              const d = new Date(); d.setDate(d.getDate() - 30)
              setDateFrom(toDateStr(d)); setDateTo(todayStr())
            }},
            { label: 'This Month', fn: () => {
              const now = new Date()
              setDateFrom(toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)))
              setDateTo(todayStr())
            }},
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.fn}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              {btn.label}
            </button>
          ))}
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

      {loading ? (
        <LoadingSpinner message="Generating report..." />
      ) : !reportData ? (
        <EmptyState
          icon={BarChart3}
          title="No data available"
          message="No requisition data found for the selected date range."
        />
      ) : (
        <div className="space-y-4">
          {/* Section 1: Requisition Summary */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <ClipboardList size={16} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">Requisition Summary</h2>
              <span className="text-xs text-gray-400 ml-auto">{formatDate(dateFrom)} - {formatDate(dateTo)}</span>
            </div>
            <div className="p-4">
              {/* Total */}
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-gray-900">{reportData.totalOrders}</p>
                <p className="text-xs text-gray-500">Total Requisitions</p>
              </div>

              {/* By Status */}
              {Object.keys(reportData.byStatus).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">By Status</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_ORDER
                      .filter(s => reportData.byStatus[s])
                      .map(status => (
                        <div key={status} className="flex items-center gap-1.5">
                          <Badge variant={status} />
                          <span className="text-sm font-semibold text-gray-700">{reportData.byStatus[status]}</span>
                        </div>
                      ))
                    }
                    {/* Include any statuses not in STATUS_ORDER */}
                    {Object.keys(reportData.byStatus)
                      .filter(s => !STATUS_ORDER.includes(s))
                      .map(status => (
                        <div key={status} className="flex items-center gap-1.5">
                          <Badge variant={status} />
                          <span className="text-sm font-semibold text-gray-700">{reportData.byStatus[status]}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}

              {/* By Meal Type */}
              {Object.keys(reportData.byMeal).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">By Meal Type</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(reportData.byMeal).map(([meal, count]) => (
                      <div key={meal} className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold text-gray-900">{count}</p>
                        <p className="text-xs text-gray-500">{MEAL_LABELS[meal] || meal}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportData.totalOrders === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No requisitions in this date range</p>
              )}
            </div>
          </div>

          {/* Section 2: Top Items */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <TrendingUp size={16} className="text-green-600" />
              <h2 className="text-sm font-semibold text-gray-800">Top Requested Items</h2>
            </div>
            {reportData.topItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No item data available</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {reportData.topItems.map((item, idx) => (
                  <div key={item.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      idx < 3 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{item.count} requisition{item.count !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900 tabular-nums">{item.total_qty.toFixed(1)}</p>
                      <p className="text-[10px] text-gray-400">{item.uom}</p>
                    </div>
                    {/* Bar indicator */}
                    <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${Math.min(100, (item.total_qty / (reportData.topItems[0]?.total_qty || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Unused/Waste */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <Trash2 size={16} className="text-amber-600" />
              <h2 className="text-sm font-semibold text-gray-800">Unused / Waste</h2>
            </div>
            {reportData.wasteItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No unused quantity data recorded</div>
            ) : (
              <div>
                {/* Header */}
                <div className="grid grid-cols-[1fr_70px_70px_60px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  <span>Item</span>
                  <span className="text-center">Received</span>
                  <span className="text-center">Unused</span>
                  <span className="text-center">Waste %</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {reportData.wasteItems.map(item => {
                    const wastePercent = item.total_received > 0
                      ? ((item.total_unused / item.total_received) * 100).toFixed(1)
                      : 0

                    return (
                      <div key={item.name} className="grid grid-cols-[1fr_70px_70px_60px] gap-2 px-4 py-2.5 items-center">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-[10px] text-gray-400">{item.uom} &middot; {item.count} occurrence{item.count !== 1 ? 's' : ''}</p>
                        </div>
                        <p className="text-sm text-center text-gray-600 tabular-nums">{item.total_received.toFixed(1)}</p>
                        <p className="text-sm text-center text-amber-600 font-medium tabular-nums">{item.total_unused.toFixed(1)}</p>
                        <div className="flex justify-center">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            parseFloat(wastePercent) > 20
                              ? 'bg-red-100 text-red-700'
                              : parseFloat(wastePercent) > 10
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {wastePercent}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Dispute History */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <AlertOctagon size={16} className="text-red-600" />
              <h2 className="text-sm font-semibold text-gray-800">Dispute History</h2>
              {reportData.disputes.length > 0 && (
                <Badge variant="danger" className="ml-auto">{reportData.disputes.length}</Badge>
              )}
            </div>
            {reportData.disputes.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No disputes recorded in this period</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {reportData.disputes.map(req => {
                  const disputedLines = (req.lines || []).filter(line => {
                    const received = parseFloat(line.received_qty)
                    const fulfilled = parseFloat(line.fulfilled_qty)
                    return !isNaN(received) && !isNaN(fulfilled) && received !== fulfilled
                  })

                  return (
                    <div key={req.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            Requisition #{req.id}
                            <Badge variant={req.status}>{req.status}</Badge>
                          </p>
                          <p className="text-xs text-gray-400">
                            {req.kitchen_name || 'Kitchen'} &middot; {req.meal_type || 'N/A'} &middot; {req.date || 'N/A'}
                          </p>
                        </div>
                        <Badge variant="danger">
                          {disputedLines.length} item{disputedLines.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>

                      {/* Disputed line items */}
                      {disputedLines.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-2 space-y-1">
                          {disputedLines.map(line => {
                            const fulfilled = parseFloat(line.fulfilled_qty) || 0
                            const received = parseFloat(line.received_qty) || 0
                            const diff = received - fulfilled

                            return (
                              <div key={line.id} className="flex items-center justify-between text-xs">
                                <span className="font-medium text-gray-700">{line.item_name}</span>
                                <span className="text-red-600 font-medium tabular-nums">
                                  Sent: {fulfilled} / Received: {received}
                                  <span className="ml-1 text-[10px]">
                                    ({diff > 0 ? '+' : ''}{diff.toFixed(1)})
                                  </span>
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-400 text-center mt-2">
            Report generated for {formatDate(dateFrom)} to {formatDate(dateTo)}
            {selectedKitchen && kitchensList.find(k => String(k.id) === selectedKitchen)
              ? ` - ${kitchensList.find(k => String(k.id) === selectedKitchen).name}`
              : ' - All Kitchens'}
          </p>
        </div>
      )}
    </div>
  )
}
