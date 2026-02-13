import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useUser, useSelectedCamp } from '../context/AppContext'
import { kitchenMenu as menuApi, kitchen as kitchenApi } from '../services/api'
import { lockScroll, unlockScroll } from '../utils/scrollLock'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  ChefHat, ChevronLeft, ChevronRight, Calendar, Plus, Trash2,
  Loader2, Search, X, Check, AlertTriangle,
  UtensilsCrossed, Minus, ClipboardList, Users as UsersIcon,
  Clock, History, CheckCircle, RotateCcw, Package,
  BookOpen, Star, Camera, Image as ImageIcon
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
  const [newDishRecipeId, setNewDishRecipeId] = useState(null)

  // Recipe picker sheet (for loading recipe into existing dish)
  const [recipePickerDish, setRecipePickerDish] = useState(null)

  // Manual ingredient search sheet
  const [addIngDish, setAddIngDish] = useState(null)

  // Presentation rating sheet
  const [ratingDish, setRatingDish] = useState(null)

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

  // ── Add dish (with optional recipe) ──
  async function handleAddDish() {
    if (!newDishName.trim()) return
    setSaving(true)
    try {
      const data = await menuApi.addDish(plan.id, newDishCourse, newDishName.trim(), newDishPortions, newDishRecipeId)
      const dishId = data.dish_id

      // If recipe selected, auto-load its ingredients
      if (newDishRecipeId && dishId) {
        try {
          await menuApi.loadRecipe(dishId, newDishRecipeId, newDishPortions)
        } catch (err) {
          console.error('Failed to auto-load recipe ingredients:', err)
        }
      }

      setNewDishName('')
      setNewDishPortions(20)
      setNewDishRecipeId(null)
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

  // ── After recipe loaded into dish ──
  async function onRecipeLoaded() {
    setRecipePickerDish(null)
    await loadPlan()
  }

  // ── After manual ingredient added ──
  async function onIngredientAdded() {
    setAddIngDish(null)
    await loadPlan()
  }

  // ── After presentation rated ──
  async function onPresentationRated() {
    setRatingDish(null)
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
          <p className="text-xs text-gray-500 mt-0.5">Plan daily meals with recipe-based ingredients</p>
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
                    onLoadRecipe={() => setRecipePickerDish(dish)}
                    onAddManual={() => setAddIngDish(dish)}
                    onRatePresentation={() => setRatingDish(dish)}
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
          recipeId={newDishRecipeId}
          onCourseChange={setNewDishCourse}
          onDishNameChange={setNewDishName}
          onPortionsChange={setNewDishPortions}
          onRecipeSelect={(recipe) => {
            setNewDishRecipeId(recipe?.id || null)
            if (recipe) setNewDishName(recipe.name)
          }}
          onAdd={handleAddDish}
          onClose={() => { setShowAddDish(false); setNewDishName(''); setNewDishPortions(20); setNewDishRecipeId(null) }}
          saving={saving}
        />
      )}

      {/* ── Recipe Picker Sheet (load into existing dish) ── */}
      {recipePickerDish && (
        <RecipePickerSheet
          dish={recipePickerDish}
          onLoaded={onRecipeLoaded}
          onClose={() => setRecipePickerDish(null)}
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

      {/* ── Presentation Rating Sheet ── */}
      {ratingDish && (
        <PresentationRatingSheet
          dish={ratingDish}
          onRated={onPresentationRated}
          onClose={() => setRatingDish(null)}
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
function DishCard({ dish, isConfirmed, onRemoveDish, onLoadRecipe, onAddManual, onRatePresentation, onRemoveIngredient, onUpdateQty, onUpdatePortions, saving }) {
  const activeIngredients = dish.ingredients.filter(i => !i.is_removed)
  const removedIngredients = dish.ingredients.filter(i => i.is_removed)
  const [showRemoved, setShowRemoved] = useState(false)
  const dishPortions = dish.portions || 20
  const hasRecipe = !!dish.recipe_id
  const hasScore = dish.presentation_score > 0

  return (
    <div className="bg-white rounded-xl border border-gray-100 mb-2 overflow-hidden">
      {/* Dish header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <UtensilsCrossed size={16} className="text-orange-500 shrink-0" />
          <span className="font-semibold text-sm text-gray-900 truncate">{dish.dish_name}</span>
          {hasRecipe && (
            <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
              <BookOpen size={8} /> Recipe
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Presentation score */}
          {hasScore && (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-lg flex items-center gap-0.5">
              <Star size={10} className="fill-amber-500 text-amber-500" /> {dish.presentation_score}/5
            </span>
          )}
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
                onClick={onLoadRecipe}
                className="text-[10px] font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-lg flex items-center gap-1"
                title="Load from Recipe"
              >
                <BookOpen size={12} />
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
          {/* Rate presentation (on confirmed dishes or any dish with ingredients) */}
          {activeIngredients.length > 0 && (
            <button
              onClick={onRatePresentation}
              className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-lg flex items-center gap-1"
              title="Rate Presentation"
            >
              <Camera size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Presentation feedback */}
      {dish.presentation_feedback && (
        <div className="px-4 py-2 bg-amber-50/50 border-b border-amber-100">
          <p className="text-[10px] text-amber-800">{dish.presentation_feedback}</p>
        </div>
      )}

      {/* Ingredients list */}
      {activeIngredients.length === 0 && (
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-gray-400">No ingredients yet</p>
          {!isConfirmed && (
            <button
              onClick={onLoadRecipe}
              className="text-xs text-orange-600 font-medium mt-1 flex items-center gap-1 mx-auto"
            >
              <BookOpen size={12} /> Load from Recipe
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

  const sourceColor =
    ing.source === 'recipe' ? 'text-orange-500' :
    ing.source === 'ai_suggested' ? 'text-purple-500' :
    ing.source === 'manual' ? 'text-blue-500' :
    'text-amber-500'
  const sourceLabel =
    ing.source === 'recipe' ? 'Recipe' :
    ing.source === 'ai_suggested' ? 'AI' :
    ing.source === 'manual' ? 'Manual' :
    'Modified'

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 last:border-0">
      {/* Source badge */}
      <span className={`text-[8px] font-bold uppercase ${sourceColor} w-10 shrink-0`}>{sourceLabel}</span>

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
// ADD DISH BOTTOM SHEET — with recipe search
// ════════════════════════════════════════════════════════════
function AddDishSheet({ course, dishName, portions, recipeId, onCourseChange, onDishNameChange, onPortionsChange, onRecipeSelect, onAdd, onClose, saving }) {
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(null)
  const inputRef = useRef(null)

  // Recipe search
  const [recipeQuery, setRecipeQuery] = useState('')
  const [recipeResults, setRecipeResults] = useState([])
  const [recipeSearching, setRecipeSearching] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const searchTimerRef = useRef(null)

  useEffect(() => {
    lockScroll()
    setTimeout(() => inputRef.current?.focus(), 300)
    return () => {
      unlockScroll()
      if (closingRef.current) clearTimeout(closingRef.current)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // Search recipes as user types dish name
  useEffect(() => {
    if (recipeQuery.length < 2) {
      setRecipeResults([])
      return
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      setRecipeSearching(true)
      try {
        const data = await kitchenApi.searchRecipes(recipeQuery)
        setRecipeResults(data.recipes || [])
      } catch {
        setRecipeResults([])
      } finally {
        setRecipeSearching(false)
      }
    }, 300)
  }, [recipeQuery])

  function selectRecipe(recipe) {
    setSelectedRecipe(recipe)
    onRecipeSelect(recipe)
    setRecipeQuery('')
    setRecipeResults([])
  }

  function clearRecipe() {
    setSelectedRecipe(null)
    onRecipeSelect(null)
    onDishNameChange('')
  }

  function handleClose() {
    setClosing(true)
    closingRef.current = setTimeout(onClose, 280)
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
            <Plus size={16} className="text-orange-500" />
            Add Dish
          </h3>
          <button onClick={handleClose} className="p-1"><X size={18} className="text-gray-400" /></button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 overflow-y-auto flex-1 scroll-touch">
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

          {/* Recipe search */}
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Search Recipe (optional)</label>
          {selectedRecipe ? (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 mb-4 flex items-center gap-2">
              <BookOpen size={14} className="text-orange-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{selectedRecipe.name}</p>
                <p className="text-[10px] text-orange-600">
                  {selectedRecipe.category && <span className="capitalize">{selectedRecipe.category.replace('_', ' ')}</span>}
                  {selectedRecipe.serves && <span> · {selectedRecipe.serves} servings</span>}
                </p>
              </div>
              <button onClick={clearRecipe} className="text-orange-400 hover:text-red-500 p-1">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={recipeQuery}
                onChange={e => setRecipeQuery(e.target.value)}
                placeholder="Search recipes by name..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
              />
              {recipeSearching && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-orange-500" />
              )}

              {/* Search results dropdown */}
              {recipeResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                  {recipeResults.map(r => (
                    <button
                      key={r.id}
                      onClick={() => selectRecipe(r)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-orange-50 border-b border-gray-100 last:border-0"
                    >
                      <BookOpen size={12} className="text-orange-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {r.category && <span className="capitalize">{r.category.replace('_', ' ')}</span>}
                          {r.serves && <span> · {r.serves} servings</span>}
                          {r.ingredient_count > 0 && <span> · {r.ingredient_count} ingredients</span>}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dish name (auto-filled from recipe or manual) */}
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

          {/* Info about recipe ingredients */}
          {selectedRecipe && (
            <p className="text-[10px] text-orange-600 mt-3 flex items-center gap-1">
              <BookOpen size={10} /> Recipe ingredients will be auto-loaded (pantry staples excluded)
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100">
          <button
            onClick={onAdd}
            disabled={!dishName.trim() || saving}
            className="w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
          >
            {saving ? <Loader2 size={16} className="animate-spin inline mr-1" /> : null}
            Add Dish{selectedRecipe ? ' with Recipe' : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}


// ════════════════════════════════════════════════════════════
// RECIPE PICKER SHEET — load recipe into existing dish
// ════════════════════════════════════════════════════════════
function RecipePickerSheet({ dish, onLoaded, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(null)
  const searchRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    lockScroll()
    // Auto-search with dish name
    setQuery(dish.dish_name)
    setTimeout(() => inputRef.current?.focus(), 300)
    return () => {
      unlockScroll()
      if (closingRef.current) clearTimeout(closingRef.current)
      if (searchRef.current) clearTimeout(searchRef.current)
    }
  }, [])

  // Search recipes
  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await kitchenApi.searchRecipes(query)
        setResults(data.recipes || [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [query])

  // Preview recipe ingredients
  async function previewRecipe(recipe) {
    setPreview(null)
    setPreviewLoading(true)
    try {
      const data = await menuApi.recipeIngredients(recipe.id, dish.portions || 20)
      setPreview({ recipe, ingredients: data.ingredients || [], scaled_portions: data.scaled_portions })
    } catch (err) {
      alert(err.message)
    } finally {
      setPreviewLoading(false)
    }
  }

  // Load recipe into dish
  async function loadRecipe() {
    if (!preview) return
    setLoading(true)
    try {
      await menuApi.loadRecipe(dish.id, preview.recipe.id, dish.portions || 20)
      onLoaded()
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
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
              <BookOpen size={16} className="text-orange-500" />
              Load Recipe
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">{dish.dish_name} — {dish.portions || 20} portions</p>
          </div>
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
              onChange={e => { setQuery(e.target.value); setPreview(null) }}
              placeholder="Search recipes..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
            />
            {query && (
              <button onClick={() => { setQuery(''); setPreview(null) }} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={14} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 overscroll-contain scroll-touch">
          {/* Preview mode */}
          {preview && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setPreview(null)} className="text-xs text-gray-500 hover:text-gray-700">
                  ← Back to results
                </button>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-3">
                <h4 className="text-sm font-bold text-gray-900">{preview.recipe.name}</h4>
                <p className="text-[10px] text-orange-600 mt-0.5">
                  Scaled to {preview.scaled_portions || dish.portions || 20} portions · {preview.ingredients.length} ingredients
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Pantry staples (salt, pepper, oil) excluded</p>
              </div>

              {/* Ingredients preview */}
              <div className="space-y-1.5">
                {preview.ingredients.map(ing => (
                  <div key={ing.item_id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${ing.is_primary ? 'bg-orange-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-900 flex-1 truncate">{ing.item_name}</span>
                    <span className="text-xs font-medium text-gray-700">{ing.scaled_qty} {ing.uom}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      ing.stock_qty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {ing.stock_qty > 0 ? `${ing.stock_qty}` : 'Out'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search results */}
          {!preview && (
            <>
              {searching && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-orange-500" />
                </div>
              )}

              {!searching && query.length >= 2 && results.length === 0 && (
                <div className="text-center py-8">
                  <BookOpen size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No recipes found</p>
                  <p className="text-xs text-gray-400 mt-1">Create recipes on the Recipes page first</p>
                </div>
              )}

              {previewLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-orange-500" />
                  <span className="ml-2 text-sm text-gray-500">Loading recipe ingredients...</span>
                </div>
              )}

              {!previewLoading && results.map(r => (
                <button
                  key={r.id}
                  onClick={() => previewRecipe(r)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5 text-left hover:bg-orange-50 active:bg-orange-50"
                >
                  <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                    <ChefHat size={18} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{r.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {r.category && <span className="capitalize">{r.category.replace('_', ' ')}</span>}
                      {r.serves && <span> · {r.serves} servings</span>}
                      {r.ingredient_count > 0 && <span> · {r.ingredient_count} ingredients</span>}
                    </p>
                  </div>
                  <BookOpen size={14} className="text-orange-500 shrink-0" />
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer — only when preview is shown */}
        {preview && (
          <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
            <button
              onClick={() => setPreview(null)}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={loadRecipe}
              disabled={loading}
              className="flex-1 bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Use Recipe
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}


// ════════════════════════════════════════════════════════════
// PRESENTATION RATING SHEET — upload photo + AI score
// ════════════════════════════════════════════════════════════
function PresentationRatingSheet({ dish, onRated, onClose }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [rating, setRating] = useState(null) // { score, feedback, tips }
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    lockScroll()
    return () => {
      unlockScroll()
      if (closingRef.current) clearTimeout(closingRef.current)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [])

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setRating(null)
    setError('')
  }

  async function handleRate() {
    if (!file) return
    setUploading(true)
    setError('')

    try {
      // Step 1: Upload photo
      const uploadResult = await menuApi.uploadDishPhoto(file)
      const photoUrl = uploadResult.url

      // Step 2: Send for AI rating
      const rateResult = await menuApi.ratePresentation(dish.id, photoUrl)
      setRating(rateResult.rating || rateResult)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  function handleClose() {
    setClosing(true)
    closingRef.current = setTimeout(() => {
      if (rating) onRated()
      else onClose()
    }, 280)
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
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Star size={16} className="text-amber-500" />
              Rate Presentation
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">{dish.dish_name}</p>
          </div>
          <button onClick={handleClose} className="p-1"><X size={18} className="text-gray-400" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 scroll-touch">
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 mb-3 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          {/* Photo upload */}
          {!rating && (
            <div className="text-center">
              {previewUrl ? (
                <div className="mb-4">
                  <img
                    src={previewUrl}
                    alt="Dish photo"
                    className="w-full max-w-xs mx-auto rounded-xl border border-gray-200 shadow-sm"
                  />
                  <button
                    onClick={() => { setFile(null); setPreviewUrl(null) }}
                    className="text-xs text-gray-500 hover:text-red-500 mt-2"
                  >
                    Change photo
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl p-8 mb-4 cursor-pointer hover:bg-amber-100 transition"
                >
                  <Camera size={40} className="text-amber-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">Tap to upload dish photo</p>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG, or WebP · Max 10MB</p>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              <p className="text-[10px] text-gray-400 mt-2 max-w-xs mx-auto">
                AI will judge plating, color, garnish, cleanliness, and portion on a 1-5 star scale
              </p>
            </div>
          )}

          {/* Uploading */}
          {uploading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 size={28} className="animate-spin text-amber-500 mb-3" />
              <p className="text-sm text-gray-600">Analyzing presentation...</p>
              <p className="text-[10px] text-gray-400 mt-1">Gemini is rating your dish</p>
            </div>
          )}

          {/* Rating result */}
          {rating && (
            <div className="text-center">
              {/* Stars */}
              <div className="flex items-center justify-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s}
                    size={28}
                    className={s <= (rating.score || 0)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-200'
                    }
                  />
                ))}
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{rating.score}/5</p>

              {/* Feedback */}
              {rating.feedback && (
                <p className="text-sm text-gray-600 bg-amber-50 rounded-xl px-4 py-3 mt-3 text-left">
                  {rating.feedback}
                </p>
              )}

              {/* Tips */}
              {rating.tips && rating.tips.length > 0 && (
                <div className="mt-3 text-left">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Improvement Tips</h4>
                  <ul className="space-y-1.5">
                    {rating.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">
                          {i + 1}
                        </span>
                        <span className="text-gray-700">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Photo preview if available */}
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Rated dish"
                  className="w-32 h-32 object-cover rounded-xl mx-auto mt-4 border border-gray-200"
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100">
          {!rating ? (
            <button
              onClick={handleRate}
              disabled={!file || uploading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
              {uploading ? 'Analyzing...' : 'Rate Presentation'}
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="w-full bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Check size={16} /> Done
            </button>
          )}
        </div>
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
        <div className="flex-1 overflow-y-auto px-5 pb-4 overscroll-contain scroll-touch">
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
      load_recipe: 'Loaded recipe',
      rate_presentation: 'Rated presentation',
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
    if (action.includes('recipe') || action.includes('load')) return 'text-orange-600 bg-orange-50'
    if (action.includes('presentation') || action.includes('rate')) return 'text-amber-600 bg-amber-50'
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
        <div className="flex-1 overflow-y-auto px-5 py-3 overscroll-contain scroll-touch">
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
                  log.action.includes('recipe') || log.action.includes('load') ? 'bg-orange-500' :
                  log.action.includes('presentation') || log.action.includes('rate') ? 'bg-amber-500' :
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
                    {log.new_value.score !== undefined && <span>Score: {log.new_value.score}/5</span>}
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
