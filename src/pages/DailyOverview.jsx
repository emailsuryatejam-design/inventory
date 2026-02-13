import { useState, useEffect } from 'react'
import { useUser, useSelectedCamp } from '../context/AppContext'
import { dailyOverview as overviewApi } from '../services/api'
import {
  ChevronLeft, ChevronRight, Calendar, Boxes, ShoppingCart,
  PackageCheck, Wine, UtensilsCrossed, Loader2, AlertTriangle,
  ArrowUpDown, Search, X
} from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

// Format YYYY-MM-DD using LOCAL time (never UTC — avoids timezone bugs in EAT/GMT+3)
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

export default function DailyOverview() {
  const user = useUser()
  const { campId, camps } = useSelectedCamp()
  const [date, setDate] = useState(todayStr())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [campName, setCampName] = useState('')
  const [sortField, setSortField] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [filterGroup, setFilterGroup] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadData()
  }, [date, campId])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const params = { date }
      if (campId) params.camp_id = campId
      const data = await overviewApi.get(params)
      setItems(data.items || [])
      setCampName(data.camp_name || '')
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

  function goToToday() {
    setDate(todayStr())
  }

  // Sorting
  function toggleSort(field) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // Get unique groups for filter
  const groups = [...new Set(items.map(i => i.group_code).filter(Boolean))].sort()

  // Filter and sort
  const filtered = items
    .filter(i => {
      if (filterGroup && i.group_code !== filterGroup) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return i.name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortField === 'name') return a.name.localeCompare(b.name) * dir
      return ((a[sortField] || 0) - (b[sortField] || 0)) * dir
    })

  // Summary totals
  const totals = {
    stock: filtered.reduce((s, i) => s + i.stock, 0),
    ordered: filtered.reduce((s, i) => s + i.ordered, 0),
    received: filtered.reduce((s, i) => s + i.received, 0),
    bar_issued: filtered.reduce((s, i) => s + i.bar_issued, 0),
    kitchen_issued: filtered.reduce((s, i) => s + i.kitchen_issued, 0),
  }

  const SortButton = ({ field, label, icon: Icon }) => (
    <button
      onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 text-[10px] sm:text-xs font-medium uppercase tracking-wide ${
        sortField === field ? 'text-green-700' : 'text-gray-500'
      }`}
    >
      {Icon && <Icon size={12} className="hidden sm:block" />}
      {label}
      {sortField === field && (
        <span className="text-[9px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </button>
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={22} className="text-green-600" />
            Daily Overview
          </h1>
          <p className="text-sm text-gray-500">{campName || user?.camp_name || 'All Camps'}</p>
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
            <p className="text-lg font-bold text-gray-900">{formatDate(date)}</p>
            {isToday(date) ? (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Today</span>
            ) : (
              <button
                onClick={goToToday}
                className="text-xs text-green-600 hover:text-green-700 font-medium"
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
          <AlertTriangle size={16} />{error}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
        {/* Group filter pills */}
        <button
          onClick={() => setFilterGroup('')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
            !filterGroup ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({items.length})
        </button>
        {groups.map(g => {
          const count = items.filter(i => i.group_code === g).length
          return (
            <button
              key={g}
              onClick={() => setFilterGroup(g)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                filterGroup === g ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {g} ({count})
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter items..."
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <X size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading daily overview..." />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Boxes size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No items with activity for this date</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            <div className="bg-white rounded-xl border border-gray-200 p-2.5 text-center">
              <Boxes size={16} className="mx-auto text-blue-500 mb-1" />
              <p className="text-sm font-bold text-gray-900">{Math.round(totals.stock)}</p>
              <p className="text-[10px] text-gray-500">Stock</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-2.5 text-center">
              <ShoppingCart size={16} className="mx-auto text-green-500 mb-1" />
              <p className="text-sm font-bold text-gray-900">{Math.round(totals.ordered)}</p>
              <p className="text-[10px] text-gray-500">Ordered</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-2.5 text-center">
              <PackageCheck size={16} className="mx-auto text-purple-500 mb-1" />
              <p className="text-sm font-bold text-gray-900">{Math.round(totals.received)}</p>
              <p className="text-[10px] text-gray-500">Received</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-2.5 text-center">
              <Wine size={16} className="mx-auto text-amber-600 mb-1" />
              <p className="text-sm font-bold text-gray-900">{Math.round(totals.bar_issued)}</p>
              <p className="text-[10px] text-gray-500">Bar</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-2.5 text-center">
              <UtensilsCrossed size={16} className="mx-auto text-orange-500 mb-1" />
              <p className="text-sm font-bold text-gray-900">{Math.round(totals.kitchen_issued)}</p>
              <p className="text-[10px] text-gray-500">Kitchen</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5">
                      <SortButton field="name" label="Item" />
                    </th>
                    <th className="text-center px-3 py-2.5">
                      <SortButton field="stock" label="Stock" icon={Boxes} />
                    </th>
                    <th className="text-center px-3 py-2.5">
                      <SortButton field="ordered" label="Ordered" icon={ShoppingCart} />
                    </th>
                    <th className="text-center px-3 py-2.5">
                      <SortButton field="received" label="Received" icon={PackageCheck} />
                    </th>
                    <th className="text-center px-3 py-2.5">
                      <SortButton field="bar_issued" label="Bar" icon={Wine} />
                    </th>
                    <th className="text-center px-3 py-2.5">
                      <SortButton field="kitchen_issued" label="Kitchen" icon={UtensilsCrossed} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.item_code} · {item.uom}</p>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold ${
                          item.stock_status === 'critical' || item.stock_status === 'out'
                            ? 'bg-red-100 text-red-700'
                            : item.stock_status === 'low'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                          {item.stock}
                        </span>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        {item.ordered > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            {item.ordered}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="text-center px-3 py-2.5">
                        {item.received > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                            {item.received}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="text-center px-3 py-2.5">
                        {item.bar_issued > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                            {item.bar_issued}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="text-center px-3 py-2.5">
                        {item.kitchen_issued > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                            {item.kitchen_issued}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {/* Mobile column headers */}
              <div className="grid grid-cols-5 gap-1 px-3 py-2 bg-gray-50 text-[9px] font-bold text-gray-500 uppercase text-center">
                <span className="text-left col-span-5 mb-1 text-xs text-gray-700">
                  {filtered.length} items
                </span>
              </div>
              {filtered.map(item => (
                <div key={item.id} className="px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{item.item_code} · {item.uom}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    <div className="text-center">
                      <span className={`block text-xs font-bold rounded-md py-0.5 ${
                        item.stock_status === 'critical' || item.stock_status === 'out'
                          ? 'bg-red-100 text-red-700'
                          : item.stock_status === 'low'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {item.stock}
                      </span>
                      <span className="text-[8px] text-gray-400 mt-0.5 block">Stock</span>
                    </div>
                    <div className="text-center">
                      <span className={`block text-xs font-bold rounded-md py-0.5 ${
                        item.ordered > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-300'
                      }`}>
                        {item.ordered || '—'}
                      </span>
                      <span className="text-[8px] text-gray-400 mt-0.5 block">Order</span>
                    </div>
                    <div className="text-center">
                      <span className={`block text-xs font-bold rounded-md py-0.5 ${
                        item.received > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-50 text-gray-300'
                      }`}>
                        {item.received || '—'}
                      </span>
                      <span className="text-[8px] text-gray-400 mt-0.5 block">Recd</span>
                    </div>
                    <div className="text-center">
                      <span className={`block text-xs font-bold rounded-md py-0.5 ${
                        item.bar_issued > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-300'
                      }`}>
                        {item.bar_issued || '—'}
                      </span>
                      <span className="text-[8px] text-gray-400 mt-0.5 block">Bar</span>
                    </div>
                    <div className="text-center">
                      <span className={`block text-xs font-bold rounded-md py-0.5 ${
                        item.kitchen_issued > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-300'
                      }`}>
                        {item.kitchen_issued || '—'}
                      </span>
                      <span className="text-[8px] text-gray-400 mt-0.5 block">Kitchen</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center mt-3">
            {filtered.length} items shown · {formatDate(date)}
          </p>
        </>
      )}
    </div>
  )
}
