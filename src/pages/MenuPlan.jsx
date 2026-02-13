import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useUser, useSelectedCamp } from '../context/AppContext'
import { kitchenMenu as menuApi } from '../services/api'
import { lockScroll, unlockScroll } from '../utils/scrollLock'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  ChefHat, ChevronLeft, ChevronRight, Calendar, Plus, Trash2,
  Loader2, Sparkles, Search, X, Check, AlertTriangle,
  UtensilsCrossed, Minus, ClipboardList, Users as UsersIcon,
  Clock, History, CheckCircle, RotateCcw, Package
} from 'lucide-react'

// ── Constants ────────────────────────────────────────
const COURSES = [
  { value: 'appetizer', label: 'Appetizer', emoji: '\uD83E\uDD57' },
  { value: 'soup', label: 'Soup', emoji: '\uD83C\uDF5C' },
  { value: 'salad', label: 'Salad', emoji: '\uD83E\uDD57' },
  { value: 'main_course', label: 'Main Course', emoji: '\uD83C\uDF56' },
  { value: 'side', label: 'Side', emoji: '\uD83C\uDF5A' },
  { value: 'dessert', label: 'Dessert', emoji: '\uD83C\uDF70' },
  { value: 'beverage', label: 'Beverage', emoji: '\uD83E\uDDC3' },
]

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
export default function MenuPlan() {
  const user = useUser()
  const { campId } = useSelectedCamp()

  // Date + meal selection
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [meal, setMeal] = useState('lunch')

  // Plan data
  const [plan, setPlan] = useState(null)
  const [dishes, setDishes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Add dish form
  const [showAddDish, setShowAddDish] = useState(false)
  const [newDishCourse, setNewDishCourse] = useState('main_course')
  const [newDishName, setNewDishName] = useState('')
  const [newDishPortions, setNewDishPortions] = useState(20)

  // AI suggestions sheet
  const [suggestingDish, setSuggestingDish] = useState(null)

  // Manual ingredient search sheet
  const [addIngDish, setAddIngDish] = useState(null)

  // Audit log sheet
  const [showAudit, setShowAudit] = useState(false)

  // ── Load plan ──
  useEffect(() => {
    loadPlan()
  }, [date, meal, campId])

  async function loadPlan() {
    setLoading(true)
    setError('')
    try {
      const data = await menuApi.plan(date, meal)
      setPlan(data.plan)
      setDishes(data.dishes || [])
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

  // ── Create plan ──
  async function handleCreatePlan() {
    setSaving(true)
    try {
      await menuApi.createPlan(date, meal, 20)
      await loadPlan()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Add dish ──
  async function handleAddDish() {
    if (!newDishName.trim()) return
    setSaving(true)
    try {
      await menuApi.addDish(plan.id, newDishCourse, newDishName.trim(), newDishPortions)
      setNewDishName('')
      setNewDishPortions(20)
      setShowAddDish(false)
      await loadPlan()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Remove dish ──
  async function handleRemoveDish(dishId) {
    if (!confirm('Remove this dish and all its ingredients?')) return
    setSaving(true)
    try {
      await menuApi.removeDish(dishId)
      await loadPlan()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Remove ingredient ──
  async function handleRemoveIngredient(ingId) {
    setSaving(true)
    try {
      await menuApi.removeIngredient(ingId, '')
      await loadPlan()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Update ingredient qty ──
  async function handleUpdateQty(ingId, qty) {
    try {
      await menuApi.updateQty(ingId, qty)
      // Optimistic — update local state
      setDishes(prev => prev.map(d => ({
        ...d,
        ingredients: d.ingredients.map(ing =>
          ing.id === ingId ? { ...ing, final_qty: qty } : ing
        ),
      })))
    } catch (err) {
      setError(err.message)
    }
  }

  // ── Update dish portions ──
  async function handleUpdateDishPortions(dishId, newPortions) {
    if (newPortions < 1) return
    setSaving(true)
    try {
      await menuApi.updatePortions(dishId, newPortions)
      await loadPlan()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Confirm / Reopen plan ──
  async function handleConfirmPlan() {
    if (!confirm('Confirm this menu plan? No further edits until reopened.')) return
    setSaving(true)
    try {
      await menuApi.confirmPlan(plan.id)
      await loadPlan()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleReopenPlan() {
    setSaving(true)
    try {
      await menuApi.reopenPlan(plan.id)
      await loadPlan()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── After AI suggestions accepted ──
  async function onSuggestionsAccepted() {
    setSuggestingDish(null)
    await loadPlan()
  }

  // ── After manual ingredient added ──
  async function onIngredientAdded() {
    setAddIngDish(null)
    await loadPlan()
  }

  // Group dishes by course
  const dishesByCourse = {}
  for (const d of dishes) {
    if (!dishesByCourse[d.course]) dishesByCourse[d.course] = []
    dishesByCourse[d.course].push(d)
  }

  const isConfirmed = plan?.status === 'confirmed'
  const isDraft = plan?.status === 'draft'

  return (
    <div className="pb-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ChefHat size={22} className="text-orange-600" />
            Menu Plan
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Plan daily meals with AI ingredient suggestions</p>
        </div>
        {plan && (
          <button
            onClick={() => setShowAudit(true)}
            className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full"
          >
            <History size={14} />
            Audit Log
          </button>
        )}
      </div>

      {/* ── Date Picker ── */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-4">
        <button onClick={() => changeDate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{formatDate(date)}</p>
          {isToday(date) && <span className="text-[10px] text-green-600 font-medium">Today</span>}
          {!isToday(date) && (
            <button onClick={() => setDate(new Date().toISOString().split('T')[0])} className="text-[10px] text-orange-600 font-medium">
              Go to Today
            </button>
          )}
        </div>
        <button onClick={() => changeDate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200">
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* ── Meal Toggle ── */}
      <div className="flex gap-2 mb-4">
        {MEALS.map(m => (
          <button
            key={m.value}
            onClick={() => setMeal(m.value)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              meal === m.value
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError('')} className="ml-auto"><X size={16} className="text-red-400" /></button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && <LoadingSpinner message="Loading menu plan..." />}

      {/* ── No Plan Yet — Create ── */}
      {!loading && !plan && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
          <ChefHat size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No menu plan for</p>
          <p className="font-semibold text-gray-800 mb-4">{formatDate(date)} — {meal === 'lunch' ? 'Lunch' : 'Dinner'}</p>

          <button
            onClick={handleCreatePlan}
            disabled={saving}
            className="bg-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin inline mr-1" /> : <Plus size={16} className="inline mr-1" />}
            Create Menu Plan
          </button>
        </div>
      )}

      {/* ── Plan Exists ── */}
      {!loading && plan && (
        <div>
          {/* Status bar */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 mb-4 flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              isConfirmed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {plan.status}
            </span>
            <div className="flex items-center gap-2">
              {isDraft && (
                <button
                  onClick={handleConfirmPlan}
                  disabled={saving || dishes.length === 0}
                  className="text-xs text-green-700 font-semibold bg-green-50 px-2.5 py-1 rounded-lg flex items-center gap-1 disabled:opacity-40"
                >
                  <CheckCircle size={13} /> Confirm
                </button>
              )}
              {isConfirmed && (
                <button
                  onClick={handleReopenPlan}
                  disabled={saving}
                  className="text-xs text-amber-700 font-medium bg-amber-50 px-2.5 py-1 rounded-lg flex items-center gap-1"
                >
                  <RotateCcw size={13} /> Reopen
                </button>
              )}
            </div>
          </div>

          {/* ── Dishes by Course ── */}
          {COURSES.map(course => {
            const courseDishes = dishesByCourse[course.value] || []
            if (courseDishes.length === 0 && isConfirmed) return null
            return (
              <div key={course.value} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <span>{course.emoji}</span>
                    {course.label}
                    {courseDishes.length > 0 && (
                      <span className="text-[10px] text-gray-400 font-normal">({courseDishes.length})</span>
                    )}
                  </h3>
                </div>

                {courseDishes.map(dish => (
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    isConfirmed={isConfirmed}
                    onRemoveDish={() => handleRemoveDish(dish.id)}
                    onSuggest={() => setSuggestingDish(dish)}
                    onAddManual={() => setAddIngDish(dish)}
                    onRemoveIngredient={handleRemoveIngredient}
                    onUpdateQty={handleUpdateQty}
                    onUpdatePortions={(p) => handleUpdateDishPortions(dish.id, p)}
                    saving={saving}
                  />
                ))}

                {/* Add dish to this course */}
                {isDraft && courseDishes.length === 0 && (
                  <button
                    onClick={() => { setNewDishCourse(course.value); setShowAddDish(true) }}
                    className="w-full border border-dashed border-gray-300 rounded-xl py-3 text-xs text-gray-400 flex items-center justify-center gap-1.5 active:bg-gray-50"
                  >
                    <Plus size={14} /> Add {course.label}
                  </button>
                )}
              </div>
            )
          })}

          {/* ── Floating Add Dish Button ── */}
          {isDraft && (
            <button
              onClick={() => setShowAddDish(true)}
              className="fixed bottom-24 right-4 lg:bottom-8 bg-orange-500 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:bg-orange-600 z-30"
            >
              <Plus size={24} />
            </button>
          )}
        </div>
      )}

      {/* ── Add Dish Modal ── */}
      {showAddDish && (
        <AddDishSheet
          course={newDishCourse}
          dishName={newDishName}
          portions={newDishPortions}
          onCourseChange={setNewDishCourse}
          onDishNameChange={setNewDishName}
          onPortionsChange={setNewDishPortions}
          onAdd={handleAddDish}
          onClose={() => { setShowAddDish(false); setNewDishName(''); setNewDishPortions(20) }}
          saving={saving}
        />
      )}

      {/* ── AI Suggestions Sheet ── */}
      {suggestingDish && plan && (
        <AISuggestSheet
          dish={suggestingDish}
          portions={suggestingDish.portions || 20}
          onAccepted={onSuggestionsAccepted}
          onClose={() => setSuggestingDish(null)}
        />
      )}

      {/* ── Manual Ingredient Sheet ── */}
      {addIngDish && (
        <AddIngredientSheet
          dish={addIngDish}
          onAdded={onIngredientAdded}
          onClose={() => setAddIngDish(null)}
        />
      )}

      {/* ── Audit Log Sheet ── */}
      {showAudit && plan && (
        <AuditSheet
          planId={plan.id}
          onClose={() => setShowAudit(false)}
        />
      )}
    </div>
  )
}


// ════════════════════════════════════════════════════════════
// DISH CARD — shows a dish with its ingredients
// ════════════════════════════════════════════════════════════
function DishCard({ dish, isConfirmed, onRemoveDish, onSuggest, onAddManual, onRemoveIngredient, onUpdateQty, onUpdatePortions, saving }) {
  const activeIngredients = dish.ingredients.filter(i => !i.is_removed)
  const removedIngredients = dish.ingredients.filter(i => i.is_removed)
  const [showRemoved, setShowRemoved] = useState(false)
  const dishPortions = dish.portions || 20

  return (
    <div className="bg-white rounded-xl border border-gray-100 mb-2 overflow-hidden">
      {/* Dish header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <UtensilsCrossed size={16} className="text-orange-500 shrink-0" />
          <span className="font-semibold text-sm text-gray-900 truncate">{dish.dish_name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Per-dish portions badge */}
          <button
            onClick={() => {
              if (isConfirmed) return
              const n = prompt('Portions for this dish:', dishPortions)
              if (n && parseInt(n) > 0 && parseInt(n) !== dishPortions) onUpdatePortions(parseInt(n))
            }}
            className={`text-[10px] font-medium px-2 py-1 rounded-lg flex items-center gap-1 ${
              isConfirmed ? 'text-gray-500 bg-gray-50' : 'text-orange-700 bg-orange-50 active:bg-orange-100'
            }`}
          >
            <UsersIcon size={11} /> {dishPortions}
          </button>
          {!isConfirmed && (
            <>
              <button
                onClick={onSuggest}
                className="text-[10px] font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-lg flex items-center gap-1"
              >
                <Sparkles size={12} /> AI
              </button>
              <button
                onClick={onAddManual}
                className="text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-lg flex items-center gap-1"
              >
                <Plus size={12} />
              </button>
              <button
                onClick={onRemoveDish}
                disabled={saving}
                className="text-[10px] text-red-500 p-1 rounded-lg hover:bg-red-50"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Ingredients list */}
      {activeIngredients.length === 0 && (
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-gray-400">No ingredients yet</p>
          {!isConfirmed && (
            <button
              onClick={onSuggest}
              className="text-xs text-purple-600 font-medium mt-1 flex items-center gap-1 mx-auto"
            >
              <Sparkles size={12} /> Get AI suggestions
            </button>
          )}
        </div>
      )}

      {activeIngredients.map(ing => (
        <IngredientRow
          key={ing.id}
          ing={ing}
          isConfirmed={isConfirmed}
          onRemove={() => onRemoveIngredient(ing.id)}
          onUpdateQty={(qty) => onUpdateQty(ing.id, qty)}
        />
      ))}

      {/* Removed ingredients toggle */}
      {removedIngredients.length > 0 && (
        <div className="border-t border-gray-50">
          <button
            onClick={() => setShowRemoved(!showRemoved)}
            className="w-full px-4 py-2 text-[10px] text-gray-400 text-left"
          >
            {showRemoved ? 'Hide' : 'Show'} {removedIngredients.length} removed ingredient{removedIngredients.length > 1 ? 's' : ''}
          </button>
          {showRemoved && removedIngredients.map(ing => (
            <div key={ing.id} className="px-4 py-2 flex items-center gap-2 opacity-40">
              <span className="text-xs line-through text-gray-500">{ing.item_name}</span>
              <span className="text-[10px] text-gray-400">({ing.removed_reason || 'removed'})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ════════════════════════════════════════════════════════════
// INGREDIENT ROW — single ingredient line with qty edit
// ════════════════════════════════════════════════════════════
function IngredientRow({ ing, isConfirmed, onRemove, onUpdateQty }) {
  const [editing, setEditing] = useState(false)
  const [qty, setQty] = useState(ing.final_qty)
  const inputRef = useRef(null)

  useEffect(() => { setQty(ing.final_qty) }, [ing.final_qty])

  function saveQty() {
    setEditing(false)
    if (qty !== ing.final_qty && qty > 0) {
      onUpdateQty(qty)
    }
  }

  const sourceColor = ing.source === 'ai_suggested' ? 'text-purple-500' : ing.source === 'manual' ? 'text-blue-500' : 'text-amber-500'
  const sourceLabel = ing.source === 'ai_suggested' ? 'AI' : ing.source === 'manual' ? 'Manual' : 'Modified'

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 last:border-0">
      {/* Source badge */}
      <span className={`text-[8px] font-bold uppercase ${sourceColor} w-8 shrink-0`}>{sourceLabel}</span>

      {/* Item name + stock info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-800 truncate">{ing.item_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {ing.ai_reason && (
            <span className="text-[10px] text-gray-400 truncate max-w-[160px]">{ing.ai_reason}</span>
          )}
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
            <Package size={9} /> {ing.stock_qty} {ing.uom}
          </span>
        </div>
      </div>

      {/* Quantity */}
      <div className="flex items-center gap-1 shrink-0">
        {editing && !isConfirmed ? (
          <input
            ref={inputRef}
            type="number"
            value={qty}
            onChange={e => setQty(parseFloat(e.target.value) || 0)}
            onBlur={saveQty}
            onKeyDown={e => e.key === 'Enter' && saveQty()}
            className="w-16 text-xs text-right border border-orange-300 rounded px-1 py-0.5"
            autoFocus
          />
        ) : (
          <button
            onClick={() => !isConfirmed && setEditing(true)}
            className={`text-xs font-semibold text-gray-800 bg-gray-50 px-2 py-0.5 rounded ${!isConfirmed ? 'active:bg-gray-100' : ''}`}
          >
            {ing.final_qty}
          </button>
        )}
        <span className="text-[10px] text-gray-400 w-6">{ing.uom}</span>

        {/* Suggested vs final diff */}
        {ing.suggested_qty !== null && ing.suggested_qty !== ing.final_qty && (
          <span className="text-[9px] text-gray-400 line-through">{ing.suggested_qty}</span>
        )}
      </div>

      {/* Remove button */}
      {!isConfirmed && (
        <button onClick={onRemove} className="text-red-400 p-0.5 shrink-0">
          <X size={14} />
        </button>
      )}
    </div>
  )
}


// ════════════════════════════════════════════════════════════
// ADD DISH BOTTOM SHEET
// ════════════════════════════════════════════════════════════
function AddDishSheet({ course, dishName, portions, onCourseChange, onDishNameChange, onPortionsChange, onAdd, onClose, saving }) {
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    lockScroll()
    setTimeout(() => inputRef.current?.focus(), 300)
    return () => {
      unlockScroll()
      if (closingRef.current) clearTimeout(closingRef.current)
    }
  }, [])

  function handleClose() {
    setClosing(true)
    closingRef.current = setTimeout(onClose, 280)
  }

  return createPortal(
    <div className="fixed inset-0 z-[10010]">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[75dvh] flex flex-col ${closing ? 'animate-slide-down' : 'animate-slide-up'}`}>
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Plus size={16} className="text-orange-500" />
            Add Dish
          </h3>
          <button onClick={handleClose} className="p-1"><X size={18} className="text-gray-400" /></button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          {/* Course picker */}
          <label className="text-xs font-medium text-gray-600 mb-2 block">Course</label>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {COURSES.map(c => (
              <button
                key={c.value}
                onClick={() => onCourseChange(c.value)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  course === c.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          {/* Dish name */}
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Dish Name</label>
          <input
            ref={inputRef}
            type="text"
            value={dishName}
            onChange={e => onDishNameChange(e.target.value)}
            placeholder="e.g. Grilled Chicken with Herbs"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 mb-4"
          />

          {/* Portions */}
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Portions</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPortionsChange(Math.max(1, portions - 5))}
              className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center active:bg-gray-200"
            >
              <Minus size={14} />
            </button>
            <input
              type="number"
              value={portions}
              onChange={e => onPortionsChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1.5"
            />
            <button
              onClick={() => onPortionsChange(portions + 5)}
              className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center active:bg-gray-200"
            >
              <Plus size={14} />
            </button>
            <span className="text-xs text-gray-400 ml-1">guests</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100">
          <button
            onClick={onAdd}
            disabled={!dishName.trim() || saving}
            className="w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
          >
            {saving ? <Loader2 size={16} className="animate-spin inline mr-1" /> : null}
            Add Dish
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}


// ════════════════════════════════════════════════════════════
// AI SUGGESTIONS BOTTOM SHEET
// ════════════════════════════════════════════════════════════
function AISuggestSheet({ dish, portions, onAccepted, onClose }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(null)

  // Track which suggestions are selected
  const [selected, setSelected] = useState(new Set())

  useEffect(() => {
    lockScroll()
    loadSuggestions()
    return () => {
      unlockScroll()
      if (closingRef.current) clearTimeout(closingRef.current)
    }
  }, [])

  async function loadSuggestions() {
    setLoading(true)
    setError('')
    try {
      const data = await menuApi.suggestIngredients(dish.dish_name, portions, dish.course)
      setSuggestions(data.suggestions || [])
      // Select all by default
      setSelected(new Set((data.suggestions || []).map((_, i) => i)))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleSelection(idx) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  async function acceptSelected() {
    const toAccept = suggestions
      .filter((_, i) => selected.has(i))
      .map(s => ({
        item_id: s.item_id,
        suggested_qty: s.suggested_qty,
        final_qty: s.suggested_qty,
        uom: s.uom,
        reason: s.reason,
      }))

    if (toAccept.length === 0) return

    setAccepting(true)
    try {
      await menuApi.acceptSuggestions(dish.id, toAccept, portions)
      onAccepted()
    } catch (err) {
      setError(err.message)
    } finally {
      setAccepting(false)
    }
  }

  function handleClose() {
    setClosing(true)
    closingRef.current = setTimeout(onClose, 280)
  }

  return createPortal(
    <div className="fixed inset-0 z-[10010]">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[90dvh] flex flex-col ${closing ? 'animate-slide-down' : 'animate-slide-up'}`}>
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Sparkles size={16} className="text-purple-500" />
              AI Ingredient Suggestions
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">{dish.dish_name} — {portions} portions</p>
          </div>
          <button onClick={handleClose} className="p-1"><X size={18} className="text-gray-400" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 overscroll-contain">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-purple-500 mb-3" />
              <p className="text-sm text-gray-500">Gemini is analyzing your dish...</p>
              <p className="text-[10px] text-gray-400 mt-1">Matching ingredients from your stock</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3">
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={loadSuggestions} className="text-xs text-red-600 font-medium mt-1">Try again</button>
            </div>
          )}

          {!loading && suggestions.length === 0 && !error && (
            <div className="text-center py-8">
              <AlertTriangle size={24} className="text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No suggestions found. Try adding ingredients manually.</p>
            </div>
          )}

          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => toggleSelection(idx)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5 text-left transition-all ${
                selected.has(idx) ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50 border border-transparent'
              }`}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                selected.has(idx) ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
              }`}>
                {selected.has(idx) && <Check size={12} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800">{s.item_name}</p>
                <p className="text-[10px] text-gray-400 truncate">{s.reason}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold text-gray-800">{s.suggested_qty} {s.uom}</p>
                <p className="text-[10px] text-gray-400 flex items-center gap-0.5 justify-end">
                  <Package size={9} /> {s.stock_qty} in stock
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        {!loading && suggestions.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
            <button
              onClick={() => {
                if (selected.size === suggestions.length) setSelected(new Set())
                else setSelected(new Set(suggestions.map((_, i) => i)))
              }}
              className="text-xs text-gray-600 font-medium bg-gray-100 px-3 py-2 rounded-xl"
            >
              {selected.size === suggestions.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={acceptSelected}
              disabled={selected.size === 0 || accepting}
              className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {accepting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Accept {selected.size} ingredient{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}


// ════════════════════════════════════════════════════════════
// ADD INGREDIENT MANUALLY — SEARCH SHEET
// ════════════════════════════════════════════════════════════
function AddIngredientSheet({ dish, onAdded, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(null)
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(null)
  const searchRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    lockScroll()
    setTimeout(() => inputRef.current?.focus(), 300)
    return () => {
      unlockScroll()
      if (closingRef.current) clearTimeout(closingRef.current)
      if (searchRef.current) clearTimeout(searchRef.current)
    }
  }, [])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await menuApi.searchItems(query)
        setResults(data.items || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
  }, [query])

  async function addItem(item) {
    const qtyStr = prompt(`Qty for ${item.name} (${item.uom}):`, '1')
    if (!qtyStr) return
    const qty = parseFloat(qtyStr)
    if (qty <= 0 || isNaN(qty)) return

    setAdding(item.id)
    try {
      await menuApi.addIngredient(dish.id, item.id, qty, item.uom)
      onAdded()
    } catch (err) {
      alert(err.message)
    } finally {
      setAdding(null)
    }
  }

  function handleClose() {
    setClosing(true)
    closingRef.current = setTimeout(onClose, 280)
  }

  return createPortal(
    <div className="fixed inset-0 z-[10010]">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80dvh] flex flex-col ${closing ? 'animate-slide-down' : 'animate-slide-up'}`}>
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Search size={16} className="text-blue-500" />
            Add Ingredient — {dish.dish_name}
          </h3>
          <button onClick={handleClose} className="p-1"><X size={18} className="text-gray-400" /></button>
        </div>

        {/* Search */}
        <div className="px-5 py-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search ingredients..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={14} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 overscroll-contain">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-blue-500" />
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-4">No items found</p>
          )}

          {results.map(item => (
            <button
              key={item.id}
              onClick={() => addItem(item)}
              disabled={adding === item.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left hover:bg-blue-50 active:bg-blue-50 disabled:opacity-50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800">{item.name}</p>
                <p className="text-[10px] text-gray-400">{item.item_code} — {item.group_name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <Package size={9} /> {item.stock_qty} {item.uom}
                </p>
              </div>
              {adding === item.id ? (
                <Loader2 size={14} className="animate-spin text-blue-500 shrink-0" />
              ) : (
                <Plus size={14} className="text-blue-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}


// ════════════════════════════════════════════════════════════
// AUDIT LOG SHEET
// ════════════════════════════════════════════════════════════
function AuditSheet({ planId, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(null)

  useEffect(() => {
    lockScroll()
    loadAudit()
    return () => {
      unlockScroll()
      if (closingRef.current) clearTimeout(closingRef.current)
    }
  }, [])

  async function loadAudit() {
    setLoading(true)
    try {
      const data = await menuApi.audit(planId)
      setLogs(data.audit || [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setClosing(true)
    closingRef.current = setTimeout(onClose, 280)
  }

  function formatAction(action) {
    const map = {
      create_plan: 'Created plan',
      update_portions: 'Updated portions',
      change_meal: 'Changed meal',
      add_dish: 'Added dish',
      remove_dish: 'Removed dish',
      ai_suggest: 'AI suggested',
      add_ingredient: 'Added ingredient',
      remove_ingredient: 'Removed ingredient',
      modify_qty: 'Modified quantity',
      confirm_plan: 'Confirmed plan',
      reopen_plan: 'Reopened plan',
    }
    return map[action] || action
  }

  function formatTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  function actionColor(action) {
    if (action.includes('ai')) return 'text-purple-600 bg-purple-50'
    if (action.includes('add')) return 'text-green-600 bg-green-50'
    if (action.includes('remove')) return 'text-red-600 bg-red-50'
    if (action.includes('confirm')) return 'text-green-700 bg-green-50'
    if (action.includes('reopen')) return 'text-amber-700 bg-amber-50'
    if (action.includes('modify') || action.includes('update')) return 'text-blue-600 bg-blue-50'
    return 'text-gray-600 bg-gray-50'
  }

  return createPortal(
    <div className="fixed inset-0 z-[10010]">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85dvh] flex flex-col ${closing ? 'animate-slide-down' : 'animate-slide-up'}`}>
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList size={16} className="text-gray-600" />
            Audit Log
          </h3>
          <button onClick={handleClose} className="p-1"><X size={18} className="text-gray-400" /></button>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto px-5 py-3 overscroll-contain">
          {loading && <LoadingSpinner message="Loading audit trail..." />}

          {!loading && logs.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-8">No audit entries</p>
          )}

          {logs.map((log, idx) => (
            <div key={log.id} className="flex gap-3 mb-3">
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  log.action.includes('confirm') ? 'bg-green-500' :
                  log.action.includes('remove') ? 'bg-red-400' :
                  log.action.includes('ai') ? 'bg-purple-500' :
                  'bg-gray-400'
                }`} />
                {idx < logs.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${actionColor(log.action)}`}>
                    {formatAction(log.action)}
                  </span>
                  <span className="text-[10px] text-gray-400">{formatTime(log.created_at)}</span>
                </div>
                <p className="text-[11px] text-gray-600">{log.user_name}</p>
                {log.dish_name && (
                  <p className="text-[10px] text-gray-400">{log.dish_name}</p>
                )}
                {log.new_value && (
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {log.new_value.qty !== undefined && <span>Qty: {log.old_value?.qty ?? '—'} → {log.new_value.qty}</span>}
                    {log.new_value.portions !== undefined && <span>Portions: {log.old_value?.portions ?? '—'} → {log.new_value.portions}</span>}
                    {log.new_value.dish_name && <span>Dish: {log.new_value.dish_name}</span>}
                    {log.new_value.status && <span>Status: {log.old_value?.status ?? '—'} → {log.new_value.status}</span>}
                    {log.new_value.reason && <span>Reason: {log.new_value.reason}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
