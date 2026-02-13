import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser, useSelectedCamp } from '../context/AppContext'
import { kitchenMenu as menuApi } from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  ClipboardList, ChevronLeft, ChevronRight, AlertTriangle,
  X, Loader2, Search, Plus, Check
} from 'lucide-react'

// ── Constants ────────────────────────────────────────
const MEALS = [
  { value: 'lunch', label: 'Lunch', icon: '\u2600\uFE0F' },
  { value: 'dinner', label: 'Dinner', icon: '\uD83C\uDF19' },
]

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().split('T')[0]
}


// ════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ════════════════════════════════════════════════════════════
export default function DailyGroceries() {
  const user = useUser()
  const { campId } = useSelectedCamp()

  // Date + meal
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [meal, setMeal] = useState('lunch')

  // Data
  const [plan, setPlan] = useState(null)
  const [dishes, setDishes] = useState([])
  const [ingredients, setIngredients] = useState([]) // flattened primary ingredients
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ── Load plan when date/meal changes ──
  useEffect(() => {
    loadData()
  }, [date, meal, campId])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const data = await menuApi.plan(date, meal)
      setPlan(data.plan)
      setDishes(data.dishes || [])

      // Flatten primary ingredients across all dishes
      const flat = []
      for (const dish of (data.dishes || [])) {
        for (const ing of dish.ingredients) {
          if (ing.is_removed) continue
          if (!ing.is_primary) continue
          flat.push({
            ...ing,
            dish_name: dish.dish_name,
            dish_id: dish.id,
          })
        }
      }
      setIngredients(flat)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Date navigation ──
  function changeDate(days) {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + days)
    setDate(d.toISOString().split('T')[0])
  }

  // ── Update tracking field ──
  async function handleUpdateField(ingredientId, field, value) {
    const numVal = value === '' ? null : parseFloat(value)
    try {
      await menuApi.updateDailyTracking(ingredientId, { [field]: numVal })
      // Update local state optimistically
      setIngredients(prev => prev.map(ing =>
        ing.id === ingredientId ? { ...ing, [field]: numVal } : ing
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
            <ClipboardList size={22} className="text-blue-600" />
            Daily Groceries
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Order &amp; track daily ingredients</p>
        </div>
      </div>

      {/* ── Date Picker ── */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-3">
        <button onClick={() => changeDate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{formatDate(date)}</p>
          {isToday(date) && <span className="text-[10px] text-green-600 font-medium">Today</span>}
          {!isToday(date) && (
            <button onClick={() => setDate(new Date().toISOString().split('T')[0])} className="text-[10px] text-blue-600 font-medium">
              Go to Today
            </button>
          )}
        </div>
        <button onClick={() => changeDate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200">
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* ── Meal Toggle ── */}
      <div className="flex gap-2 mb-3">
        {MEALS.map(m => (
          <button
            key={m.value}
            onClick={() => setMeal(m.value)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              meal === m.value
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {m.icon} {m.label}
          </button>
        ))}
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
      {loading && <LoadingSpinner message="Loading groceries..." />}

      {/* ── Content ── */}
      {!loading && (
        <>
          {/* Empty state */}
          {!plan && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <ClipboardList size={36} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-1">No menu plan for this day</p>
              <p className="text-xs text-gray-400">Create a menu plan first to see daily groceries</p>
            </div>
          )}

          {plan && ingredients.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center mb-3">
              <ClipboardList size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No daily ingredients yet</p>
              <p className="text-xs text-gray-400">Add daily ingredients from the add row below</p>
            </div>
          )}

          {/* ── Add Row + Ingredients Table ── */}
          {plan && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {/* Add new item row */}
              <AddItemRow
                dishes={dishes}
                onAdded={loadData}
                onError={setError}
              />

              {/* Column Headers */}
              {ingredients.length > 0 && (
                <div className="grid grid-cols-[1fr_60px_60px_60px_60px] gap-1 px-3 py-2 bg-gray-50 border-y border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  <span>Item</span>
                  <span className="text-center">Stock</span>
                  <span className="text-center">Order</span>
                  <span className="text-center">Recv</span>
                  <span className="text-center">Used</span>
                </div>
              )}

              {/* Ingredient Rows */}
              {ingredients.map(ing => (
                <IngredientRow
                  key={ing.id}
                  ingredient={ing}
                  onUpdate={handleUpdateField}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}


// ════════════════════════════════════════════════════════════
// ADD ITEM ROW — search + pick item, assign to dish
// ════════════════════════════════════════════════════════════
function AddItemRow({ dishes, onAdded, onError }) {
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [qty, setQty] = useState('')
  const [selectedDish, setSelectedDish] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  // Auto-select first dish
  useEffect(() => {
    if (dishes.length > 0 && !selectedDish) {
      setSelectedDish(String(dishes[0].id))
    }
  }, [dishes])

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
    if (!selectedItem || !qty || !selectedDish) return
    setSaving(true)
    try {
      await menuApi.addIngredient(
        parseInt(selectedDish),
        selectedItem.id,
        parseFloat(qty),
        selectedItem.uom || 'kg'
      )
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
        className="w-full flex items-center gap-2 px-3 py-3 text-sm text-gray-400 hover:text-blue-600 hover:bg-blue-50/50 transition border-b border-gray-100"
      >
        <Plus size={16} />
        <span>Add item...</span>
      </button>
    )
  }

  return (
    <div className="border-b border-gray-100 px-3 py-3 bg-blue-50/30">
      {/* Search input */}
      <div className="relative mb-2">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedItem(null) }}
          placeholder="Search item..."
          className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        />
        <button
          onClick={() => { setSearching(false); setQuery(''); setSelectedItem(null); setResults([]) }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>

        {/* Search results dropdown */}
        {results.length > 0 && !selectedItem && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
            {results.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
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

      {/* Selected item — qty + dish picker + add button */}
      {selectedItem && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={qty}
            onChange={e => setQty(e.target.value)}
            placeholder="Qty"
            className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <span className="text-xs text-gray-500">{selectedItem.uom || 'kg'}</span>

          {dishes.length > 1 && (
            <select
              value={selectedDish}
              onChange={e => setSelectedDish(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none bg-white"
            >
              {dishes.map(d => (
                <option key={d.id} value={d.id}>{d.dish_name}</option>
              ))}
            </select>
          )}

          <button
            onClick={handleAdd}
            disabled={!qty || saving}
            className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 flex items-center gap-1"
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
// INGREDIENT ROW — editable fields for Order, Received, Consumed
// ════════════════════════════════════════════════════════════
function IngredientRow({ ingredient, onUpdate }) {
  const ing = ingredient
  const [ordered, setOrdered] = useState(ing.ordered_qty ?? '')
  const [received, setReceived] = useState(ing.received_qty ?? '')
  const [consumed, setConsumed] = useState(ing.consumed_qty ?? '')

  // Sync from props when data reloads
  useEffect(() => {
    setOrdered(ing.ordered_qty ?? '')
    setReceived(ing.received_qty ?? '')
    setConsumed(ing.consumed_qty ?? '')
  }, [ing.ordered_qty, ing.received_qty, ing.consumed_qty])

  function handleBlur(field, localValue, originalValue) {
    const numLocal = localValue === '' ? null : parseFloat(localValue)
    const numOrig = originalValue ?? null
    if (numLocal !== numOrig) {
      onUpdate(ing.id, field, localValue)
    }
  }

  return (
    <div className="grid grid-cols-[1fr_60px_60px_60px_60px] gap-1 px-3 py-2.5 border-b border-gray-50 items-center">
      {/* Item name + dish */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{ing.item_name}</p>
        <p className="text-[10px] text-gray-400 truncate">
          {ing.dish_name} · {ing.final_qty}{ing.uom}
        </p>
      </div>

      {/* Stock */}
      <div className="text-center">
        <span className="text-xs text-gray-600">{ing.stock_qty != null ? ing.stock_qty : '—'}</span>
      </div>

      {/* Order */}
      <div>
        <input
          type="number"
          value={ordered}
          onChange={e => setOrdered(e.target.value)}
          onBlur={() => handleBlur('ordered_qty', ordered, ing.ordered_qty)}
          placeholder="—"
          className="w-full text-center text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-400"
        />
      </div>

      {/* Received */}
      <div>
        <input
          type="number"
          value={received}
          onChange={e => setReceived(e.target.value)}
          onBlur={() => handleBlur('received_qty', received, ing.received_qty)}
          placeholder="—"
          className="w-full text-center text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-400"
        />
      </div>

      {/* Consumed */}
      <div>
        <input
          type="number"
          value={consumed}
          onChange={e => setConsumed(e.target.value)}
          onBlur={() => handleBlur('consumed_qty', consumed, ing.consumed_qty)}
          placeholder="—"
          className="w-full text-center text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-400"
        />
      </div>
    </div>
  )
}
