import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useUser } from '../context/AppContext'
import { kitchen as kitchenApi } from '../services/api'
import { lockScroll, unlockScroll } from '../utils/scrollLock'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  BookOpen, Plus, Search, X, Loader2, ChevronDown, ChevronUp,
  Pencil, Trash2, ChefHat, Users, Clock, UtensilsCrossed,
  Check, Minus, Package, AlertTriangle, Filter
} from 'lucide-react'

// ── Constants ──────────────────────────────────────────
const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'appetizer', label: 'Appetizer' },
  { value: 'soup', label: 'Soup' },
  { value: 'salad', label: 'Salad' },
  { value: 'main_course', label: 'Main Course' },
  { value: 'side', label: 'Side' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'beverage', label: 'Beverage' },
  { value: 'bread', label: 'Bread' },
  { value: 'sauce', label: 'Sauce' },
]

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

// ════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════
export default function Recipes() {
  const user = useUser()

  // Recipe list
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Search + filter
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Expanded recipe detail
  const [expandedId, setExpandedId] = useState(null)
  const [expandedDetail, setExpandedDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Create/Edit sheet
  const [showSheet, setShowSheet] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState(null) // null = create, object = edit

  // Delete confirm
  const [deletingId, setDeletingId] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── Load recipes ──
  useEffect(() => {
    loadRecipes()
  }, [])

  async function loadRecipes() {
    setLoading(true)
    setError('')
    try {
      const data = await kitchenApi.recipes()
      setRecipes(data.recipes || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Load recipe detail when expanding ──
  async function toggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedDetail(null)
      return
    }
    setExpandedId(id)
    setDetailLoading(true)
    try {
      const data = await kitchenApi.recipe(id)
      setExpandedDetail(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Delete recipe ──
  async function handleDelete() {
    if (!deletingId) return
    setDeleteLoading(true)
    try {
      await kitchenApi.deleteRecipe(deletingId)
      setRecipes(prev => prev.filter(r => r.id !== deletingId))
      if (expandedId === deletingId) {
        setExpandedId(null)
        setExpandedDetail(null)
      }
      setDeletingId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Open edit sheet ──
  function openEdit(recipe) {
    setEditingRecipe(recipe)
    setShowSheet(true)
  }

  // ── Open create sheet ──
  function openCreate() {
    setEditingRecipe(null)
    setShowSheet(true)
  }

  // ── After save ──
  function handleSaved(savedRecipe) {
    // Refresh list
    loadRecipes()
    // If we were viewing this recipe, refresh detail
    if (expandedId === savedRecipe?.id) {
      toggleExpand(savedRecipe.id)
      setTimeout(() => toggleExpand(savedRecipe.id), 100)
    }
    setShowSheet(false)
  }

  // ── Filter recipes ──
  const filtered = recipes.filter(r => {
    if (categoryFilter && r.category !== categoryFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        r.name.toLowerCase().includes(q) ||
        (r.cuisine || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={24} className="text-orange-500" />
            Kitchen Recipes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage master recipes &amp; ingredients
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm"
        >
          <Plus size={16} />
          New Recipe
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}

      {/* Search + Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search recipes..."
              className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium border transition ${
              categoryFilter
                ? 'bg-orange-50 border-orange-200 text-orange-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Filter size={14} />
            Filter
          </button>
        </div>

        {/* Category pills */}
        {showFilters && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scroll-touch">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategoryFilter(c.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                  categoryFilter === c.value
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>{filtered.length} recipe{filtered.length !== 1 ? 's' : ''}</span>
        {categoryFilter && (
          <button
            onClick={() => setCategoryFilter('')}
            className="text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
          >
            <X size={12} /> Clear filter
          </button>
        )}
      </div>

      {/* Recipe List */}
      {filtered.length === 0 ? (
        <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 rounded-xl border border-orange-100 p-8 text-center">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ChefHat size={36} className="text-orange-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {searchQuery || categoryFilter ? 'No recipes found' : 'No Recipes Yet'}
          </h3>
          <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
            {searchQuery || categoryFilter
              ? 'Try adjusting your search or filter.'
              : 'Create your first recipe to start building your kitchen menu library.'}
          </p>
          {!searchQuery && !categoryFilter && (
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition"
            >
              <Plus size={18} />
              Create First Recipe
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              isExpanded={expandedId === recipe.id}
              detail={expandedId === recipe.id ? expandedDetail : null}
              detailLoading={detailLoading && expandedId === recipe.id}
              onToggle={() => toggleExpand(recipe.id)}
              onEdit={() => openEdit(recipe)}
              onDelete={() => setDeletingId(recipe.id)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deletingId && (
        <DeleteConfirm
          recipe={recipes.find(r => r.id === deletingId)}
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {/* Create / Edit Sheet */}
      {showSheet && (
        <RecipeSheet
          recipe={editingRecipe}
          onClose={() => setShowSheet(false)}
          onSaved={handleSaved}
        />
      )}

      {/* FAB for mobile */}
      <button
        onClick={openCreate}
        className="lg:hidden fixed bottom-24 right-4 z-50 w-14 h-14 bg-orange-600 hover:bg-orange-700 text-white rounded-full shadow-lg flex items-center justify-center transition"
      >
        <Plus size={24} />
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// RECIPE CARD
// ════════════════════════════════════════════════════════
function RecipeCard({ recipe, isExpanded, detail, detailLoading, onToggle, onEdit, onDelete }) {
  const ingredients = detail?.ingredients || []
  const instructions = detail?.recipe?.instructions ? JSON.parse(detail.recipe.instructions || '[]') : []

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition"
      >
        <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
          <ChefHat size={22} className="text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{recipe.name}</h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {recipe.category && (
              <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full capitalize">
                {recipe.category.replace('_', ' ')}
              </span>
            )}
            {recipe.cuisine && (
              <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {recipe.cuisine}
              </span>
            )}
            {recipe.serves && (
              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Users size={8} /> {recipe.serves}
              </span>
            )}
            {recipe.ingredient_count > 0 && (
              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Package size={8} /> {recipe.ingredient_count}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50/50">
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-orange-600" />
              <span className="ml-2 text-sm text-gray-500">Loading recipe...</span>
            </div>
          ) : (
            <>
              {/* Description */}
              {detail?.recipe?.description && (
                <p className="text-sm text-gray-600 mb-3 italic">{detail.recipe.description}</p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {detail?.recipe?.serves && (
                  <span className="text-xs bg-white border border-gray-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <Users size={12} className="text-gray-500" /> {detail.recipe.serves} servings
                  </span>
                )}
                {detail?.recipe?.prep_time_minutes > 0 && (
                  <span className="text-xs bg-white border border-gray-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <Clock size={12} className="text-gray-500" /> Prep {detail.recipe.prep_time_minutes}min
                  </span>
                )}
                {detail?.recipe?.cook_time_minutes > 0 && (
                  <span className="text-xs bg-white border border-gray-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <Clock size={12} className="text-gray-500" /> Cook {detail.recipe.cook_time_minutes}min
                  </span>
                )}
                {detail?.recipe?.difficulty && (
                  <span className={`text-xs px-2.5 py-1 rounded-lg capitalize ${
                    detail.recipe.difficulty === 'easy' ? 'bg-green-50 text-green-700 border border-green-200' :
                    detail.recipe.difficulty === 'hard' ? 'bg-red-50 text-red-700 border border-red-200' :
                    'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {detail.recipe.difficulty}
                  </span>
                )}
              </div>

              {/* Ingredients */}
              {ingredients.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Ingredients ({ingredients.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {ingredients.map(ing => (
                      <div key={ing.item_id || ing.id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          ing.is_primary ? 'bg-orange-500' : 'bg-gray-300'
                        }`} />
                        <span className="text-sm text-gray-900 truncate flex-1">{ing.item_name}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {ing.qty_per_serving} {ing.uom}
                        </span>
                        {ing.stock_qty !== undefined && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            ing.stock_qty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {ing.stock_qty > 0 ? `${ing.stock_qty}` : 'Out'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructions */}
              {instructions.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Instructions
                  </h4>
                  <ol className="space-y-2">
                    {instructions.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                          {i + 1}
                        </span>
                        <span className="text-gray-700">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 px-4 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-100 transition"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// DELETE CONFIRM DIALOG
// ════════════════════════════════════════════════════════
function DeleteConfirm({ recipe, loading, onConfirm, onCancel }) {
  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 z-[10010] animate-backdrop-in" onClick={onCancel} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[10011] bg-white rounded-2xl shadow-2xl max-w-sm mx-auto p-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Trash2 size={24} className="text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Delete Recipe?</h3>
          <p className="text-sm text-gray-500 mt-1">
            "{recipe?.name}" will be removed. Existing menu plans using this recipe won't be affected.
          </p>
        </div>
        <div className="flex gap-3 mt-5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Delete
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ════════════════════════════════════════════════════════
// CREATE / EDIT RECIPE SHEET
// ════════════════════════════════════════════════════════
function RecipeSheet({ recipe, onClose, onSaved }) {
  const [closing, setClosing] = useState(false)
  const closingTimerRef = useRef(null)

  // Form fields
  const [name, setName] = useState(recipe?.name || '')
  const [category, setCategory] = useState(recipe?.category || 'main_course')
  const [cuisine, setCuisine] = useState(recipe?.cuisine || '')
  const [serves, setServes] = useState(recipe?.serves || 4)
  const [difficulty, setDifficulty] = useState(recipe?.difficulty || 'medium')
  const [description, setDescription] = useState(recipe?.description || '')
  const [prepTime, setPrepTime] = useState(recipe?.prep_time_minutes || 0)
  const [cookTime, setCookTime] = useState(recipe?.cook_time_minutes || 0)

  // Ingredients
  const [ingredients, setIngredients] = useState([])
  const [ingLoading, setIngLoading] = useState(false)

  // Instructions
  const [instructions, setInstructions] = useState([''])

  // Ingredient search
  const [ingSearch, setIngSearch] = useState('')
  const [ingSearchResults, setIngSearchResults] = useState([])
  const [ingSearchLoading, setIngSearchLoading] = useState(false)
  const searchTimerRef = useRef(null)

  // Saving
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step indicator
  const [step, setStep] = useState(1) // 1 = details, 2 = ingredients, 3 = instructions

  // Lock scroll
  useEffect(() => {
    lockScroll()
    return () => unlockScroll()
  }, [])

  useEffect(() => {
    return () => {
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // Load existing recipe detail for editing
  useEffect(() => {
    if (!recipe?.id) return
    setIngLoading(true)
    kitchenApi.recipe(recipe.id)
      .then(data => {
        const r = data.recipe || {}
        setName(r.name || '')
        setCategory(r.category || 'main_course')
        setCuisine(r.cuisine || '')
        setServes(r.serves || 4)
        setDifficulty(r.difficulty || 'medium')
        setDescription(r.description || '')
        setPrepTime(r.prep_time_minutes || 0)
        setCookTime(r.cook_time_minutes || 0)

        // Load ingredients
        const ings = (data.ingredients || []).map(ing => ({
          item_id: ing.item_id,
          item_name: ing.item_name,
          qty_per_serving: ing.qty_per_serving,
          uom: ing.uom,
          is_primary: !!ing.is_primary,
          notes: ing.notes || '',
        }))
        setIngredients(ings)

        // Load instructions
        try {
          const steps = JSON.parse(r.instructions || '[]')
          setInstructions(steps.length > 0 ? steps : [''])
        } catch {
          setInstructions([''])
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setIngLoading(false))
  }, [recipe?.id])

  // Search ingredients (stock items)
  useEffect(() => {
    if (ingSearch.length < 2) {
      setIngSearchResults([])
      return
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      setIngSearchLoading(true)
      try {
        const data = await kitchenApi.searchIngredients(ingSearch)
        setIngSearchResults(data.items || [])
      } catch (err) {
        console.error('Ingredient search failed:', err)
      } finally {
        setIngSearchLoading(false)
      }
    }, 300)
  }, [ingSearch])

  function handleClose() {
    if (closing) return
    setClosing(true)
    closingTimerRef.current = setTimeout(() => onClose(), 250)
  }

  function addIngredient(stockItem) {
    if (ingredients.find(i => i.item_id === stockItem.id)) return
    setIngredients(prev => [
      ...prev,
      {
        item_id: stockItem.id,
        item_name: stockItem.name,
        qty_per_serving: 1,
        uom: stockItem.uom || 'pcs',
        is_primary: ingredients.length === 0, // First ingredient = primary
        notes: '',
      },
    ])
    setIngSearch('')
    setIngSearchResults([])
  }

  function updateIngredient(itemId, field, value) {
    setIngredients(prev => prev.map(i =>
      i.item_id === itemId ? { ...i, [field]: value } : i
    ))
  }

  function removeIngredient(itemId) {
    setIngredients(prev => prev.filter(i => i.item_id !== itemId))
  }

  function togglePrimary(itemId) {
    setIngredients(prev => prev.map(i =>
      i.item_id === itemId ? { ...i, is_primary: !i.is_primary } : i
    ))
  }

  // Instructions
  function updateInstruction(index, value) {
    setInstructions(prev => prev.map((s, i) => i === index ? value : s))
  }

  function addInstruction() {
    setInstructions(prev => [...prev, ''])
  }

  function removeInstruction(index) {
    if (instructions.length <= 1) return
    setInstructions(prev => prev.filter((_, i) => i !== index))
  }

  // Save
  async function handleSave() {
    if (!name.trim()) {
      setError('Recipe name is required')
      setStep(1)
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = {
        ...(recipe?.id ? { id: recipe.id } : {}),
        name: name.trim(),
        category,
        cuisine: cuisine.trim(),
        serves: parseInt(serves) || 4,
        difficulty,
        description: description.trim(),
        prep_time_minutes: parseInt(prepTime) || 0,
        cook_time_minutes: parseInt(cookTime) || 0,
        instructions: JSON.stringify(instructions.filter(s => s.trim())),
        ingredients: ingredients.map(i => ({
          item_id: i.item_id,
          qty_per_serving: parseFloat(i.qty_per_serving) || 0,
          is_primary: i.is_primary ? 1 : 0,
          notes: i.notes || '',
        })),
      }

      const data = await kitchenApi.saveRecipe(payload)
      onSaved(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const isEdit = !!recipe?.id

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-[10010] ${closing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[10011] bg-white rounded-t-2xl shadow-2xl max-h-[92dvh] overflow-hidden flex flex-col ${
          closing ? 'animate-slide-down' : 'animate-slide-up'
        }`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ChefHat size={18} className="text-orange-500" />
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Edit Recipe' : 'New Recipe'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {[
            { num: 1, label: 'Details' },
            { num: 2, label: 'Ingredients' },
            { num: 3, label: 'Instructions' },
          ].map(s => (
            <button
              key={s.num}
              onClick={() => setStep(s.num)}
              className={`flex-1 py-2.5 text-sm font-medium transition border-b-2 ${
                step === s.num
                  ? 'border-orange-500 text-orange-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle size={14} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')}><X size={14} /></button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 scroll-touch">

          {/* ── Step 1: Details ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Recipe Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Camembert Bruschetta"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  >
                    {CATEGORIES.filter(c => c.value).map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Cuisine</label>
                  <input
                    type="text"
                    value={cuisine}
                    onChange={e => setCuisine(e.target.value)}
                    placeholder="e.g. French"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Serves</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setServes(Math.max(1, serves - 1))}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center font-bold text-sm">{serves}</span>
                    <button
                      onClick={() => setServes(serves + 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Prep (min)</label>
                  <input
                    type="number"
                    value={prepTime || ''}
                    onChange={e => setPrepTime(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Cook (min)</label>
                  <input
                    type="number"
                    value={cookTime || ''}
                    onChange={e => setCookTime(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Difficulty</label>
                <div className="flex gap-2">
                  {DIFFICULTIES.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setDifficulty(d.value)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                        difficulty === d.value
                          ? d.value === 'easy' ? 'bg-green-100 text-green-700 border border-green-200'
                          : d.value === 'hard' ? 'bg-red-100 text-red-700 border border-red-200'
                          : 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of the dish..."
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Ingredients ── */}
          {step === 2 && (
            <div className="space-y-4">
              {ingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-orange-600" />
                  <span className="ml-2 text-sm text-gray-500">Loading ingredients...</span>
                </div>
              ) : (
                <>
                  {/* Search to add */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={ingSearch}
                      onChange={e => setIngSearch(e.target.value)}
                      placeholder="Search stock items to add..."
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                  </div>

                  {/* Search results */}
                  {ingSearchLoading && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Loader2 size={12} className="animate-spin" /> Searching...
                    </div>
                  )}
                  {ingSearchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg">
                      {ingSearchResults.map(si => {
                        const alreadyAdded = ingredients.some(i => i.item_id === si.id)
                        return (
                          <button
                            key={si.id}
                            onClick={() => !alreadyAdded && addIngredient(si)}
                            disabled={alreadyAdded}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-gray-100 last:border-0 transition ${
                              alreadyAdded ? 'bg-gray-50 opacity-50' : 'hover:bg-orange-50'
                            }`}
                          >
                            <Package size={12} className="text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{si.name}</p>
                              <span className="text-[10px] text-gray-400">{si.group_name} · {si.uom}</span>
                            </div>
                            {alreadyAdded ? (
                              <Check size={14} className="text-green-500 flex-shrink-0" />
                            ) : (
                              <Plus size={14} className="text-orange-500 flex-shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Added ingredients list */}
                  {ingredients.length === 0 ? (
                    <div className="text-center py-6">
                      <Package size={28} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">No ingredients added yet</p>
                      <p className="text-xs text-gray-400 mt-1">Search stock items above to add ingredients</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Recipe Ingredients ({ingredients.length})
                      </h4>
                      {ingredients.map(ing => (
                        <div key={ing.item_id} className="bg-white rounded-xl border border-gray-200 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              ing.is_primary ? 'bg-orange-500' : 'bg-gray-300'
                            }`} />
                            <span className="text-sm font-medium text-gray-900 flex-1 truncate">
                              {ing.item_name}
                            </span>
                            <button
                              onClick={() => togglePrimary(ing.item_id)}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition ${
                                ing.is_primary
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-gray-100 text-gray-500 hover:bg-orange-50'
                              }`}
                            >
                              {ing.is_primary ? 'Primary' : 'Secondary'}
                            </button>
                            <button
                              onClick={() => removeIngredient(ing.item_id)}
                              className="text-gray-400 hover:text-red-500 p-1"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-400 block mb-0.5">Qty/serving</label>
                              <input
                                type="number"
                                step="0.01"
                                value={ing.qty_per_serving}
                                onChange={e => updateIngredient(ing.item_id, 'qty_per_serving', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                              />
                            </div>
                            <div className="w-20">
                              <label className="text-[10px] text-gray-400 block mb-0.5">Unit</label>
                              <input
                                type="text"
                                value={ing.uom}
                                onChange={e => updateIngredient(ing.item_id, 'uom', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-400 block mb-0.5">Notes</label>
                              <input
                                type="text"
                                value={ing.notes}
                                onChange={e => updateIngredient(ing.item_id, 'notes', e.target.value)}
                                placeholder="optional"
                                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Step 3: Instructions ── */}
          {step === 3 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Steps ({instructions.filter(s => s.trim()).length})
              </h4>

              {instructions.map((inst, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center flex-shrink-0 mt-2 font-bold">
                    {i + 1}
                  </span>
                  <textarea
                    value={inst}
                    onChange={e => updateInstruction(i, e.target.value)}
                    placeholder={`Step ${i + 1}...`}
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
                  />
                  {instructions.length > 1 && (
                    <button
                      onClick={() => removeInstruction(i)}
                      className="text-gray-400 hover:text-red-500 p-1 mt-1.5"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={addInstruction}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-gray-600 border border-dashed border-gray-300 rounded-xl hover:border-orange-400 hover:text-orange-700 transition"
              >
                <Plus size={14} /> Add Step
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 px-5 py-4 bg-white">
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm transition"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><Loader2 size={16} className="animate-spin" /> Saving...</>
                ) : (
                  <><Check size={16} /> {isEdit ? 'Update Recipe' : 'Create Recipe'}</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
