import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser, useSelectedCamp } from '../context/AppContext'
import { stockAdjustments as adjApi, items as itemsApi } from '../services/api'
import { useToast } from '../components/ui/Toast'
import { ArrowLeft, Loader2, Save, Send, Plus, Trash2, Search } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const ADJ_TYPES = [
  { value: 'damage', label: 'Damage', desc: 'Items damaged in storage or handling' },
  { value: 'expiry', label: 'Expiry', desc: 'Items past their expiry date' },
  { value: 'correction', label: 'Correction', desc: 'Correct stock count discrepancy' },
  { value: 'write_off', label: 'Write Off', desc: 'Items no longer usable' },
  { value: 'found', label: 'Found', desc: 'Items found during count' },
]

export default function StockAdjustmentNew() {
  const navigate = useNavigate()
  const user = useUser()
  const { campId } = useSelectedCamp()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [adjustmentType, setAdjustmentType] = useState('damage')
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState([])

  // Item search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Debounced item search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const result = await itemsApi.list({ search: searchQuery, per_page: 10 })
        setSearchResults(result.items || [])
      } catch (err) {
        // ignore search errors
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  function addItem(item) {
    // Avoid duplicates
    if (lines.some(l => l.item_id === item.id)) {
      toast.error('Item already added')
      return
    }
    setLines(prev => [...prev, {
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.name,
      uom: item.stock_uom,
      current_qty: null, // will be filled by backend
      adjustment_qty: '',
      reason: '',
    }])
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
  }

  function updateLine(index, field, value) {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  function removeLine(index) {
    setLines(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(status = 'draft') {
    if (!adjustmentType) return toast.error('Select adjustment type')
    if (lines.length === 0) return toast.error('Add at least one item')

    const invalidLines = lines.filter(l => !l.adjustment_qty || parseFloat(l.adjustment_qty) === 0)
    if (invalidLines.length > 0) return toast.error('All items must have a non-zero adjustment quantity')

    setSaving(true)
    try {
      const result = await adjApi.create({
        adjustment_type: adjustmentType,
        camp_id: campId || user?.camp_id,
        reason,
        status,
        lines: lines.map(l => ({
          item_id: l.item_id,
          adjustment_qty: parseFloat(l.adjustment_qty),
          reason: l.reason || null,
        })),
      })
      toast.success(`Adjustment ${result.adjustment.adjustment_number} ${status === 'submitted' ? 'submitted' : 'saved as draft'}`)
      navigate(`/app/stock-adjustments/${result.adjustment.id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Determine if type implies negative adjustments
  const isNegativeType = ['damage', 'expiry', 'write_off'].includes(adjustmentType)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/app/stock-adjustments')} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Stock Adjustment</h1>
      </div>

      {/* Adjustment Type */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">Adjustment Type</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {ADJ_TYPES.map(t => (
            <button key={t.value}
              type="button"
              onClick={() => setAdjustmentType(t.value)}
              className={`p-3 rounded-lg border text-left transition ${
                adjustmentType === t.value
                  ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-medium text-gray-900">{t.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Reason */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Reason</h2>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="input-field"
          rows={2}
          placeholder="Describe why this adjustment is needed..."
        />
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Items ({lines.length})</h2>
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition"
          >
            <Plus size={16} /> Add Item
          </button>
        </div>

        {/* Item Search */}
        {showSearch && (
          <div className="mb-4 relative">
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent">
              <Search size={16} className="text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 text-sm outline-none"
                placeholder="Search items by name or code..."
                autoFocus
              />
              <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]) }}
                className="text-gray-400 hover:text-gray-600">
                <Trash2 size={14} />
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                {searchResults.map(item => (
                  <button key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{item.item_code}</span>
                    </div>
                    <span className="text-xs text-gray-400">{item.stock_uom}</span>
                  </button>
                ))}
              </div>
            )}
            {searching && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">
                Searching...
              </div>
            )}
          </div>
        )}

        {/* Lines Table */}
        {lines.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            No items added yet. Click "Add Item" to begin.
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={idx} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-gray-400">{line.item_code}</span>
                      <span className="text-sm font-medium text-gray-900 truncate">{line.item_name}</span>
                      <span className="text-xs text-gray-400">{line.uom}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Adjustment Qty {isNegativeType ? '(will be negative)' : ''}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.adjustment_qty}
                          onChange={e => updateLine(idx, 'adjustment_qty', e.target.value)}
                          className={`input-field ${
                            line.adjustment_qty && parseFloat(line.adjustment_qty) < 0 ? 'text-red-600' :
                            line.adjustment_qty && parseFloat(line.adjustment_qty) > 0 ? 'text-green-600' : ''
                          }`}
                          placeholder={isNegativeType ? '-10' : '10'}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Line Reason (optional)</label>
                        <input
                          type="text"
                          value={line.reason}
                          onChange={e => updateLine(idx, 'reason', e.target.value)}
                          className="input-field"
                          placeholder="Specific reason for this item"
                        />
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeLine(idx)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition mt-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 -mx-4 mt-6 flex items-center justify-between gap-3">
        <button type="button" onClick={() => navigate('/app/stock-adjustments')}
          className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">
          Cancel
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => handleSubmit('draft')} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Draft
          </button>
          <button type="button" onClick={() => handleSubmit('submitted')} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Submit for Approval
          </button>
        </div>
      </div>
    </div>
  )
}
