import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useUser, useSelectedCamp } from '../context/AppContext'
import { kitchenMenu as menuApi, kitchen as kitchenApi } from '../services/api'
import { lockScroll, unlockScroll } from '../utils/scrollLock'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  ChefHat, ChevronLeft, ChevronRight, Plus, Trash2,
  Loader2, X, Check, AlertTriangle,
  UtensilsCrossed, Minus, ClipboardList, Users as UsersIcon,
  History, CheckCircle, RotateCcw,
  BookOpen, Star, Camera, ChevronDown
} from 'lucide-react'

// ── Constants ────────────────────────────────────────
const COURSES = [
  { value: 'appetizer', label: 'Appetizer' },
  { value: 'soup', label: 'Soup' },
  { value: 'salad', label: 'Salad' },
  { value: 'main_course', label: 'Main Course' },
  { value: 'side', label: 'Side' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'beverage', label: 'Beverage' },
]

const MEALS = [
  { value: 'lunch', label: 'Lunch', icon: '\u2600\uFE0F' },
  { value: 'dinner', label: 'Dinner', icon: '\uD83C\uDF19' },
]

// Map recipe categories to courses
const CATEGORY_TO_COURSE = {
  breakfast: 'main_course',
  lunch: 'main_course',
  dinner: 'main_course',
  snack: 'side',
  dessert: 'dessert',
  sauce: 'side',
  soup: 'soup',
  salad: 'salad',
  bread: 'side',
  other: 'main_course',
}

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

  // Date + meal
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [meal, setMeal] = useState('lunch')

  // Plan data
  const [plan, setPlan] = useState(null)
  const [dishes, setDishes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Recipes for dropdown
  const [allRecipes, setAllRecipes] = useState([])
  const [recipesLoaded, setRecipesLoaded] = useState(false)

  // Bottom sheets
  const [ratingDish, setRatingDish] = useState(null)
  const [showAudit, setShowAudit] = useState(false)

  // ── Load recipes on mount ──
  useEffect(() => {
    async function fetchRecipes() {
      try {
        const data = await kitchenApi.recipes()
        setAllRecipes(data.recipes || [])
      } catch {
        // silently fail — dropdown will just be empty
      } finally {
        setRecipesLoaded(true)
      }
    }
    fetchRecipes()
  }, [campId])

  // ── Load plan when date/meal changes ──
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

  // ── Auto-create plan + add dish ──
  async function handleAddDish({ course, name, portions, recipeId }) {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      let planId = plan?.id

      // Auto-create plan if needed
      if (!planId) {
        const createData = await menuApi.createPlan(date, meal, portions)
        planId = createData.plan_id
      }

      // Add the dish
      const data = await menuApi.addDish(planId, course, name.trim(), portions, recipeId)
      const dishId = data.dish_id

      // Auto-load recipe ingredients if recipe was selected
      if (recipeId && dishId) {
        try {
          await menuApi.loadRecipe(dishId, recipeId, portions)
        } catch (err) {
          console.error('Failed to auto-load recipe:', err)
        }
      }

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

  // ── Update dish portions ──
  async function handleUpdatePortions(dishId, newPortions) {
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

  const isConfirmed = plan?.status === 'confirmed'
  const isDraft = !plan || plan?.status === 'draft'

  // Count total ingredients for info badge
  const totalIngredients = dishes.reduce((sum, d) => sum + d.ingredients.filter(i => !i.is_removed).length, 0)

  return (
    <div className="pb-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ChefHat size={22} className="text-orange-600" />
            Menu Plan
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Plan daily meals with recipes</p>
        </div>
        {plan && (
          <button
            onClick={() => setShowAudit(true)}
            className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full"
          >
            <History size={14} />
            Audit
          </button>
        )}
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
      <div className="flex gap-2 mb-3">
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
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError('')}><X size={16} className="text-red-400" /></button>
        </div>
      )}

      {/* ── Status Bar (only when plan exists) ── */}
      {plan && (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-2.5 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              isConfirmed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {plan.status}
            </span>
            <span className="text-[10px] text-gray-400">
              {dishes.length} dish{dishes.length !== 1 ? 'es' : ''}
              {totalIngredients > 0 && ` · ${totalIngredients} ingredients`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {plan.status === 'draft' && (
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
      )}

      {/* ── Loading ── */}
      {loading && <LoadingSpinner message="Loading menu plan..." />}

      {/* ── Dish list ── */}
      {!loading && (
        <div className="space-y-2">
          {/* Empty state */}
          {dishes.length === 0 && !plan && !isConfirmed && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center mb-2">
              <ChefHat size={36} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-1">No menu plan yet</p>
              <p className="text-xs text-gray-400">Add a dish below to start planning</p>
            </div>
          )}

          {dishes.length === 0 && plan && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center mb-2">
              <UtensilsCrossed size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No dishes yet</p>
              <p className="text-xs text-gray-400">Add dishes below to build the menu</p>
            </div>
          )}

          {/* Dish Cards — no ingredients, just dish info */}
          {dishes.map(dish => (
            <DishCard
              key={dish.id}
              dish={dish}
              isConfirmed={isConfirmed}
              onRemoveDish={() => handleRemoveDish(dish.id)}
              onRatePresentation={() => setRatingDish(dish)}
              onUpdatePortions={(p) => handleUpdatePortions(dish.id, p)}
              saving={saving}
            />
          ))}

          {/* ── Inline Add Dish Form ── */}
          {isDraft && !isConfirmed && (
            <InlineAddDish
              recipes={allRecipes}
              recipesLoaded={recipesLoaded}
              onAdd={handleAddDish}
              saving={saving}
            />
          )}
        </div>
      )}

      {/* ── Presentation Rating Sheet ── */}
      {ratingDish && (
        <PresentationRatingSheet
          dish={ratingDish}
          onRated={() => { setRatingDish(null); loadPlan() }}
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
// INLINE ADD DISH — embedded form at bottom of dish list
// ════════════════════════════════════════════════════════════
function InlineAddDish({ recipes, recipesLoaded, onAdd, saving }) {
  const [expanded, setExpanded] = useState(false)
  const [recipeId, setRecipeId] = useState('')
  const [customName, setCustomName] = useState('')
  const [course, setCourse] = useState('main_course')
  const [portions, setPortions] = useState(20)

  // Group recipes by category for <optgroup>
  const grouped = {}
  for (const r of recipes) {
    const cat = r.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(r)
  }

  function handleRecipeChange(e) {
    const id = e.target.value
    setRecipeId(id)
    if (id) {
      const recipe = recipes.find(r => String(r.id) === String(id))
      if (recipe) {
        setCustomName(recipe.name)
        setCourse(CATEGORY_TO_COURSE[recipe.category] || 'main_course')
      }
    } else {
      setCustomName('')
    }
  }

  function handleSubmit() {
    const name = customName.trim()
    if (!name) return

    onAdd({
      course,
      name,
      portions,
      recipeId: recipeId ? parseInt(recipeId) : null,
    })

    // Reset form
    setRecipeId('')
    setCustomName('')
    setCourse('main_course')
    setPortions(20)
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50/50 transition font-semibold text-sm active:bg-orange-50"
      >
        <Plus size={18} />
        Add Dish
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border-2 border-orange-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b border-orange-100">
        <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2">
          <Plus size={16} />
          Add Dish
        </h3>
        <button
          onClick={() => { setExpanded(false); setRecipeId(''); setCustomName('') }}
          className="text-orange-400 hover:text-orange-600"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Recipe Dropdown */}
        <div>
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">
            Pick Recipe
          </label>
          <div className="relative">
            <select
              value={recipeId}
              onChange={handleRecipeChange}
              className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 pr-8"
            >
              <option value="">-- Select a recipe or type name below --</option>
              {Object.entries(grouped).map(([cat, items]) => (
                <optgroup key={cat} label={cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}>
                  {items.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.ingredient_count || 0} ing)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Custom dish name */}
        <div>
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">
            Dish Name
          </label>
          <input
            type="text"
            value={customName}
            onChange={e => { setCustomName(e.target.value); if (recipeId) setRecipeId('') }}
            placeholder="e.g. Grilled Chicken with Herbs"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
          />
          {recipeId && (
            <p className="text-[10px] text-orange-600 mt-1 flex items-center gap-1">
              <BookOpen size={10} /> Recipe ingredients will be auto-loaded
            </p>
          )}
        </div>

        {/* Course + Portions row */}
        <div className="flex gap-3">
          {/* Course */}
          <div className="flex-1">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">
              Course
            </label>
            <div className="relative">
              <select
                value={course}
                onChange={e => setCourse(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-200 pr-8"
              >
                {COURSES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Portions */}
          <div className="w-28">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">
              Portions
            </label>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <button
                onClick={() => setPortions(Math.max(1, portions - 5))}
                className="px-2 py-2.5 text-gray-600 hover:bg-gray-100 active:bg-gray-200"
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                value={portions}
                onChange={e => setPortions(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-center text-sm font-semibold bg-transparent border-0 focus:outline-none py-2.5"
              />
              <button
                onClick={() => setPortions(portions + 5)}
                className="px-2 py-2.5 text-gray-600 hover:bg-gray-100 active:bg-gray-200"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Add Button */}
        <button
          onClick={handleSubmit}
          disabled={!customName.trim() || saving}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition active:bg-orange-700"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {saving ? 'Adding...' : recipeId ? 'Add with Recipe' : 'Add Dish'}
        </button>
      </div>
    </div>
  )
}


// ════════════════════════════════════════════════════════════
// DISH CARD — compact dish info only (no ingredients)
// ════════════════════════════════════════════════════════════
function DishCard({ dish, isConfirmed, onRemoveDish, onRatePresentation, onUpdatePortions, saving }) {
  const dishPortions = dish.portions || 20
  const hasRecipe = !!dish.recipe_id
  const hasScore = dish.presentation_score > 0
  const isDefault = !!dish.is_default
  const ingredientCount = dish.ingredients.filter(i => !i.is_removed).length
  const primaryCount = dish.ingredients.filter(i => !i.is_removed && i.is_primary).length
  const weeklyCount = dish.ingredients.filter(i => !i.is_removed && !i.is_primary).length

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-3 py-3">
        <UtensilsCrossed size={15} className="text-orange-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-gray-900 truncate block">{dish.dish_name}</span>
          {ingredientCount > 0 && (
            <span className="text-[10px] text-gray-400">
              {primaryCount} daily · {weeklyCount} weekly ingredients
            </span>
          )}
        </div>

        {/* Badges */}
        {isDefault && (
          <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">
            Default
          </span>
        )}
        {hasRecipe && (
          <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
            <BookOpen size={8} />
          </span>
        )}
        {hasScore && (
          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
            <Star size={9} className="fill-amber-500 text-amber-500" /> {dish.presentation_score}
          </span>
        )}

        {/* Portions */}
        <button
          onClick={() => {
            if (isConfirmed || isDefault) return
            const n = prompt('Portions:', dishPortions)
            if (n && parseInt(n) > 0 && parseInt(n) !== dishPortions) onUpdatePortions(parseInt(n))
          }}
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
            isConfirmed || isDefault ? 'text-gray-500 bg-gray-50' : 'text-orange-700 bg-orange-50 active:bg-orange-100'
          }`}
        >
          <UsersIcon size={10} /> {dishPortions}
        </button>

        {/* Camera */}
        <button onClick={onRatePresentation} className="text-amber-600 p-0.5 shrink-0">
          <Camera size={15} />
        </button>

        {/* Delete — hidden for default dishes */}
        {!isConfirmed && !isDefault && (
          <button
            onClick={onRemoveDish}
            disabled={saving}
            className="text-red-400 p-0.5 shrink-0"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* ── Presentation feedback ── */}
      {dish.presentation_feedback && (
        <div className="px-3 py-2 bg-amber-50/50 border-t border-amber-100">
          <p className="text-[10px] text-amber-800">{dish.presentation_feedback}</p>
        </div>
      )}
    </div>
  )
}


// ════════════════════════════════════════════════════════════
// PRESENTATION RATING SHEET — upload photo + AI score
// ════════════════════════════════════════════════════════════
function PresentationRatingSheet({ dish, onRated, onClose }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [rating, setRating] = useState(null)
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
      const uploadResult = await menuApi.uploadDishPhoto(file)
      const photoUrl = uploadResult.url
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
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

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

        <div className="flex-1 overflow-y-auto px-5 py-4 scroll-touch">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 mb-3 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          {!rating && (
            <div className="text-center">
              {previewUrl ? (
                <div className="mb-4">
                  <img src={previewUrl} alt="Dish photo" className="w-full max-w-xs mx-auto rounded-xl border border-gray-200 shadow-sm" />
                  <button onClick={() => { setFile(null); setPreviewUrl(null) }} className="text-xs text-gray-500 hover:text-red-500 mt-2">
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
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG, or WebP</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
              <p className="text-[10px] text-gray-400 mt-2 max-w-xs mx-auto">
                AI will rate plating, color, garnish and portion on a 1-5 scale
              </p>
            </div>
          )}

          {uploading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 size={28} className="animate-spin text-amber-500 mb-3" />
              <p className="text-sm text-gray-600">Analyzing presentation...</p>
            </div>
          )}

          {rating && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s}
                    size={28}
                    className={s <= (rating.score || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
                  />
                ))}
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{rating.score}/5</p>

              {rating.feedback && (
                <p className="text-sm text-gray-600 bg-amber-50 rounded-xl px-4 py-3 mt-3 text-left">{rating.feedback}</p>
              )}

              {rating.tips && rating.tips.length > 0 && (
                <div className="mt-3 text-left">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tips</h4>
                  <ul className="space-y-1.5">
                    {rating.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                        <span className="text-gray-700">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {previewUrl && (
                <img src={previewUrl} alt="Rated dish" className="w-32 h-32 object-cover rounded-xl mx-auto mt-4 border border-gray-200" />
              )}
            </div>
          )}
        </div>

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
            <button onClick={handleClose} className="w-full bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
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
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList size={16} className="text-gray-600" />
            Audit Log
          </h3>
          <button onClick={handleClose} className="p-1"><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 overscroll-contain scroll-touch">
          {loading && <LoadingSpinner message="Loading audit trail..." />}

          {!loading && logs.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-8">No audit entries</p>
          )}

          {logs.map((log, idx) => (
            <div key={log.id} className="flex gap-3 mb-3">
              <div className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  log.action.includes('confirm') ? 'bg-green-500' :
                  log.action.includes('remove') ? 'bg-red-400' :
                  log.action.includes('recipe') || log.action.includes('load') ? 'bg-orange-500' :
                  log.action.includes('presentation') || log.action.includes('rate') ? 'bg-amber-500' :
                  'bg-gray-400'
                }`} />
                {idx < logs.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
              </div>

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
                    {log.new_value.qty !== undefined && <span>Qty: {log.old_value?.qty ?? '\u2014'} \u2192 {log.new_value.qty}</span>}
                    {log.new_value.portions !== undefined && <span>Portions: {log.old_value?.portions ?? '\u2014'} \u2192 {log.new_value.portions}</span>}
                    {log.new_value.dish_name && <span>Dish: {log.new_value.dish_name}</span>}
                    {log.new_value.status && <span>Status: {log.old_value?.status ?? '\u2014'} \u2192 {log.new_value.status}</span>}
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
