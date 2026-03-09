import { useState, useEffect, useCallback } from 'react'
import { useUser, isManager } from '../context/AppContext'
import { setMenus as setMenusApi, requisitionTypes as reqTypesApi } from '../services/api'
import { CalendarDays, Plus, X, Trash2, Copy, Search, ChefHat, GripVertical } from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function SetMenus() {
  const user = useUser()
  const canManage = isManager(user?.role)

  const [week, setWeek] = useState({})
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeDay, setActiveDay] = useState(1)
  const [activeType, setActiveType] = useState('')

  // Recipe search for adding dishes
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  // Copy day modal
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyTarget, setCopyTarget] = useState(1)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [weekResult, typesResult] = await Promise.all([
        setMenusApi.getWeek(),
        reqTypesApi.list(),
      ])
      setWeek(weekResult.week || {})
      const loadedTypes = typesResult.types || []
      setTypes(loadedTypes)
      if (loadedTypes.length > 0 && !activeType) {
        setActiveType(loadedTypes[0].code)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getDishes = useCallback(() => {
    return week[activeDay]?.[activeType] || []
  }, [week, activeDay, activeType])

  async function searchRecipes(q) {
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const result = await setMenusApi.searchRecipes(q)
      setSearchResults(result.recipes || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  async function addDish(recipe) {
    try {
      await setMenusApi.addDish({
        day_of_week: activeDay,
        type_code: activeType,
        recipe_id: recipe.id,
        recipe_name: recipe.name,
      })
      setShowAddModal(false)
      setSearchQuery('')
      setSearchResults([])
      loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeDish(id) {
    if (!confirm('Remove this dish from the set menu?')) return
    try {
      await setMenusApi.removeDish(id)
      loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function copyDay() {
    if (copyTarget === activeDay) return
    try {
      await setMenusApi.copyDay({
        from_day: activeDay,
        to_day: copyTarget,
        type_code: activeType,
      })
      setShowCopyModal(false)
      loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function clearDay() {
    if (!confirm(`Clear all ${DAYS[activeDay - 1]} ${activeType} dishes?`)) return
    try {
      await setMenusApi.clearDay({
        day_of_week: activeDay,
        type_code: activeType,
      })
      loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const dishes = getDishes()

  return (
    <div>
      <div className="flex items-center justify-between mb-4" data-guide="set-menu-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rotational Set Menus</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure weekly rotation menus for kitchen requisitions</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      {loading ? (
        <LoadingSpinner message="Loading set menus..." />
      ) : (
        <>
          {/* Day tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1" data-guide="set-menu-day-grid">
            {DAYS.map((day, idx) => {
              const dayNum = idx + 1
              const dishCount = Object.values(week[dayNum] || {}).reduce((sum, arr) => sum + arr.length, 0)
              return (
                <button
                  key={dayNum}
                  onClick={() => setActiveDay(dayNum)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                    activeDay === dayNum
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                >
                  {day.slice(0, 3)}
                  {dishCount > 0 && (
                    <span className={`ml-1 text-xs ${activeDay === dayNum ? 'text-amber-100' : 'text-gray-400'}`}>
                      ({dishCount})
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Type tabs */}
          {types.length > 0 && (
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {types.map(t => {
                const count = (week[activeDay]?.[t.code] || []).length
                return (
                  <button
                    key={t.code}
                    onClick={() => setActiveType(t.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                      activeType === t.code
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border'
                    }`}
                  >
                    {t.name}
                    {count > 0 && (
                      <span className={`ml-1 ${activeType === t.code ? 'text-green-100' : 'text-gray-400'}`}>
                        ({count})
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Action bar */}
          {canManage && activeType && (
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => { setShowAddModal(true); setSearchQuery(''); setSearchResults([]) }}
                data-guide="set-menu-add-recipe"
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition"
              >
                <Plus size={14} /> Add Dish
              </button>
              <button
                onClick={() => { setShowCopyModal(true); setCopyTarget(activeDay === 7 ? 1 : activeDay + 1) }}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border text-gray-600 hover:bg-gray-50 text-xs font-medium rounded-lg transition"
              >
                <Copy size={14} /> Copy Day
              </button>
              {dishes.length > 0 && (
                <button
                  onClick={clearDay}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition"
                >
                  <Trash2 size={14} /> Clear
                </button>
              )}
            </div>
          )}

          {/* Dishes list */}
          {!activeType ? (
            <EmptyState icon={ClipboardList} title="No type selected" description="Select a meal type above" />
          ) : dishes.length === 0 ? (
            <EmptyState icon={ChefHat} title={`No dishes for ${DAYS[activeDay - 1]} ${activeType}`} description={canManage ? 'Click "Add Dish" to add recipes' : ''} />
          ) : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-left text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold">Dish</th>
                    <th className="px-4 py-3 font-semibold hidden sm:table-cell">Cuisine</th>
                    <th className="px-4 py-3 font-semibold hidden md:table-cell">Servings</th>
                    <th className="px-4 py-3 font-semibold hidden md:table-cell">Ingredients</th>
                    {canManage && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dishes.map((d, idx) => (
                    <tr key={d.id || idx} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{d.recipe_name}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{d.cuisine || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{d.recipe_servings || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {d.ingredient_count || 0} items
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => removeDish(d.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg"
                            title="Remove"
                          >
                            <Trash2 size={15} className="text-red-400" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add Dish Modal — Recipe Search */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                Add Dish — {DAYS[activeDay - 1]} {activeType}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <div className="p-4 border-b shrink-0">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); searchRecipes(e.target.value) }}
                  className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Search recipes..."
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {searching ? (
                <div className="py-8 text-center text-gray-400 text-sm">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  {searchQuery.length >= 2 ? 'No recipes found' : 'Type at least 2 characters to search'}
                </div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map(r => (
                    <button
                      key={r.id}
                      onClick={() => addDish(r)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-amber-50 transition flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-gray-900 text-sm">{r.name}</span>
                        {r.cuisine && <span className="text-xs text-gray-400 ml-2">{r.cuisine}</span>}
                      </div>
                      <div className="text-xs text-gray-400">
                        {r.ingredient_count || 0} ingredients
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Copy Day Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCopyModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Copy Day</h2>
              <button onClick={() => setShowCopyModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Copy all <strong>{activeType}</strong> dishes from <strong>{DAYS[activeDay - 1]}</strong> to:
              </p>
              <select
                value={copyTarget}
                onChange={e => setCopyTarget(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                {DAYS.map((day, idx) => (
                  <option key={idx + 1} value={idx + 1} disabled={idx + 1 === activeDay}>
                    {day} {idx + 1 === activeDay ? '(current)' : ''}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCopyModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={copyDay}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
