import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useUser } from '../context/AppContext'
import { items as itemsApi, orders as ordersApi } from '../services/api'
import {
  ArrowLeft, Search, Plus, Minus, Trash2, ShoppingCart,
  Loader2, AlertTriangle, X
} from 'lucide-react'
import Badge from '../components/ui/Badge'

export default function OrderNew() {
  const user = useUser()
  const navigate = useNavigate()
  const [lines, setLines] = useState([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Item search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const searchRef = useRef(null)
  const searchTimerRef = useRef(null)

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
      // Filter out items already in the order
      const existingIds = new Set(lines.map(l => l.item_id))
      setSearchResults(data.items.filter(i => !existingIds.has(i.id)))
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  function addItem(item) {
    setLines(prev => [...prev, {
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.name,
      group_code: item.group_code,
      uom: item.stock_uom,
      price: item.last_purchase_price || item.weighted_avg_cost || 0,
      qty: 1,
    }])
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
  }

  function updateQty(index, newQty) {
    if (newQty < 1) return
    setLines(prev => prev.map((l, i) => i === index ? { ...l, qty: newQty } : l))
  }

  function removeLine(index) {
    setLines(prev => prev.filter((_, i) => i !== index))
  }

  const totalValue = lines.reduce((sum, l) => sum + l.qty * l.price, 0)

  async function handleSubmit() {
    if (lines.length === 0) {
      setError('Add at least one item to your order')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const result = await ordersApi.create({
        notes: notes || null,
        lines: lines.map(l => ({
          item_id: l.item_id,
          qty: l.qty,
        })),
      })
      navigate(`/app/orders/${result.order.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app/orders" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Order</h1>
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
                placeholder="Search items to add..."
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
                  onClick={() => addItem(item)}
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
                  <Plus size={18} className="text-green-600 flex-shrink-0" />
                </button>
              ))}
              {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">No items found</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Order Lines */}
      {lines.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Search and add items to your order above</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 mb-4">
          <div className="divide-y divide-gray-100">
            {lines.map((line, index) => (
              <div key={line.item_id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{line.item_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-gray-400">{line.item_code}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{line.uom}</span>
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

                {/* Qty Controls */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => updateQty(index, line.qty - 1)}
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Order Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special instructions or notes..."
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
              <p className="text-sm text-gray-500">{lines.length} items</p>
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
                  Submitting...
                </>
              ) : (
                <>
                  <ShoppingCart size={18} />
                  Submit Order
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
