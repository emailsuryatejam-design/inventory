import { useState, useEffect, useRef } from 'react'
import { useUser, useSelectedCamp } from '../context/AppContext'
import { kitchenMenu as menuApi } from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  Calendar, ChevronLeft, ChevronRight, AlertTriangle,
  X, Loader2, Search, Plus, Check
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────

function getMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0=Sun,1=Mon...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust for Sunday
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function getSunday(mondayStr) {
  const d = new Date(mondayStr + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return d.toISOString().split('T')[0]
}

function formatWeekRange(mondayStr) {
  const mon = new Date(mondayStr + 'T00:00:00')
  const sun = new Date(mondayStr + 'T00:00:00')
  sun.setDate(sun.getDate() + 6)
  const opts = { day: 'numeric', month: 'short' }
  return `${mon.toLocaleDateString('en-GB', opts)} – ${sun.toLocaleDateString('en-GB', opts)}, ${sun.getFullYear()}`
}

function isCurrentWeek(mondayStr) {
  return mondayStr === getMonday(new Date().toISOString().split('T')[0])
}


// ════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ════════════════════════════════════════════════════════════
export default function WeeklyGroceries() {
  const user = useUser()
  const { campId } = useSelectedCamp()

  // Week
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date().toISOString().split('T')[0]))

  // Data
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ── Load data when week changes ──
  useEffect(() => {
    loadData()
  }, [weekStart, campId])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const data = await menuApi.weeklyIngredients(weekStart)
      setItems(data.ingredients || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Week navigation ──
  function changeWeek(weeks) {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + weeks * 7)
    setWeekStart(d.toISOString().split('T')[0])
  }

  // ── Update tracking field ──
  async function handleUpdateField(itemId, field, value) {
    const numVal = value === '' ? null : parseFloat(value)
    try {
      await menuApi.updateWeeklyGrocery(weekStart, itemId, { [field]: numVal })
      // Optimistic update
      setItems(prev => prev.map(item =>
        item.item_id === itemId ? { ...item, [field]: numVal } : item
      ))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="pb-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={22} className="text-purple-600" />
            Weekly Groceries
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Common ingredients for the week</p>
        </div>
      </div>

      {/* ── Week Navigator ── */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-3">
        <button onClick={() => changeWeek(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{formatWeekRange(weekStart)}</p>
          {isCurrentWeek(weekStart) && <span className="text-[10px] text-green-600 font-medium">This Week</span>}
          {!isCurrentWeek(weekStart) && (
            <button
              onClick={() => setWeekStart(getMonday(new Date().toISOString().split('T')[0]))}
              className="text-[10px] text-purple-600 font-medium"
            >
              Go to This Week
            </button>
          )}
        </div>
        <button onClick={() => changeWeek(1)} className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200">
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError('')}><X size={16} className="text-red-400" /></button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && <LoadingSpinner message="Loading weekly groceries..." />}

      {/* ── Content ── */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-100">
          {/* Add new item row */}
          <AddWeeklyRow
            weekStart={weekStart}
            onAdded={loadData}
            onError={setError}
          />

          {/* Column Headers */}
          {items.length > 0 && (
            <div className="grid grid-cols-[1fr_64px_64px_64px] gap-1 px-3 py-2 bg-gray-50 border-y border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              <span>Item</span>
              <span className="text-center">Stock</span>
              <span className="text-center">Order</span>
              <span className="text-center">Recv</span>
            </div>
          )}

          {/* Item Rows */}
          {items.map(item => (
            <WeeklyItemRow
              key={item.item_id}
              item={item}
              onUpdate={handleUpdateField}
            />
          ))}

          {/* Empty state */}
          {items.length === 0 && (
            <div className="p-6 text-center">
              <Calendar size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No weekly groceries projected</p>
              <p className="text-xs text-gray-400">Items will appear here from menu plans, or add manually above</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ════════════════════════════════════════════════════════════
// ADD WEEKLY ROW — search + pick item to add manually
// ════════════════════════════════════════════════════════════
function AddWeeklyRow({ weekStart, onAdded, onError }) {
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  // Search debounce
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const data = await menuApi.searchItems(query.trim())
        setResults(data.items || [])
      } catch {
        setResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  function handleSelectItem(item) {
    setSelectedItem(item)
    setQuery(item.name)
    setResults([])
  }

  async function handleAdd() {
    if (!selectedItem || !qty) return
    setSaving(true)
    try {
      await menuApi.addWeeklyGrocery(weekStart, selectedItem.id, parseFloat(qty))
      // Reset form
      setSelectedItem(null)
      setQuery('')
      setQty('')
      setResults([])
      onAdded()
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!searching) {
    return (
      <button
        onClick={() => { setSearching(true); setTimeout(() => inputRef.current?.focus(), 100) }}
        className="w-full flex items-center gap-2 px-3 py-3 text-sm text-gray-400 hover:text-purple-600 hover:bg-purple-50/50 transition border-b border-gray-100"
      >
        <Plus size={16} />
        <span>Add item...</span>
      </button>
    )
  }

  return (
    <div className="border-b border-gray-100 px-3 py-3 bg-purple-50/30">
      {/* Search input */}
      <div className="relative mb-2">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedItem(null) }}
          placeholder="Search item..."
          className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
        />
        <button
          onClick={() => { setSearching(false); setQuery(''); setSelectedItem(null); setResults([]) }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>

        {/* Search results dropdown */}
        {results.length > 0 && !selectedItem && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
            {results.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-purple-50 border-b border-gray-50 last:border-0"
              >
                <span className="font-medium text-gray-900">{item.name}</span>
                <span className="text-xs text-gray-400 ml-2">{item.uom}</span>
                {item.stock_qty != null && (
                  <span className="text-xs text-gray-400 ml-1">· Stock: {item.stock_qty}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {searchLoading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" /> Searching...
          </div>
        )}
      </div>

      {/* Selected item — qty + add button */}
      {selectedItem && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={qty}
            onChange={e => setQty(e.target.value)}
            placeholder="Qty"
            className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
          <span className="text-xs text-gray-500">{selectedItem.uom || 'kg'}</span>

          <button
            onClick={handleAdd}
            disabled={!qty || saving}
            className="bg-purple-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 flex items-center gap-1"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Add
          </button>
        </div>
      )}
    </div>
  )
}


// ════════════════════════════════════════════════════════════
// WEEKLY ITEM ROW — editable fields for Order, Received
// ════════════════════════════════════════════════════════════
function WeeklyItemRow({ item, onUpdate }) {
  const [ordered, setOrdered] = useState(item.ordered_qty ?? '')
  const [received, setReceived] = useState(item.received_qty ?? '')

  // Sync from props when data reloads
  useEffect(() => {
    setOrdered(item.ordered_qty ?? '')
    setReceived(item.received_qty ?? '')
  }, [item.ordered_qty, item.received_qty])

  function handleBlur(field, localValue, originalValue) {
    const numLocal = localValue === '' ? null : parseFloat(localValue)
    const numOrig = originalValue ?? null
    if (numLocal !== numOrig) {
      onUpdate(item.item_id, field, localValue)
    }
  }

  return (
    <div className="grid grid-cols-[1fr_64px_64px_64px] gap-1 px-3 py-2.5 border-b border-gray-50 items-center">
      {/* Item name */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.item_name}</p>
        <p className="text-[10px] text-gray-400 truncate">
          Projected: {item.total_qty}{item.uom}
          {item.is_manual ? ' · manual' : ''}
        </p>
      </div>

      {/* Physical Stock */}
      <div className="text-center">
        <span className="text-xs text-gray-600">{item.stock_qty != null ? item.stock_qty : '—'}</span>
      </div>

      {/* Order */}
      <div>
        <input
          type="number"
          value={ordered}
          onChange={e => setOrdered(e.target.value)}
          onBlur={() => handleBlur('ordered_qty', ordered, item.ordered_qty)}
          placeholder="—"
          className="w-full text-center text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-400"
        />
      </div>

      {/* Received */}
      <div>
        <input
          type="number"
          value={received}
          onChange={e => setReceived(e.target.value)}
          onBlur={() => handleBlur('received_qty', received, item.received_qty)}
          placeholder="—"
          className="w-full text-center text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-400"
        />
      </div>
    </div>
  )
}
