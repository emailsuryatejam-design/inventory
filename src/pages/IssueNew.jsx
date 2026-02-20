import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useUser } from '../context/AppContext'
import { items as itemsApi, issue as issueApi, users as usersApi, kitchen as kitchenApi } from '../services/api'
import { useToast } from '../components/ui/Toast'
import {
  ArrowLeft, Search, Plus, Minus, Trash2, FileOutput,
  Loader2, AlertTriangle, X, ChevronDown, ChefHat, Sparkles, Star
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import KitchenRecipeSheet from '../components/kitchen/KitchenRecipeSheet'

const ISSUE_TYPES = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'bar', label: 'Bar' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'guest', label: 'Guest' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
]

const DEPARTMENTS = [
  'Kitchen', 'F&B', 'Housekeeping', 'Front Office', 'Bar',
  'Maintenance', 'Laundry', 'Garden', 'Administration', 'Security'
]

const ROOM_OPTIONS = [
  '101', '102', '103', '104', '105', '106', '107', '108',
  '201', '202', '203', '204', '205', '206', '207', '208'
]

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50]

export default function IssueNew() {
  const user = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const [lines, setLines] = useState([])
  const [issueType, setIssueType] = useState('kitchen')
  const [costCenterId, setCostCenterId] = useState('')
  const [receivedByName, setReceivedByName] = useState(user?.name || '')
  const [department, setDepartment] = useState('')
  const [roomNumbers, setRoomNumbers] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Cost centers from API
  const [costCenters, setCostCenters] = useState([])

  // Staff list for "Received By" dropdown
  const [staffList, setStaffList] = useState([])

  // Item search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const searchRef = useRef(null)
  const searchTimerRef = useRef(null)

  // Room multi-select
  const [showRoomPicker, setShowRoomPicker] = useState(false)
  const [selectedRooms, setSelectedRooms] = useState([])

  // Kitchen recipe sheet
  const [recipeItem, setRecipeItem] = useState(null)

  // AI suggested items (from preferences)
  const [suggestedItems, setSuggestedItems] = useState([])
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false)

  // Kitchen food group codes
  const FOOD_GROUPS = ['FD', 'FM', 'FY', 'FV', 'FF']

  // Load cost centers and staff on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [issueData, staffData] = await Promise.all([
          issueApi.list({ per_page: 10, page: 1 }),
          usersApi.list(),
        ])
        if (issueData.cost_centers) {
          setCostCenters(issueData.cost_centers)
          if (issueData.cost_centers.length > 0) {
            setCostCenterId(String(issueData.cost_centers[0].id))
          }
        }
        const activeStaff = (staffData.users || []).filter(u => u.is_active)
        setStaffList(activeStaff)
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }
    loadData()
  }, [])

  // Auto-select cost center matching issue type
  useEffect(() => {
    if (costCenters.length > 0) {
      const match = costCenters.find(c =>
        c.name?.toLowerCase().includes(issueType.toLowerCase())
      )
      if (match) setCostCenterId(String(match.id))
    }
  }, [issueType, costCenters])

  // Load suggested items when issue type is kitchen
  useEffect(() => {
    if (issueType === 'kitchen' && !suggestionsLoaded) {
      kitchenApi.suggestedItems('issue')
        .then(data => {
          setSuggestedItems(data.frequent_items || [])
          setSuggestionsLoaded(true)
        })
        .catch(() => setSuggestionsLoaded(true))
    }
  }, [issueType, suggestionsLoaded])

  useEffect(() => {
    if (searchQuery.length >= 2) {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      searchTimerRef.current = setTimeout(() => searchItems(), 300)
    } else {
      setSearchResults([])
    }
  }, [searchQuery])

  async function searchItems() {
    setSearching(true)
    try {
      const data = await itemsApi.list({ search: searchQuery, per_page: 15, active: 1 })
      const existingIds = new Set(lines.map(l => l.item_id))
      setSearchResults(data.items.filter(i => !existingIds.has(i.id)))
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  // Intercept food items for kitchen issue to show recipe sheet
  function handleItemTap(item) {
    if (issueType === 'kitchen' && FOOD_GROUPS.includes(item.group_code)) {
      // Show recipe sheet for food items in kitchen mode
      setRecipeItem(item)
      setSearchQuery('')
      setSearchResults([])
      setShowSearch(false)
      return
    }
    addItem(item)
  }

  function addItem(item) {
    setLines(prev => [...prev, {
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.name,
      group_code: item.group_code,
      uom: item.stock_uom || item.uom,
      price: item.last_purchase_price || item.weighted_avg_cost || 0,
      qty: 1,
      notes: '',
    }])
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
  }

  // Called when user picks "Use Recipe" in KitchenRecipeSheet
  function handleRecipeIngredients(ingredients, recipe) {
    const existingIds = new Set(lines.map(l => l.item_id))
    const newLines = ingredients
      .filter(ing => !existingIds.has(ing.item_id))
      .map(ing => ({
        item_id: ing.item_id,
        item_code: ing.item_code || '',
        item_name: ing.item_name,
        group_code: '',
        uom: ing.uom || '',
        price: 0,
        qty: ing.qty || 1,
        notes: recipe ? `Recipe: ${recipe.name}` : '',
      }))
    setLines(prev => [...prev, ...newLines])
  }

  // Called when user skips recipe in KitchenRecipeSheet
  function handleRecipeSkip() {
    if (recipeItem) {
      addItem(recipeItem)
    }
  }

  // Quick-add a suggested item
  function addSuggestedItem(sugItem) {
    const exists = lines.some(l => l.item_id === sugItem.item_id)
    if (exists) return
    // For kitchen food items, show recipe sheet
    if (FOOD_GROUPS.includes(sugItem.group_code || '')) {
      setRecipeItem({
        id: sugItem.item_id,
        name: sugItem.name,
        item_code: sugItem.item_code,
        group_code: sugItem.group_code,
        stock_uom: sugItem.uom,
      })
      return
    }
    setLines(prev => [...prev, {
      item_id: sugItem.item_id,
      item_code: sugItem.item_code || '',
      item_name: sugItem.name,
      group_code: sugItem.group_code || '',
      uom: sugItem.uom || '',
      price: 0,
      qty: 1,
      notes: '',
    }])
  }

  function updateLine(index, field, value) {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  function updateQty(index, newQty) {
    if (newQty < 0.5) return
    setLines(prev => prev.map((l, i) => i === index ? { ...l, qty: newQty } : l))
  }

  function removeLine(index) {
    setLines(prev => prev.filter((_, i) => i !== index))
  }

  function toggleRoom(room) {
    setSelectedRooms(prev => {
      const next = prev.includes(room) ? prev.filter(r => r !== room) : [...prev, room]
      setRoomNumbers(next.join(', '))
      return next
    })
  }

  const totalValue = lines.reduce((sum, l) => sum + l.qty * l.price, 0)

  async function handleSubmit() {
    if (lines.length === 0) {
      setError('Add at least one item')
      return
    }
    if (!costCenterId) {
      setError('Select a cost center')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const result = await issueApi.create({
        issue_type: issueType,
        cost_center_id: parseInt(costCenterId),
        received_by_name: receivedByName.trim(),
        department: department || null,
        room_numbers: roomNumbers || null,
        guest_count: guestCount ? parseInt(guestCount) : null,
        notes: notes || null,
        lines: lines.map(l => ({
          item_id: l.item_id,
          qty: l.qty,
          notes: l.notes || null,
        })),
      })

      // Log pattern for preference learning (fire-and-forget)
      kitchenApi.logPattern(
        lines.map(l => ({ item_id: l.item_id, qty: l.qty })),
        'issue',
        result?.voucher?.id
      ).catch(() => {})

      toast.success(`Issue voucher created — ${lines.length} items`)
      navigate('/app/issue')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Show extra fields based on issue type
  const showRoomFields = ['guest', 'housekeeping'].includes(issueType)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app/issue" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Issue Voucher</h1>
          <p className="text-sm text-gray-500">
            {user?.camp_name || 'Your Camp'} — {lines.length} items
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Issue Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Issue Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Issue Type *</label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            >
              {ISSUE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cost Center *</label>
            <select
              value={costCenterId}
              onChange={(e) => setCostCenterId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            >
              <option value="">Select cost center</option>
              {costCenters.map(cc => (
                <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>
              ))}
            </select>
          </div>

          {/* Received By — Staff Dropdown */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Received By *</label>
            <div className="relative">
              <select
                value={receivedByName}
                onChange={(e) => setReceivedByName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none bg-white"
              >
                <option value="">— Select person —</option>
                {staffList.map(u => (
                  <option key={u.id} value={u.name}>
                    {u.name} ({u.role?.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Department — Dropdown */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
            <div className="relative">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none bg-white"
              >
                <option value="">— Select department —</option>
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {showRoomFields && (
            <>
              {/* Room Numbers — Multi-select pills */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Room Numbers</label>
                <button
                  type="button"
                  onClick={() => setShowRoomPicker(!showRoomPicker)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg text-left bg-white flex items-center justify-between"
                >
                  <span className={selectedRooms.length ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedRooms.length ? selectedRooms.join(', ') : 'Tap to select rooms'}
                  </span>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>
                {showRoomPicker && (
                  <div className="mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg grid grid-cols-4 gap-1.5">
                    {ROOM_OPTIONS.map(room => (
                      <button
                        key={room}
                        type="button"
                        onClick={() => toggleRoom(room)}
                        className={`px-2 py-1.5 text-xs rounded-lg font-medium transition ${
                          selectedRooms.includes(room)
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {room}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Guest Count — Picker */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Guest Count</label>
                <div className="relative">
                  <select
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none bg-white"
                  >
                    <option value="">— Select —</option>
                    {GUEST_OPTIONS.map(n => (
                      <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI Suggested Items — shown for kitchen type when user has history */}
      {issueType === 'kitchen' && suggestedItems.length > 0 && lines.length === 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-orange-600" />
            <h3 className="text-xs font-semibold text-orange-800 uppercase tracking-wider">
              Your Frequent Items
            </h3>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scroll-touch">
            {suggestedItems.slice(0, 8).map(si => (
              <button
                key={si.item_id}
                onClick={() => addSuggestedItem(si)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white border border-orange-200 rounded-lg hover:border-orange-400 transition text-left"
              >
                <Star size={10} className="text-orange-500" />
                <div>
                  <p className="text-xs font-medium text-gray-900 whitespace-nowrap">{si.name}</p>
                  <p className="text-[9px] text-gray-400">{si.times_ordered}x ordered · {si.stock_qty} {si.uom}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Items Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true) }}
                onFocus={() => setShowSearch(true)}
                placeholder="Search items to issue..."
                className="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearch(false) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Search Results Dropdown */}
          {showSearch && (searchResults.length > 0 || searching) && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-72 overflow-y-auto">
              {searching && (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
                  <Loader2 size={16} className="animate-spin" /> Searching...
                </div>
              )}
              {searchResults.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleItemTap(item)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition text-left border-b border-gray-50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-gray-400">{item.item_code}</span>
                      <Badge variant={item.abc_class}>{item.abc_class}</Badge>
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.group_name} · {item.stock_uom}</p>
                  </div>
                  {issueType === 'kitchen' && FOOD_GROUPS.includes(item.group_code) ? (
                    <ChefHat size={18} className="text-orange-500 flex-shrink-0" />
                  ) : (
                    <Plus size={18} className="text-green-600 flex-shrink-0" />
                  )}
                </button>
              ))}
              {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">No items found</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Issue Lines */}
      {lines.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <FileOutput size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Search and add items to issue above</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 mb-4">
          <div className="divide-y divide-gray-100">
            {lines.map((line, index) => (
              <div key={line.item_id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{line.item_name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {line.item_code && <span className="text-xs font-mono text-gray-400">{line.item_code}</span>}
                    {line.uom && <><span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{line.uom}</span></>}
                    {line.notes?.startsWith('Recipe:') && (
                      <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <ChefHat size={8} /> {line.notes}
                      </span>
                    )}
                    {line.price > 0 && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">
                          TZS {Math.round(line.qty * line.price).toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Qty Controls — Stepper only, no typing */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => updateQty(index, line.qty - (line.qty > 1 ? 1 : 0.5))}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-14 h-9 flex items-center justify-center text-sm font-bold text-gray-900 bg-gray-50 rounded-lg border border-gray-200">
                    {line.qty}
                  </span>
                  <button
                    onClick={() => updateQty(index, line.qty + 1)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <button
                  onClick={() => removeLine(index)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {lines.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special notes for this issue..."
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
          />
        </div>
      )}

      {/* Submit Bar */}
      {lines.length > 0 && (
        <div className="sticky bottom-16 lg:bottom-0 bg-white border border-gray-200 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-500">{lines.length} items · {issueType}</p>
              <p className="text-lg font-bold text-gray-900">
                TZS {Math.round(totalValue).toLocaleString()}
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-3 rounded-xl text-sm font-semibold transition"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FileOutput size={18} />
                  Create Issue Voucher
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Kitchen Recipe Sheet */}
      {recipeItem && (
        <KitchenRecipeSheet
          item={recipeItem}
          onClose={() => setRecipeItem(null)}
          onAddIngredients={handleRecipeIngredients}
          onSkip={handleRecipeSkip}
        />
      )}
    </div>
  )
}
