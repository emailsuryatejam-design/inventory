import { useState, useEffect, useRef } from 'react'
import { useUser, isManager } from '../context/AppContext'
import { kitchenRequisitions as reqApi } from '../services/api'
import {
  ChefHat, CalendarDays, ChevronLeft, ChevronRight, Plus, Search,
  Send, Package, Loader2, X, AlertTriangle, Eye, ClipboardList
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

// ── Date helpers ────────────────────────────────────
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

function isToday(dateStr) { return dateStr === todayStr() }

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
export default function KitchenRequisition() {
  const user = useUser()
  const canManage = isManager(user?.role)

  // State
  const [date, setDate] = useState(todayStr())
  const [requisitions, setRequisitions] = useState([])
  const [activeTabId, setActiveTabId] = useState(null)
  const [activeReq, setActiveReq] = useState(null)
  const [dishes, setDishes] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [guestCount, setGuestCount] = useState('')

  // Dish search
  const [showDishSearch, setShowDishSearch] = useState(false)
  const [dishQuery, setDishQuery] = useState('')
  const [dishResults, setDishResults] = useState([])
  const [dishSearchLoading, setDishSearchLoading] = useState(false)
  const debounceRef = useRef(null)
  const searchInputRef = useRef(null)

  // ── Load requisitions for date ──
  useEffect(() => { loadRequisitions() }, [date])

  async function loadRequisitions() {
    setLoading(true)
    setError('')
    try {
      const result = await reqApi.list(date)
      const list = result.requisitions || []
      setRequisitions(list)
      // Auto-select first tab
      if (list.length > 0) {
        const firstId = list[0].id
        setActiveTabId(firstId)
        loadDetail(firstId)
      } else {
        setActiveTabId(null)
        setActiveReq(null)
        setDishes([])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(reqId) {
    if (!reqId) return
    setDetailLoading(true)
    try {
      const result = await reqApi.get(reqId)
      setActiveReq(result.requisition || result)
      setGuestCount(result.requisition?.guest_count || result.guest_count || '')
      // Load dishes with ingredients
      const dishData = await reqApi.getDishesWithIngredients(reqId)
      setDishes(dishData.dishes || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Date navigation ──
  function changeDate(days) {
    setDate(prev => {
      const d = new Date(prev + 'T00:00:00')
      d.setDate(d.getDate() + days)
      return toDateStr(d)
    })
  }

  // ── Auto-create all meal types for date ──
  async function handleStartDay() {
    setSaving(true)
    setError('')
    try {
      await reqApi.autoCreateForDate({ date })
      await loadRequisitions()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Tab switch ──
  function handleTabClick(reqId) {
    setActiveTabId(reqId)
    loadDetail(reqId)
  }

  // ── Dish search ──
  useEffect(() => {
    if (!dishQuery.trim() || dishQuery.trim().length < 2) {
      setDishResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setDishSearchLoading(true)
      try {
        const data = await reqApi.searchRecipes(dishQuery.trim())
        setDishResults(data.recipes || [])
      } catch {
        setDishResults([])
      } finally {
        setDishSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [dishQuery])

  async function handleAddDish(recipe) {
    if (!activeTabId) return
    setSaving(true)
    try {
      await reqApi.addSingleDish(activeTabId, recipe.id)
      setDishQuery('')
      setDishResults([])
      setShowDishSearch(false)
      await loadDetail(activeTabId)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Save & Submit ──
  async function handleSubmit() {
    if (!activeTabId) return
    setSaving(true)
    setError('')
    try {
      await reqApi.submit(activeTabId)
      await loadRequisitions()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Supplementary order ──
  async function handleSupplementary() {
    if (!activeTabId) return
    setSaving(true)
    setError('')
    try {
      await reqApi.createSupplementary(activeTabId)
      await loadRequisitions()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pb-8" data-guide="nav-requisitions">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ChefHat size={22} className="text-orange-600" />
            Kitchen Requisitions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Plan meals and requisition ingredients</p>
        </div>
      </div>

      {/* ── Date Picker ── */}
      <div
        className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-3"
        data-guide="req-date-picker"
      >
        <button onClick={() => changeDate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{formatDate(date)}</p>
          {isToday(date) && <span className="text-[10px] text-green-600 font-medium">Today</span>}
          {!isToday(date) && (
            <button onClick={() => setDate(todayStr())} className="text-[10px] text-blue-600 font-medium">
              Go to Today
            </button>
          )}
        </div>
        <button onClick={() => changeDate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200">
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
      {loading && <LoadingSpinner message="Loading requisitions..." />}

      {/* ── No requisitions — Start Day ── */}
      {!loading && requisitions.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <EmptyState
            icon={CalendarDays}
            title="No requisitions for this date"
            message="Click Start Day to auto-create requisitions for all active meal types"
          />
          <button
            onClick={handleStartDay}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Start Day
          </button>
        </div>
      )}

      {/* ── Meal Type Tabs ── */}
      {!loading && requisitions.length > 0 && (
        <>
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1" data-guide="req-type-select">
            {requisitions.map(req => (
              <button
                key={req.id}
                onClick={() => handleTabClick(req.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTabId === req.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {req.meal_type || req.type_name || 'Meal'}
                <Badge variant={STATUS_VARIANT[req.status] || 'default'} className="ml-1">
                  {req.status}
                </Badge>
              </button>
            ))}
          </div>

          {/* ── Active Requisition Detail ── */}
          {detailLoading ? (
            <LoadingSpinner message="Loading details..." />
          ) : activeReq ? (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {/* Status & Guest Count Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANT[activeReq.status] || 'default'}>
                    {activeReq.status}
                  </Badge>
                  {activeReq.is_supplementary === 1 && (
                    <Badge variant="info">Supplementary</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 font-medium">Guests:</label>
                  <input
                    type="number"
                    value={guestCount}
                    onChange={e => setGuestCount(e.target.value)}
                    placeholder="0"
                    className="w-20 text-center text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                    disabled={activeReq.status !== 'draft'}
                  />
                </div>
              </div>

              {/* Dish Search + Add */}
              {activeReq.status === 'draft' && (
                <div className="px-4 py-3 border-b border-gray-100">
                  {!showDishSearch ? (
                    <button
                      onClick={() => {
                        setShowDishSearch(true)
                        setTimeout(() => searchInputRef.current?.focus(), 100)
                      }}
                      data-guide="req-dish-search"
                      className="flex items-center gap-2 text-sm text-gray-400 hover:text-orange-600 transition"
                    >
                      <Plus size={16} />
                      Add Dish
                    </button>
                  ) : (
                    <div className="relative" data-guide="req-dish-search">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={dishQuery}
                        onChange={e => setDishQuery(e.target.value)}
                        placeholder="Search recipes..."
                        className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                      />
                      <button
                        onClick={() => { setShowDishSearch(false); setDishQuery(''); setDishResults([]) }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={14} />
                      </button>

                      {/* Search results dropdown */}
                      {dishResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                          {dishResults.map(recipe => (
                            <button
                              key={recipe.id}
                              onClick={() => handleAddDish(recipe)}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-orange-50 border-b border-gray-50 last:border-0"
                            >
                              <span className="font-medium text-gray-900">{recipe.name}</span>
                              {recipe.category && (
                                <span className="text-xs text-gray-400 ml-2">{recipe.category}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                      {dishSearchLoading && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                          <Loader2 size={12} className="animate-spin" /> Searching...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Dishes List with Ingredients */}
              {dishes.length === 0 ? (
                <div className="p-6 text-center">
                  <ClipboardList size={32} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No dishes added yet</p>
                  <p className="text-xs text-gray-400">Use "Add Dish" to search and add recipes</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {dishes.map(dish => (
                    <div key={dish.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-900">{dish.dish_name || dish.recipe_name}</h3>
                        {dish.portions && (
                          <span className="text-xs text-gray-400">{dish.portions} portions</span>
                        )}
                      </div>
                      {/* Ingredients preview */}
                      {dish.ingredients && dish.ingredients.length > 0 && (
                        <div className="space-y-1">
                          {dish.ingredients.map(ing => (
                            <div key={ing.id} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">{ing.item_name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-gray-500">
                                  {ing.qty || ing.required_qty} {ing.uom}
                                </span>
                                {activeReq.status === 'fulfilled' && ing.fulfilled_qty != null && (
                                  <span className="text-green-600 font-medium">
                                    Fulfilled: {ing.fulfilled_qty} {ing.uom}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {(activeReq.status === 'submitted' || activeReq.status === 'fulfilled') && (
                    <button
                      onClick={handleSupplementary}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition disabled:opacity-50"
                    >
                      <Plus size={14} />
                      Supplementary Order
                    </button>
                  )}
                </div>
                {activeReq.status === 'draft' && (
                  <button
                    onClick={handleSubmit}
                    disabled={saving || dishes.length === 0}
                    data-guide="req-submit-btn"
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Save & Submit
                  </button>
                )}
                {activeReq.status === 'fulfilled' && (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                    <Package size={14} />
                    Fulfilled by store
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
