import { useState, useEffect, useCallback } from 'react'
import { useUser } from '../context/AppContext'
import { barReports as api } from '../services/api'
import {
  BarChart3, TrendingUp, Users, Clock, Calendar, CreditCard,
  Loader2, AlertTriangle, RefreshCw
} from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const REPORTS = [
  { key: 'top_selling', label: 'Top Selling', icon: BarChart3, color: 'bg-blue-500' },
  { key: 'profitability', label: 'Profitability', icon: TrendingUp, color: 'bg-green-500' },
  { key: 'server_performance', label: 'Server Performance', icon: Users, color: 'bg-purple-500' },
  { key: 'hourly', label: 'Hourly Sales', icon: Clock, color: 'bg-orange-500' },
  { key: 'daily_summary', label: 'Daily Summary', icon: Calendar, color: 'bg-indigo-500' },
  { key: 'payment_methods', label: 'Payment Methods', icon: CreditCard, color: 'bg-pink-500' },
]

export default function BarReports() {
  const user = useUser()
  const [activeReport, setActiveReport] = useState('top_selling')
  const [dateFrom, setDateFrom] = useState(getFirstOfMonth())
  const [dateTo, setDateTo] = useState(getToday())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function getFirstOfMonth() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }
  function getToday() {
    return new Date().toISOString().split('T')[0]
  }

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = { date_from: dateFrom, date_to: dateTo }
      const fetchers = {
        top_selling: () => api.topSelling(params),
        profitability: () => api.profitability(params),
        server_performance: () => api.serverPerformance(params),
        hourly: () => api.hourly(params),
        daily_summary: () => api.dailySummary(params),
        payment_methods: () => api.paymentMethods(params),
      }
      const result = await fetchers[activeReport]()
      setData(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [activeReport, dateFrom, dateTo])

  useEffect(() => { fetchReport() }, [fetchReport])

  const formatMoney = (v) => (v ?? 0).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bar Reports</h1>
          <p className="text-sm text-gray-500">Analytics and performance insights</p>
        </div>
        <button onClick={fetchReport} className="flex items-center gap-1.5 text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {REPORTS.map(r => (
          <button key={r.key} onClick={() => setActiveReport(r.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${activeReport === r.key ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <r.icon className="w-4 h-4" />{r.label}
          </button>
        ))}
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-3">
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <span className="text-gray-400">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"><AlertTriangle className="w-4 h-4 inline mr-1" />{error}</div>}
      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}

      {/* Report Content */}
      {!loading && data && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {activeReport === 'top_selling' && <TopSellingReport data={data} formatMoney={formatMoney} />}
          {activeReport === 'profitability' && <ProfitabilityReport data={data} formatMoney={formatMoney} />}
          {activeReport === 'server_performance' && <ServerReport data={data} formatMoney={formatMoney} />}
          {activeReport === 'hourly' && <HourlyReport data={data} formatMoney={formatMoney} />}
          {activeReport === 'daily_summary' && <DailySummaryReport data={data} formatMoney={formatMoney} />}
          {activeReport === 'payment_methods' && <PaymentMethodsReport data={data} formatMoney={formatMoney} />}
        </div>
      )}
    </div>
  )
}

