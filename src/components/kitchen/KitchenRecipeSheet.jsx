import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X, ChefHat, Check, AlertTriangle, Search, Plus,
  Loader2, Sparkles, ArrowRight, Minus, Package,
  Clock, Users, UtensilsCrossed
} from 'lucide-react'
import { kitchen as kitchenApi } from '../../services/api'
import { lockScroll, unlockScroll } from '../../utils/scrollLock'

/**
 * KitchenRecipeSheet — Bottom sheet for kitchen requisitions.
 *
 * When a chef adds a food item to an issue voucher, this sheet
 * shows matching recipes with ingredient details, stock availability,
 * AI alternative suggestions, and manual ingredient search.
 *
 * Props:
 * - item: the stock item being added ({ id, name, item_code, group_code, uom })
 * - onClose: close callback
 * - onAddIngredients: (ingredients[]) => add recipe ingredients to the issue
 * - onSkip: () => just add the original item without recipe
 */
export default function KitchenRecipeSheet({ item, onClose, onAddIngredients, onSkip }) {
  const [recipes, setRecipes] = useState([])
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [recipeDetail, setRecipeDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [closing, setClosing] = useState(false)

  // AI recipe suggestion
  const [aiRecipes, setAiRecipes] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Ingredient modifications
  const [substitutions, setSubstitutions] = useState({})
  const [extraIngredients, setExtraIngredients] = useState([])

  // AI suggestions for alternatives
  const [suggestingFor, setSuggestingFor] = useState(null)
  const [suggestions, setSuggestions] = useState({})
  const [suggestLoading, setSuggestLoading] = useState(false)

  // Ingredient search
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimerRef = useRef(null)

  const closingTimerRef = useRef(null)

  // Lock scroll when open
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

  // Search for matching recipes by item name
  useEffect(() => {
    if (!item?.name) return
    setLoading(true)
    kitchenApi.searchRecipes(item.name)
      .then(data => {
        setRecipes(data.recipes || [])
        // Auto-select first recipe if found
        if (data.recipes?.length > 0) {
          loadRecipeDetail(data.recipes[0].id)
          setSelectedRecipe(data.recipes[0].id)
        }
      })
      .catch(err => console.error('Recipe search failed:', err))
      .finally(() => setLoading(false))
  }, [item?.name])

  // Search ingredients
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const data = await kitchenApi.searchIngredients(searchQuery)
        setSearchResults(data.items || [])
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }, [searchQuery])

  async function loadRecipeDetail(recipeId) {
    setDetailLoading(true)
    setSubstitutions({})
    setExtraIngredients([])
    setSuggestions({})
    setSuggestingFor(null)
    try {
      const data = await kitchenApi.recipe(recipeId)
      setRecipeDetail(data)
    } catch (err) {
      console.error('Failed to load recipe:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  // AI suggest recipe when no stored recipes found
  async function suggestAiRecipe() {
    setAiLoading(true)
    try {
      const data = await kitchenApi.suggestRecipe(item.name)
      setAiRecipes(data.recipes || [])
    } catch (err) {
      console.error('AI suggestion failed:', err)
    } finally {
      setAiLoading(false)
    }
  }

  function handleClose() {
    if (closing) return
    setClosing(true)
    closingTimerRef.current = setTimeout(() => {
      onClose()
    }, 250)
  }

  async function suggestAlternatives(ingredientName) {
    if (suggestions[ingredientName]) {
      setSuggestingFor(prev => prev === ingredientName ? null : ingredientName)
      return
    }
    setSuggestingFor(ingredientName)
    setSuggestLoading(true)
    try {
      const data = await kitchenApi.suggestAlternatives(ingredientName, recipeDetail?.recipe?.name)
      setSuggestions(prev => ({ ...prev, [ingredientName]: data.alternatives || [] }))
    } catch (err) {
      console.error('Failed to get alternatives:', err)
      setSuggestions(prev => ({ ...prev, [ingredientName]: [] }))
    } finally {
      setSuggestLoading(false)
    }
  }

  function applySubstitution(originalItemId, alt) {
    setSubstitutions(prev => ({
      ...prev,
      [originalItemId]: { item_id: alt.item_id, name: alt.name, stock_qty: alt.stock_qty, uom: alt.uom },
    }))
    setSuggestingFor(null)
  }

  function removeSubstitution(originalItemId) {
    setSubstitutions(prev => {
      const next = { ...prev }
      delete next[originalItemId]
      return next
    })
  }

  function addExtraIngredient(stockItem) {
    if (extraIngredients.find(e => e.item_id === stockItem.id)) return
    setExtraIngredients(prev => [
      ...prev,
      { item_id: stockItem.id, name: stockItem.name, qty: 1, uom: stockItem.uom, stock_qty: stockItem.stock_qty },
    ])
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
  }

  function updateExtraQty(itemId, newQty) {
    if (newQty <= 0) {
      setExtraIngredients(prev => prev.filter(e => e.item_id !== itemId))
    } else {
      setExtraIngredients(prev => prev.map(e => e.item_id === itemId ? { ...e, qty: newQty } : e))
    }
  }

  // Build final ingredient list and pass to parent
  function handleUseRecipe() {
    const ingredients = (recipeDetail?.ingredients || []).map(ing => {
      const sub = substitutions[ing.item_id]
      return {
        item_id: sub ? sub.item_id : ing.item_id,
        item_name: sub ? sub.name : ing.item_name,
        item_code: ing.item_code,
        uom: sub ? sub.uom : ing.uom,
        qty: ing.qty_per_serving,
        is_substitution: !!sub,
        original_name: sub ? ing.item_name : null,
      }
    })

    // Add extras
    extraIngredients.forEach(ext => {
      ingredients.push({
        item_id: ext.item_id,
        item_name: ext.name,
        uom: ext.uom,
        qty: ext.qty,
        is_extra: true,
      })
    })

    onAddIngredients(ingredients, recipeDetail?.recipe)
    handleClose()
  }

  const ingredients = recipeDetail?.ingredients || []
  const recipe = recipeDetail?.recipe || null
  const hasOutOfStock = ingredients.some(ing => ing.stock_qty <= 0)

  if (!item) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-[10010] ${closing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[10011] bg-white rounded-t-2xl shadow-2xl max-h-[90dvh] overflow-hidden flex flex-col ${
          closing ? 'animate-slide-down' : 'animate-slide-up'
        }`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <ChefHat size={18} className="text-orange-500 flex-shrink-0" />
              <h2 className="text-lg font-bold text-gray-900 truncate">
                {recipe ? recipe.name : `Recipes for ${item.name}`}
              </h2>
            </div>
            {recipe && (
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {recipe.category && (
                  <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full capitalize">
                    {recipe.category}
                  </span>
                )}
                {recipe.cuisine && (
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    {recipe.cuisine}
                  </span>
                )}
                {recipe.serves && (
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Users size={8} /> {recipe.serves} servings
                  </span>
                )}
                {recipe.prep_time_minutes && (
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock size={8} /> {recipe.prep_time_minutes + (recipe.cook_time_minutes || 0)}min
                  </span>
                )}
              </div>
            )}
            {!recipe && !loading && recipes.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No stored recipes found for this item.</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition flex-shrink-0 ml-2"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 scroll-touch">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-orange-600" />
              <span className="ml-2 text-sm text-gray-500">Searching recipes...</span>
            </div>
          ) : recipes.length === 0 && !recipe ? (
            /* No stored recipes — offer AI suggestion or skip */
            <div className="text-center py-6">
              <UtensilsCrossed size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 mb-1">No recipe found for "{item.name}"</p>
              <p className="text-xs text-gray-400 mb-4">
                Ask AI to suggest a recipe, or skip to add the item directly.
              </p>

              {/* AI Suggest */}
              {!aiRecipes && (
                <button
                  onClick={suggestAiRecipe}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-semibold hover:bg-amber-100 transition mb-3"
                >
                  {aiLoading ? (
                    <><Loader2 size={14} className="animate-spin" /> Thinking...</>
                  ) : (
                    <><Sparkles size={14} /> Ask AI for Recipe</>
                  )}
                </button>
              )}

              {/* AI suggested recipes */}
              {aiRecipes && aiRecipes.length > 0 && (
                <div className="text-left mt-2 space-y-2">
                  <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                    AI Suggested Recipes
                  </h3>
                  {aiRecipes.map((r, idx) => (
                    <div key={idx} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-sm font-bold text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full capitalize">{r.category}</span>
                        {r.serves && <span className="text-[10px] text-gray-400">{r.serves} servings</span>}
                        {r.prep_time_minutes && <span className="text-[10px] text-gray-400">{r.prep_time_minutes + (r.cook_time_minutes || 0)}min</span>}
                      </div>
                      {r.ingredients && (
                        <div className="mt-2 space-y-0.5">
                          {r.ingredients.map((ing, iIdx) => (
                            <div key={iIdx} className="text-[10px] text-gray-600 flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${ing.is_primary ? 'bg-orange-500' : 'bg-gray-300'}`} />
                              {ing.qty} {ing.uom} {ing.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {aiRecipes && aiRecipes.length === 0 && (
                <p className="text-xs text-gray-400">AI couldn't suggest a recipe for this item.</p>
              )}
            </div>
          ) : (
            <>
              {/* Recipe selection tabs (if multiple) */}
              {recipes.length > 1 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scroll-touch">
                  {recipes.map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedRecipe(r.id)
                        loadRecipeDetail(r.id)
                      }}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                        selectedRecipe === r.id
                          ? 'bg-orange-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              )}

              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-orange-600" />
                  <span className="ml-2 text-sm text-gray-500">Loading recipe...</span>
                </div>
              ) : ingredients.length === 0 ? (
                <div className="text-center py-6">
                  <ChefHat size={28} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No ingredients defined for this recipe.</p>
                </div>
              ) : (
                <>
                  {/* Description */}
                  {recipe?.description && (
                    <p className="text-xs text-gray-500 mb-3">{recipe.description}</p>
                  )}

                  {/* Ingredients */}
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Ingredients
                  </h3>

                  <div className="space-y-2 mb-4">
                    {ingredients.map(ing => {
                      const isOut = ing.stock_qty <= 0
                      const isLow = ing.stock_status === 'low' || ing.stock_status === 'critical'
                      const sub = substitutions[ing.item_id]
                      const showingSuggestions = suggestingFor === ing.item_name

                      return (
                        <div key={ing.item_id}>
                          <div
                            className={`bg-white rounded-xl border p-3 ${
                              sub ? 'border-blue-300 bg-blue-50/30' :
                              isOut ? 'border-red-200 bg-red-50/30' :
                              isLow ? 'border-amber-200 bg-amber-50/30' :
                              'border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                sub ? 'bg-blue-500' :
                                isOut ? 'bg-red-500' :
                                isLow ? 'bg-amber-500' :
                                'bg-green-500'
                              }`} />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm font-medium truncate ${isOut && !sub ? 'text-red-700 line-through' : 'text-gray-900'}`}>
                                    {ing.item_name}
                                  </p>
                                  {ing.is_primary && (
                                    <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-gray-400">
                                    {ing.qty_per_serving} {ing.uom}/serving
                                  </span>
                                  {ing.notes && (
                                    <span className="text-[10px] text-gray-400 italic">{ing.notes}</span>
                                  )}
                                  {isOut ? (
                                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                                      Out of stock
                                    </span>
                                  ) : (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                      isLow ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                      {ing.stock_qty} {ing.uom}
                                    </span>
                                  )}
                                </div>

                                {sub && (
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <ArrowRight size={10} className="text-blue-500" />
                                    <span className="text-[11px] text-blue-700 font-medium">
                                      Using: {sub.name}
                                    </span>
                                    <span className="text-[10px] text-blue-500">({sub.stock_qty} {sub.uom})</span>
                                    <button
                                      onClick={() => removeSubstitution(ing.item_id)}
                                      className="text-blue-400 hover:text-red-500 ml-1"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {isOut && !sub && (
                                <button
                                  onClick={() => suggestAlternatives(ing.item_name)}
                                  className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition flex-shrink-0"
                                >
                                  <Sparkles size={10} />
                                  Suggest
                                </button>
                              )}

                              {!isOut && !sub && (
                                <Check size={16} className="text-green-500 flex-shrink-0" />
                              )}
                            </div>
                          </div>

                          {/* AI Suggestions dropdown */}
                          {showingSuggestions && (
                            <div className="ml-5 mt-1 bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <Sparkles size={12} className="text-amber-600" />
                                <span className="text-xs font-semibold text-amber-800">
                                  AI Suggested Alternatives
                                </span>
                              </div>

                              {suggestLoading ? (
                                <div className="flex items-center gap-2 py-2 text-xs text-amber-600">
                                  <Loader2 size={12} className="animate-spin" />
                                  Finding alternatives...
                                </div>
                              ) : (suggestions[ing.item_name] || []).length === 0 ? (
                                <p className="text-xs text-amber-600">No suitable alternatives found.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {(suggestions[ing.item_name] || []).map(alt => (
                                    <button
                                      key={alt.item_id}
                                      onClick={() => applySubstitution(ing.item_id, alt)}
                                      className="w-full flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-200 hover:border-amber-400 transition text-left"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-900">{alt.name}</p>
                                        <p className="text-[10px] text-gray-500">{alt.reason}</p>
                                      </div>
                                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                        {alt.stock_qty} {alt.uom}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Extra ingredients */}
                  {extraIngredients.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Added Ingredients
                      </h3>
                      <div className="space-y-1.5">
                        {extraIngredients.map(ext => (
                          <div key={ext.item_id} className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                            <Plus size={12} className="text-blue-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{ext.name}</p>
                              <span className="text-[10px] text-gray-400">{ext.stock_qty} {ext.uom} in stock</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => updateExtraQty(ext.item_id, ext.qty - 1)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-blue-100 hover:bg-blue-200 text-blue-700"
                              >
                                <Minus size={10} />
                              </button>
                              <span className="w-6 text-center text-xs font-bold">{ext.qty}</span>
                              <button
                                onClick={() => updateExtraQty(ext.item_id, ext.qty + 1)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-blue-100 hover:bg-blue-200 text-blue-700"
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Out of stock warning */}
                  {hasOutOfStock && Object.keys(substitutions).length < ingredients.filter(i => i.stock_qty <= 0).length && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                      <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-amber-800">Some ingredients are out of stock</p>
                        <p className="text-[10px] text-amber-600 mt-0.5">
                          Tap "Suggest" for AI alternatives, or add ingredients manually.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Search to add ingredients */}
              <div className="mt-2 mb-4">
                {!showSearch ? (
                  <button
                    onClick={() => setShowSearch(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-gray-600 border border-dashed border-gray-300 rounded-xl hover:border-orange-400 hover:text-orange-700 transition"
                  >
                    <Search size={14} />
                    Search & add ingredient
                  </button>
                ) : (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search stock items..."
                        autoFocus
                        className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      />
                      <button
                        onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]) }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {searchLoading && (
                      <div className="flex items-center gap-2 py-2 text-xs text-gray-500">
                        <Loader2 size={12} className="animate-spin" /> Searching...
                      </div>
                    )}

                    {searchResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {searchResults.map(si => (
                          <button
                            key={si.id}
                            onClick={() => addExtraIngredient(si)}
                            className="w-full flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 hover:border-orange-300 transition text-left"
                          >
                            <Package size={12} className="text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">{si.name}</p>
                              <span className="text-[10px] text-gray-400">{si.group_name}</span>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              si.stock_qty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                            }`}>
                              {si.stock_qty > 0 ? `${si.stock_qty} ${si.uom}` : 'Out'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">No items found</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 px-5 py-4 bg-white">
          <div className="flex gap-3">
            <button
              onClick={() => { onSkip(); handleClose() }}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold text-sm transition"
            >
              Skip Recipe
            </button>
            {ingredients.length > 0 && (
              <button
                onClick={handleUseRecipe}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold text-sm transition shadow-md"
              >
                <ChefHat size={16} />
                Use Recipe
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
