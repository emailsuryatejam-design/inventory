import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useUser } from '../context/AppContext'
import { items as itemsApi, issue as issueApi } from '../services/api'
import {
  ArrowLeft, Search, Plus, Minus, Trash2, FileOutput,
  Loader2, AlertTriangle, X
} from 'lucide-react'
import Badge from '../components/ui/Badge'

const ISSUE_TYPES = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'bar', label: 'Bar' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'guest', label: 'Guest' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
]

export default function IssueNew() {
  const user = useUser()
  const navigate = useNavigate()
  const [lines, setLines] = useState([])
  const [issueType, setIssueType] = useState('kitchen')
  const [costCenterId, setCostCenterId] = useState('')
  const [receivedByName, setReceivedByName] = useState('')
  const [department, setDepartment] = useState('')
  const [roomNumbers, setRoomNumbers] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Cost centers from API
  const [costCenters, setCostCenters] = useState([])

  // Item search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const searchRef = useRef(null)
  const searchTimerRef = useRef(null)

  // Load cost centers on mount
  useEffect(() => {
    async function loadCostCenters() {
      try {
        // cost_centers come from issue.php GET response
        const data = await issueApi.list({ per_page: 10, page: 1 })
        if (data.cost_centers) {
          setCostCenters(data.cost_centers)
          if (data.cost_centers.length > 0) {
            setCostCenterId(String(data.cost_centers[0].id))
          }
        }
      } catch (err) {
        console.error('Failed to load cost centers:', err)
      }
    }
    loadCostCenters()
  }, [])

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

  function addItem(item) {
    setLines(prev => [...prev, {
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.name,
      group_code: item.group_code,
      uom: item.stock_uom,
      price: item.last_purchase_price || item.weighted_avg_cost || 0,
      qty: 1,
      notes: '',
    }])
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
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

  const totalValue = lines.reduce((sum, l) => sum + l.qty * l.price, 0)

  async function handleSubmit() {
    if (lines.length === 0) {
      setError('Add at least one item')
      return
    }
    if (!receivedByName.trim()) {
      setError('Enter the name of the person receiving the items')
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
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Received By *</label>
            <input
              type="text"
              value={receivedByName}
              onChange={(e) => setReceivedByName(e.target.value)}
              placeholder="Name of person receiving items"
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Kitchen, F&B, Housekeeping"
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>
          {showRoomFields && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Room Numbers</label>
                <input
                  type="text"
                  value={roomNumbers}
                  onChange={(e) => setRoomNumbers(e.target.value)}
                  placeholder="e.g. 101, 102, 103"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Guest Count</label>
                <input
                  type="number"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  placeholder="Number of guests"
                  min="0"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
            </>
          )}
        </div>
      </div>

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
                  <input
                    type="number"
                    value={line.qty}
                    onChange={(e) => updateQty(index, parseFloat(e.target.value) || 1)}
                    className="w-16 h-9 text-center text-sm font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    min="0.5"
                    step="0.5"
                  />
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
    </div>
  )
}