function TopSellingReport({ data, formatMoney }) {
  const items = data.items || []
  const maxQty = Math.max(...items.map(i => i.total_qty), 1)
  return (
    <div>
      <div className="px-4 py-3 bg-gray-50 border-b font-medium text-sm text-gray-600">Top Selling Items</div>
      <div className="divide-y">
        {items.map((item, i) => (
          <div key={item.item_id} className="px-4 py-3 flex items-center gap-4">
            <span className="w-6 text-center text-sm font-medium text-gray-400">#{i + 1}</span>
            <div className="flex-1">
              <div className="font-medium text-sm">{item.item_name}</div>
              <div className="text-xs text-gray-500">{item.item_code} · {item.group_name} · {item.tab_count} tabs</div>
              <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(item.total_qty / maxQty) * 100}%` }} />
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium text-sm">{formatMoney(item.total_revenue)}</div>
              <div className="text-xs text-gray-500">{item.total_qty} units</div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="px-4 py-8 text-center text-gray-400 text-sm">No data for selected period</div>}
      </div>
    </div>
  )
}

function ProfitabilityReport({ data, formatMoney }) {
  const items = data.items || []
  return (
    <div className="overflow-x-auto">
      <div className="px-4 py-3 bg-gray-50 border-b font-medium text-sm text-gray-600">Profitability Analysis</div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-4 py-2">Item</th>
            <th className="px-4 py-2 text-right">Qty</th>
            <th className="px-4 py-2 text-right">Revenue</th>
            <th className="px-4 py-2 text-right">Cost</th>
            <th className="px-4 py-2 text-right">Margin</th>
            <th className="px-4 py-2 text-right">Margin %</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map(item => (
            <tr key={item.item_id} className="hover:bg-gray-50">
              <td className="px-4 py-2.5 font-medium">{item.item_name}</td>
              <td className="px-4 py-2.5 text-right">{item.total_qty}</td>
              <td className="px-4 py-2.5 text-right">{formatMoney(item.total_revenue)}</td>
              <td className="px-4 py-2.5 text-right">{formatMoney(item.total_cost)}</td>
              <td className={`px-4 py-2.5 text-right font-medium ${item.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(item.margin)}
              </td>
              <td className={`px-4 py-2.5 text-right ${item.margin_pct >= 50 ? 'text-green-600' : item.margin_pct >= 20 ? 'text-orange-600' : 'text-red-600'}`}>
                {item.margin_pct}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <div className="px-4 py-8 text-center text-gray-400 text-sm">No data for selected period</div>}
    </div>
  )
}

function ServerReport({ data, formatMoney }) {
  const servers = data.servers || []
  return (
    <div className="overflow-x-auto">
      <div className="px-4 py-3 bg-gray-50 border-b font-medium text-sm text-gray-600">Server Performance</div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-4 py-2">Server</th>
            <th className="px-4 py-2 text-right">Tabs</th>
            <th className="px-4 py-2 text-right">Total Sales</th>
            <th className="px-4 py-2 text-right">Avg Tab</th>
            <th className="px-4 py-2 text-right">Covers</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {servers.map(s => (
            <tr key={s.server_id} className="hover:bg-gray-50">
              <td className="px-4 py-2.5 font-medium">{s.server_name}</td>
              <td className="px-4 py-2.5 text-right">{s.tab_count}</td>
              <td className="px-4 py-2.5 text-right font-medium">{formatMoney(s.total_sales)}</td>
              <td className="px-4 py-2.5 text-right">{formatMoney(s.avg_tab_value)}</td>
              <td className="px-4 py-2.5 text-right">{s.total_covers}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {servers.length === 0 && <div className="px-4 py-8 text-center text-gray-400 text-sm">No data for selected period</div>}
    </div>
  )
}

function HourlyReport({ data, formatMoney }) {
  const hours = data.hours || []
  const maxSales = Math.max(...hours.map(h => h.total_sales), 1)
  return (
    <div>
      <div className="px-4 py-3 bg-gray-50 border-b font-medium text-sm text-gray-600">Hourly Sales Distribution</div>
      <div className="p-4 space-y-2">
        {hours.map(h => (
          <div key={h.hour} className="flex items-center gap-3">
            <span className="w-14 text-xs text-gray-500 text-right">{String(h.hour).padStart(2, '0')}:00</span>
            <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden relative">
              <div className="h-full bg-orange-400 rounded" style={{ width: `${(h.total_sales / maxSales) * 100}%` }} />
              {h.total_sales > 0 && (
                <span className="absolute right-2 top-0.5 text-xs font-medium">{formatMoney(h.total_sales)}</span>
              )}
            </div>
            <span className="w-8 text-xs text-gray-500">{h.tab_count}</span>
          </div>
        ))}
        {hours.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">No data for selected period</div>}
      </div>
    </div>
  )
}

function DailySummaryReport({ data, formatMoney }) {
  const days = data.days || []
  return (
    <div className="overflow-x-auto">
      <div className="px-4 py-3 bg-gray-50 border-b font-medium text-sm text-gray-600">Daily Summary</div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2 text-right">Tabs</th>
            <th className="px-4 py-2 text-right">Sales</th>
            <th className="px-4 py-2 text-right">Discounts</th>
            <th className="px-4 py-2 text-right">Voids</th>
            <th className="px-4 py-2 text-right">Covers</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {days.map(d => (
            <tr key={d.date} className="hover:bg-gray-50">
              <td className="px-4 py-2.5 font-medium">{new Date(d.date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}</td>
              <td className="px-4 py-2.5 text-right">{d.tab_count}</td>
              <td className="px-4 py-2.5 text-right font-medium">{formatMoney(d.total_sales)}</td>
              <td className="px-4 py-2.5 text-right text-orange-600">{d.total_discounts > 0 ? formatMoney(d.total_discounts) : '—'}</td>
              <td className="px-4 py-2.5 text-right text-red-600">{d.total_voids > 0 ? formatMoney(d.total_voids) : '—'}</td>
              <td className="px-4 py-2.5 text-right">{d.total_covers}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {days.length === 0 && <div className="px-4 py-8 text-center text-gray-400 text-sm">No data for selected period</div>}
    </div>
  )
}

function PaymentMethodsReport({ data, formatMoney }) {
  const methods = data.methods || []
  const total = methods.reduce((s, m) => s + m.total_sales, 0)
  const colors = { cash: 'bg-green-500', card: 'bg-blue-500', mpesa: 'bg-orange-500', room_charge: 'bg-purple-500', split: 'bg-yellow-500', complimentary: 'bg-gray-400' }
  return (
    <div>
      <div className="px-4 py-3 bg-gray-50 border-b font-medium text-sm text-gray-600">Payment Methods</div>
      <div className="p-4 space-y-4">
        {/* Bar */}
        {total > 0 && (
          <div className="h-6 flex rounded-full overflow-hidden">
            {methods.map(m => (
              <div key={m.payment_method} className={`${colors[m.payment_method] || 'bg-gray-300'}`}
                style={{ width: `${(m.total_sales / total) * 100}%` }} title={`${m.payment_method}: ${formatMoney(m.total_sales)}`} />
            ))}
          </div>
        )}
        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {methods.map(m => (
            <div key={m.payment_method} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${colors[m.payment_method] || 'bg-gray-300'}`} />
              <div>
                <div className="text-sm capitalize font-medium">{m.payment_method.replace('_', ' ')}</div>
                <div className="text-xs text-gray-500">{formatMoney(m.total_sales)} ({m.tab_count} tabs)</div>
              </div>
            </div>
          ))}
        </div>
        {methods.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">No data for selected period</div>}
      </div>
    </div>
  )
}
