import { useState, useEffect } from 'react'
import { alerts as alertsApi } from '../services/api'
import { useUser } from '../context/AppContext'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'

const TAB_CONFIG = [
  { key: 'summary', label: 'Overview', icon: '📊' },
  { key: 'low_stock', label: 'Low Stock', icon: '⚠️' },
  { key: 'projections', label: 'Projections', icon: '📉' },
  { key: 'dead_stock', label: 'Dead Stock', icon: '💤' },
  { key: 'excess', label: 'Excess', icon: '📦' },
]

const STATUS_COLORS = {
  out: 'bg-red-100 text-red-800',
  critical: 'bg-red-100 text-red-700',
  low: 'bg-amber-100 text-amber-800',
  ok: 'bg-green-100 text-green-800',
  excess: 'bg-blue-100 text-blue-800',
}

export default function Alerts() {
  const { user } = useUser()
  const [tab, setTab] = useState('summary')
  const [summary, setSummary] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [projDays, setProjDays] = useState(14)
  const [deadDays, setDeadDays] = useState(60)

  const campId = ['camp_storekeeper', 'camp_manager'].includes(user?.role) ? user?.camp_id : null

  // Load summary on mount
  useEffect(() => {
    loadSummary()
  }, [])

  // Load tab data
  useEffect(() => {
    if (tab !== 'summary') loadTabData()
  }, [tab, projDays, deadDays])

  async function loadSummary() {
    try {
      setLoading(true)
      const res = await alertsApi.summary(campId)
      setSummary(res.alerts)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadTabData() {
    try {
      setLoading(true)
      setError('')
      let res
      switch (tab) {
        case 'low_stock':
          res = await alertsApi.lowStock(campId)
          break
        case 'projections':
          res = await alertsApi.projections(projDays, campId)
          break
        case 'dead_stock':
          res = await alertsApi.deadStock(deadDays, campId)
          break
        case 'excess':
          res = await alertsApi.excess(campId)
          break
      }
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Stock Alerts & Projections</h1>
        <button
          onClick={() => { loadSummary(); if (tab !== 'summary') loadTabData() }}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 bg-gray-100 p-1 rounded-lg">
        {TAB_CONFIG.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="mr-1">{t.icon}</span>
            {t.label}
            {t.key !== 'summary' && summary && (
              <span className="ml-1 text-xs">
                ({t.key === 'low_stock' ? summary.low_stock + summary.out_of_stock
                  : t.key === 'projections' ? summary.stockout_7days
                  : t.key === 'dead_stock' ? summary.dead_stock
                  : t.key === 'excess' ? summary.excess_stock
                  : 0})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {tab === 'summary' && summary && <SummaryView summary={summary} onNavigate={setTab} />}

      {/* Low Stock Tab */}
      {tab === 'low_stock' && !loading && data && <LowStockView data={data} />}

      {/* Projections Tab */}
      {tab === 'projections' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Forecast horizon:</label>
            <select
              value={projDays}
              onChange={e => setProjDays(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          {!loading && data && <ProjectionsView data={data} />}
        </div>
      )}

      {/* Dead Stock Tab */}
      {tab === 'dead_stock' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">No movement for:</label>
            <select
              value={deadDays}
              onChange={e => setDeadDays(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value={30}>30+ days</option>
              <option value={60}>60+ days</option>
              <option value={90}>90+ days</option>
              <option value={180}>180+ days</option>
            </select>
          </div>
          {!loading && data && <DeadStockView data={data} />}
        </div>
      )}

      {/* Excess Tab */}
      {tab === 'excess' && !loading && data && <ExcessView data={data} />}

      {loading && tab !== 'summary' && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
        </div>
      )}
    </div>
  )
}

// ── Summary View ──
function SummaryView({ summary, onNavigate }) {
  const cards = [
    {
      label: 'Critical / Low Stock',
      value: summary.low_stock,
      sub: `${summary.critical} critical`,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      icon: '⚠️',
      tab: 'low_stock',
    },
    {
      label: 'Out of Stock',
      value: summary.out_of_stock,
      color: 'text-red-600',
      bg: 'bg-red-50',
      icon: '🚫',
      tab: 'low_stock',
    },
    {
      label: 'Stock-out in 7 days',
      value: summary.stockout_7days,
      sub: 'Based on avg usage',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      icon: '📉',
      tab: 'projections',
    },
    {
      label: 'Dead Stock',
      value: summary.dead_stock,
      sub: '60+ days no movement',
      color: 'text-gray-600',
      bg: 'bg-gray-50',
      icon: '💤',
      tab: 'dead_stock',
    },
    {
      label: 'Excess Stock',
      value: summary.excess_stock,
      sub: 'Above max level',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      icon: '📦',
      tab: 'excess',
    },
    {
      label: 'Total Alerts',
      value: summary.total_alerts,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      icon: '🔔',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {cards.map((c, i) => (
        <button
          key={i}
          onClick={() => c.tab && onNavigate(c.tab)}
          className={`${c.bg} rounded-xl p-4 text-left transition-transform hover:scale-[1.02] ${c.tab ? 'cursor-pointer' : ''}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{c.icon}</span>
            <span className="text-xs font-medium text-gray-500 uppercase">{c.label}</span>
          </div>
          <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          {c.sub && <div className="text-xs text-gray-500 mt-0.5">{c.sub}</div>}
        </button>
      ))}
    </div>
  )
}

// ── Low Stock View ──
function LowStockView({ data }) {
  if (!data.items?.length) {
    return <EmptyState message="No low stock items found" />
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">{data.count} items below threshold</p>
      <div className="space-y-2">
        {data.items.map((item, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    item.stock_status === 'out' ? 'bg-red-500'
                    : item.stock_status === 'critical' ? 'bg-red-400'
                    : 'bg-amber-400'
                  }`} />
                  <span className="font-medium text-gray-900 text-sm truncate">{item.item_name}</span>
                  {item.is_critical && <span className="text-xs text-red-600 font-medium">CRITICAL</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{item.item_code}</span>
                  <span>{item.camp_code}</span>
                  <span>{item.group_code}</span>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.stock_status]}`}>
                  {item.stock_status}
                </span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
              <div>
                <div className="text-gray-400">On Hand</div>
                <div className="font-semibold">{item.current_qty} {item.uom}</div>
              </div>
              <div>
                <div className="text-gray-400">Par Level</div>
                <div className="font-semibold">{item.par_level ?? '-'}</div>
              </div>
              <div>
                <div className="text-gray-400">Daily Use</div>
                <div className="font-semibold">{item.avg_daily_usage ?? '-'}</div>
              </div>
              <div>
                <div className="text-gray-400">Days Left</div>
                <div className={`font-semibold ${
                  item.days_left !== null && item.days_left <= 3 ? 'text-red-600'
                  : item.days_left !== null && item.days_left <= 7 ? 'text-amber-600'
                  : ''
                }`}>
                  {item.days_left !== null ? `${item.days_left}d` : '-'}
                </div>
              </div>
            </div>
            {item.reorder_qty && (
              <div className="mt-2 bg-emerald-50 text-emerald-700 text-xs rounded px-2 py-1">
                Suggested reorder: <strong>{item.reorder_qty} {item.uom}</strong>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── Projections View ──
function ProjectionsView({ data }) {
  if (!data.items?.length) {
    return <EmptyState message={`No items projected to run out within ${data.days_horizon} days`} />
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">
        {data.count} items will stock out within {data.days_horizon} days
      </p>
      <div className="space-y-2">
        {data.items.map((item, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm truncate">{item.item_name}</span>
                  {item.is_critical && <span className="text-xs text-red-600 font-medium">CRITICAL</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{item.item_code}</span>
                  <span>{item.camp_code} — {item.camp_name}</span>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${
                  item.days_until_stockout <= 3 ? 'text-red-600'
                  : item.days_until_stockout <= 7 ? 'text-amber-600'
                  : 'text-orange-500'
                }`}>
                  {item.days_until_stockout}d
                </div>
                <div className="text-[10px] text-gray-400">until out</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs">
              <div>
                <span className="text-gray-400">Stock: </span>
                <span className="font-medium">{item.current_qty} {item.uom}</span>
              </div>
              <div>
                <span className="text-gray-400">Usage: </span>
                <span className="font-medium">{item.avg_daily_usage}/day</span>
              </div>
              <div>
                <span className="text-gray-400">Out by: </span>
                <span className="font-medium text-red-600">{item.projected_stockout_date}</span>
              </div>
            </div>
            {/* Progress bar showing depletion */}
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  item.days_until_stockout <= 3 ? 'bg-red-500'
                  : item.days_until_stockout <= 7 ? 'bg-amber-500'
                  : 'bg-orange-400'
                }`}
                style={{ width: `${Math.max(5, Math.min(100, (item.days_until_stockout / data.days_horizon) * 100))}%` }}
              />
            </div>
            <div className="mt-1 bg-blue-50 text-blue-700 text-xs rounded px-2 py-1">
              Reorder suggestion: <strong>{item.suggested_reorder_qty} {item.uom}</strong>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── Dead Stock View ──
function DeadStockView({ data }) {
  if (!data.items?.length) {
    return <EmptyState message={`No items with ${data.min_days}+ days of no movement`} />
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{data.count} items with no movement</p>
        <p className="text-sm font-medium text-gray-700">
          Total value: <span className="text-red-600">TZS {Number(data.total_value).toLocaleString()}</span>
        </p>
      </div>
      <div className="space-y-2">
        {data.items.map((item, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-gray-900 text-sm">{item.item_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {item.item_code} · {item.camp_code} · {item.group_code}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-400">{item.days_no_movement}d</div>
                <div className="text-[10px] text-gray-400">no movement</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs">
              <div>
                <span className="text-gray-400">Qty: </span>
                <span className="font-medium">{item.current_qty} {item.uom}</span>
              </div>
              <div>
                <span className="text-gray-400">Value: </span>
                <span className="font-medium">TZS {Number(item.current_value).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-400">Last issue: </span>
                <span className="font-medium">{item.last_issue_date || 'Never'}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── Excess View ──
function ExcessView({ data }) {
  if (!data.items?.length) {
    return <EmptyState message="No excess stock items found" />
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{data.count} items above max level</p>
        <p className="text-sm font-medium text-gray-700">
          Excess value: <span className="text-blue-600">TZS {Number(data.total_excess_value).toLocaleString()}</span>
        </p>
      </div>
      <div className="space-y-2">
        {data.items.map((item, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-gray-900 text-sm">{item.item_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {item.item_code} · {item.camp_code} · {item.group_code}
                </div>
              </div>
              <Badge variant="info">excess</Badge>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
              <div>
                <div className="text-gray-400">On Hand</div>
                <div className="font-semibold">{item.current_qty} {item.uom}</div>
              </div>
              <div>
                <div className="text-gray-400">Max Level</div>
                <div className="font-semibold">{item.max_level ?? '-'}</div>
              </div>
              <div>
                <div className="text-gray-400">Excess Qty</div>
                <div className="font-semibold text-blue-600">{item.excess_qty ?? '-'}</div>
              </div>
              <div>
                <div className="text-gray-400">Days Stock</div>
                <div className="font-semibold">{item.days_stock_on_hand ? `${item.days_stock_on_hand}d` : '-'}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-2">✅</div>
      <div className="text-gray-500">{message}</div>
    </div>
  )
}
