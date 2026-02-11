import { useState, useEffect } from 'react'
import { useUser } from '../context/AppContext'
import { recipes as recipesApi } from '../services/api'
import {
  Sparkles, Wine, GlassWater, Loader2, ChevronDown, ChevronUp,
  RefreshCw, AlertTriangle, X, Cherry, Citrus
} from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const MOODS = [
  { value: '', label: 'Any' },
  { value: 'refreshing', label: 'Refreshing' },
  { value: 'tropical', label: 'Tropical' },
  { value: 'classic', label: 'Classic' },
  { value: 'fruity', label: 'Fruity' },
  { value: 'spicy', label: 'Spicy' },
  { value: 'sweet', label: 'Sweet' },
  { value: 'savory', label: 'Savory' },
  { value: 'light', label: 'Light & Elegant' },
  { value: 'strong', label: 'Strong & Bold' },
]

const DRINK_TYPES = [
  { value: 'both', label: 'All Drinks', icon: Sparkles },
  { value: 'cocktail', label: 'Cocktails', icon: Wine },
  { value: 'mocktail', label: 'Mocktails', icon: GlassWater },
]

export default function Recipes() {
  const user = useUser()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Filters
  const [drinkType, setDrinkType] = useState('both')
  const [mood, setMood] = useState('')
  const [count, setCount] = useState(3)
  const [customIngredients, setCustomIngredients] = useState('')

  // Expanded recipe
  const [expanded, setExpanded] = useState(null)

  // Available ingredients
  const [ingredients, setIngredients] = useState(null)
  const [showIngredients, setShowIngredients] = useState(false)
  const [ingredientsLoading, setIngredientsLoading] = useState(false)

  // Info
  const [campName, setCampName] = useState('')

  async function generateRecipes() {
    setLoading(true)
    setError('')
    setRecipes([])
    setExpanded(null)

    try {
      const data = await recipesApi.generate({
        type: drinkType,
        mood: mood || null,
        count,
        ingredients: customIngredients
          ? customIngredients.split(',').map(s => s.trim()).filter(Boolean)
          : [],
      })

      if (data.error) {
        setError(data.error)
      }

      setRecipes(data.recipes || [])
      if (data.camp_name) setCampName(data.camp_name)

      if (data.recipes?.length > 0) {
        setExpanded(0) // Auto-expand first recipe
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadIngredients() {
    if (ingredients) {
      setShowIngredients(!showIngredients)
      return
    }
    setIngredientsLoading(true)
    try {
      const data = await recipesApi.ingredients()
      setIngredients(data.groups || [])
      setShowIngredients(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setIngredientsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={24} className="text-purple-500" />
            Recipe Suggestions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            AI-powered cocktail & mocktail ideas {campName ? `for ${campName}` : ''}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}

      {/* Controls */}
      <div data-guide="recipe-controls" className="bg-white rounded-xl border border-gray-200 p-4">
        {/* Drink Type Tabs */}
        <div data-guide="recipe-drink-types" className="flex gap-2 mb-4">
          {DRINK_TYPES.map(dt => (
            <button
              key={dt.value}
              onClick={() => setDrinkType(dt.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                drinkType === dt.value
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <dt.icon size={16} />
              {dt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mood / Style</label>
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            >
              {MOODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Number of Recipes</label>
            <select
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            >
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n} recipe{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Specific Ingredients (optional)
            </label>
            <input
              type="text"
              value={customIngredients}
              onChange={(e) => setCustomIngredients(e.target.value)}
              placeholder="e.g. gin, lime, tonic"
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={generateRecipes}
            disabled={loading}
            data-guide="recipe-generate-btn"
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-6 py-3 rounded-xl text-sm font-semibold transition"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generate Recipes
              </>
            )}
          </button>

          <button
            onClick={loadIngredients}
            disabled={ingredientsLoading}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl transition"
          >
            {ingredientsLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Cherry size={16} />
            )}
            View Available Ingredients
          </button>
        </div>
      </div>

      {/* Available Ingredients */}
      {showIngredients && ingredients && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Available Bar Ingredients</h3>
            <button onClick={() => setShowIngredients(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
            {ingredients.map(group => (
              <div key={group.code}>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                  {group.name} ({group.items.length})
                </p>
                <div className="space-y-0.5">
                  {group.items.slice(0, 15).map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm py-0.5">
                      <span className="text-gray-700 truncate">{item.name}</span>
                      {item.stock_qty > 0 ? (
                        <span className="text-xs text-green-600 ml-2 flex-shrink-0">
                          {item.stock_qty} {item.uom}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 ml-2 flex-shrink-0">-</span>
                      )}
                    </div>
                  ))}
                  {group.items.length > 15 && (
                    <p className="text-xs text-gray-400">+{group.items.length - 15} more</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-8 text-center">
          <Loader2 size={40} className="animate-spin mx-auto text-purple-500 mb-3" />
          <p className="text-purple-700 font-medium">Creating amazing recipes...</p>
          <p className="text-purple-500 text-sm mt-1">Our AI bartender is mixing ideas</p>
        </div>
      )}

      {/* Recipes Results */}
      {recipes.length > 0 && !loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{recipes.length} Recipe{recipes.length > 1 ? 's' : ''} Suggested</h2>
            <button
              onClick={generateRecipes}
              className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700"
            >
              <RefreshCw size={14} /> Regenerate
            </button>
          </div>

          {recipes.map((recipe, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Recipe Header */}
              <button
                onClick={() => setExpanded(expanded === index ? null : index)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  recipe.type === 'cocktail' || recipe.type === 'Cocktail'
                    ? 'bg-purple-100'
                    : 'bg-green-100'
                }`}>
                  {recipe.type === 'cocktail' || recipe.type === 'Cocktail' ? (
                    <Wine size={24} className="text-purple-600" />
                  ) : (
                    <GlassWater size={24} className="text-green-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900">{recipe.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{recipe.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    recipe.type === 'cocktail' || recipe.type === 'Cocktail'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {recipe.type}
                  </span>
                  {expanded === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {/* Recipe Details (expanded) */}
              {expanded === index && (
                <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                  {/* Description */}
                  {recipe.description && (
                    <p className="text-sm text-gray-600 mb-4 italic">{recipe.description}</p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Ingredients */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                        <Citrus size={14} /> Ingredients
                      </h4>
                      <ul className="space-y-1.5">
                        {(recipe.ingredients || []).map((ing, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                            <span className="text-gray-700">
                              {typeof ing === 'string' ? ing : (
                                <><strong>{ing.amount}</strong> {ing.item}</>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Steps */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Preparation</h4>
                      <ol className="space-y-2">
                        {(recipe.steps || []).map((step, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                              {i + 1}
                            </span>
                            <span className="text-gray-700">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  {/* Glass & Garnish */}
                  {(recipe.glass || recipe.garnish) && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {recipe.glass && (
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                          <span className="text-gray-500">Glass:</span>{' '}
                          <span className="font-medium text-gray-700">{recipe.glass}</span>
                        </div>
                      )}
                      {recipe.garnish && (
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                          <span className="text-gray-500">Garnish:</span>{' '}
                          <span className="font-medium text-gray-700">{recipe.garnish}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state — no recipes generated yet */}
      {recipes.length === 0 && !loading && (
        <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 rounded-xl border border-purple-100 p-8 text-center">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Wine size={36} className="text-purple-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Safari Cocktail Creator</h3>
          <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
            Get AI-powered cocktail and mocktail recipe suggestions based on your camp's
            available bar inventory. Perfect for creating unique safari lodge experiences.
          </p>
          <button
            onClick={generateRecipes}
            disabled={loading}
            className="mt-4 inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition"
          >
            <Sparkles size={18} />
            Get Recipe Ideas
          </button>
        </div>
      )}
    </div>
  )
}
