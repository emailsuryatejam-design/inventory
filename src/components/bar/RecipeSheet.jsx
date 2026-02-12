import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Wine, GlassWater, Check, AlertTriangle, Search, Plus,
  Loader2, Sparkles, ChevronDown, ChevronUp, RefreshCw,
  Package, ArrowRight, Minus, Beaker
} from 'lucide-react'
import { menu as menuApi } from '../../services/api'
import { lockScroll, unlockScroll } from '../../utils/scrollLock'

/**
 * RecipeSheet — Bottom sheet showing cocktail/mocktail recipe with:
 * - Ingredient list with stock availability
 * - AI-suggested alternatives for out-of-stock ingredients
 * - Search and add custom ingredients
 * - Add to order with stock deduction
 */
export default function RecipeSheet({ item, onClose, onAddToCart }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)

  // Ingredient modifications
  const [substitutions, setSubstitutions] = useState({}) // { original_item_id: { item_id, name, stock_qty, uom } }
  const [extraIngredients, setExtraIngredients] = useState([]) // [{ item_id, name, qty, uom }]

  // AI suggestions
  const [suggestingFor, setSuggestingFor] = useState(null) // ingredient name being looked up
  const [suggestions, setSuggestions] = useState({}) // { ingredient_name: [alternatives] }
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

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // Load item detail with ingredients
  useEffect(() => {
    if (!item?.id) return
    setLoading(true)
    menuApi.item(item.id)
      .then(data => {
        setDetail(data)
      })
      .catch(err => console.error('Failed to load recipe:', err))
      .finally(() => setLoading(false))
  }, [item?.id])

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
        const data = await menuApi.searchIngredients(searchQuery)
        setSearchResults(data.items || [])
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }, [searchQuery])

  function handleClose() {
    if (closing) return
    setClosing(true)
    closingTimerRef.current = setTimeout(() => {
      onClose()
    }, 250)
  }

  // Suggest alternatives for an out-of-stock ingredient
  async function suggestAlternatives(ingredientName) {
    if (suggestions[ingredientName]) {
      // Already fetched — just toggle display
      setSuggestingFor(prev => prev === ingredientName ? null : ingredientName)
      return
    }
    setSuggestingFor(ingredientName)
    setSuggestLoading(true)
    try {
      const data = await menuApi.suggestAlternatives(ingredientName, item?.name)
      setSuggestions(prev => ({ ...prev, [ingredientName]: data.alternatives || [] }))
    } catch (err) {
      console.error('Failed to get alternatives:', err)
      setSuggestions(prev => ({ ...prev, [ingredientName]: [] }))
    } finally {
      setSuggestLoading(false)
    }
  }

  // Apply a substitution
  function applySubstitution(originalItemId, alt) {
    setSubstitutions(prev => ({
      ...prev,
      [originalItemId]: { item_id: alt.item_id, name: alt.name, stock_qty: alt.stock_qty, uom: alt.uom },
    }))
    setSuggestingFor(null)
  }

  // Remove a substitution
  function removeSubstitution(originalItemId) {
    setSubstitutions(prev => {
      const next = { ...prev }
      delete next[originalItemId]
      return next
    })
  }

  // Add extra ingredient from search
  function addExtraIngredient(stockItem) {
    // Avoid duplicates
    if (extraIngredients.find(e => e.item_id === stockItem.id)) return
    setExtraIngredients(prev => [
      ...prev,
      { item_id: stockItem.id, name: stockItem.name, qty: 1, uom: stockItem.uom, stock_qty: stockItem.stock_qty },
    ])
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
  }

  // Update extra ingredient qty
  function updateExtraQty(itemId, newQty) {
    if (newQty <= 0) {
      setExtraIngredients(prev => prev.filter(e => e.item_id !== itemId))
    } else {
      setExtraIngredients(prev => prev.map(e => e.item_id === itemId ? { ...e, qty: newQty } : e))
    }
  }

  // Add to cart with modifications
  function handleAddToOrder() {
    // Pass the item plus any substitutions/extras info
    onAddToCart(item, { substitutions, extraIngredients })
    handleClose()
  }

  const ingredients = detail?.ingredients || []
  const itemDetail = detail?.item || item
  const hasOutOfStock = ingredients.some(ing => ing.stock_qty <= 0)
  const description = itemDetail?.description || item?.description || ''

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
              {item.is_cocktail && <Wine size={18} className="text-purple-500 flex-shrink-0" />}
              {item.is_mocktail && <GlassWater size={18} className="text-green-500 flex-shrink-0" />}
              <h2 className="text-lg font-bold text-gray-900 truncate">{item.name}</h2>
            </div>
            {description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{description}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              {itemDetail?.glass_type && (
                <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                  {itemDetail.glass_type}
                </span>
              )}
              {itemDetail?.garnish && (
                <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                  {itemDetail.garnish}
                </span>
              )}
              {itemDetail?.serving_size_ml && (
                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {itemDetail.serving_size_ml}ml
                </span>
              )}
            </div>
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
              <Loader2 size={24} className="animate-spin text-amber-600" />
              <span className="ml-2 text-sm text-gray-500">Loading recipe...</span>
            </div>
          ) : ingredients.length === 0 ? (
            <div className="text-center py-8">
              <Beaker size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 mb-1">No recipe defined</p>
              <p className="text-xs text-gray-400">This drink doesn't have ingredient mappings yet.</p>
              <p className="text-xs text-gray-400 mt-1">You can still add it to your order.</p>
            </div>
          ) : (
            <>
              {/* Recipe Ingredients */}
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Recipe Ingredients
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
                          {/* Status indicator */}
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
                                <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                                  Primary
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400">
                                {ing.qty_per_serving} {ing.uom}/serving
                              </span>
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

                            {/* Show substitution */}
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

                          {/* Suggest button for out-of-stock */}
                          {isOut && !sub && (
                            <button
                              onClick={() => suggestAlternatives(ing.item_name)}
                              className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition flex-shrink-0"
                            >
                              <Sparkles size={10} />
                              Suggest
                            </button>
                          )}

                          {/* In-stock check */}
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
                            <p className="text-xs text-amber-600">No suitable alternatives found in stock.</p>
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

              {/* Extra Ingredients */}
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
            </>
          )}

          {/* Search to add ingredients */}
          <div className="mt-2 mb-4">
            {!showSearch ? (
              <button
                onClick={() => setShowSearch(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-gray-600 border border-dashed border-gray-300 rounded-xl hover:border-amber-400 hover:text-amber-700 transition"
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
                    className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
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
                        className="w-full flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 hover:border-amber-300 transition text-left"
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

          {/* Out of stock warning */}
          {hasOutOfStock && Object.keys(substitutions).length < ingredients.filter(i => i.stock_qty <= 0).length && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-800">Some ingredients are out of stock</p>
                <p className="text-[10px] text-amber-600 mt-0.5">
                  Tap "Suggest" to find AI-recommended alternatives, or add ingredients manually.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer: Add to Order */}
        <div className="flex-shrink-0 border-t border-gray-100 px-5 py-4 bg-white">
          <button
            onClick={handleAddToOrder}
            className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-800 text-white py-3.5 rounded-xl font-bold text-sm transition shadow-md"
          >
            <Plus size={18} />
            Add to Order
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}
