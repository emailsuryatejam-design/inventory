import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useUser } from '../context/AppContext'
import {
  suppliers as suppliersApi,
  items as itemsApi,
  itemSuppliers as itemSuppliersApi,
  purchaseOrders as poApi,
} from '../services/api'
import { useToast } from '../components/ui/Toast'
import {
  ArrowLeft, Search, Plus, Minus, Trash2, FileText,
  Loader2, AlertTriangle, X, ChevronDown, Building2
} from 'lucide-react'

export default function PurchaseOrderNew() {
  const user = useUser()
  const navigate = useNavigate()
  const toast = useToast()

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState(30)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [saveMode, setSaveMode] = useState('draft') // draft or submit

  // Supplier search
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierResults, setSupplierResults] = useState([])
  const [searchingSupplier, setSearchingSupplier] = useState(false)
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const supplierTimerRef = useRef(null)

  // Item search
  const [itemSearch, setItemSearch] = useState('')
  const [itemResults, setItemResults] = useState([])
  const [searchingItems, setSearchingItems] = useState(false)
  const [showItemDropdown, setShowItemDropdown] = useState(false)
  const itemTimerRef = useRef(null)

  // Supplier search
  useEffect(() => {
    if (supplierSearch.length >= 2) {
      if (supplierTimerRef.current) clearTimeout(supplierTimerRef.current)
      supplierTimerRef.current = setTimeout(async () => {
        setSearchingSupplier(true)
        try {
          const data = await suppliersApi.list({ search: supplierSearch, is_active: 1, per_page: 10 })
          setSupplierResults(data.suppliers || [])
        } catch (err) {
          console.error('Supplier search failed:', err)
        } finally {
          setSearchingSupplier(false)
        }
      }, 300)
    } else {
      setSupplierResults([])
    }
  }, [supplierSearch])

  // Item search
  useEffect(() => {
    if (itemSearch.length >= 2) {
      if (itemTimerRef.current) clearTimeout(itemTimerRef.current)
      itemTimerRef.current = setTimeout(async () => {
        setSearchingItems(true)
        try {
          const data = await itemsApi.list({ search: itemSearch, per_page: 15, active: 1 })
          const existingIds = new Set(lines.map(l => l.item_id))
          setItemResults((data.items || []).filter(i => !existingIds.has(i.id)))
        } catch (err) {
          console.error('Item search failed:', err)
        } finally {
          setSearchingItems(false)
        }
      }, 300)
    } else {
      setItemResults([])
    }
  }, [itemSearch, lines])

  function selectSupplier(supplier) {
    setSupplierId(supplier.id)
    setSupplierName(supplier.name)
    setSupplierSearch('')
    setShowSupplierDropdown(false)
    if (supplier.payment_terms) setPaymentTerms(supplier.payment_terms)
    // Reset lines when supplier changes
    setLines([])
  }

  function clearSupplier() {
    setSupplierId('')
    setSupplierName('')
    setLines([])
  }

  function addItem(item) {
    setLines(prev => [...prev, {
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.name,
      uom: item.purchase_uom || item.stock_uom,
      unit_price: item.last_purchase_price || 0,
      quantity: 1,
      tax_rate: 0,
    }])
    setItemSearch('')
    setItemResults([])
    setShowItemDropdown(false)
  }

  function updateLine(index, field, value) {
    setLines(prev => prev.map((l, i) => {
      if (i !== index) return l
      return { ...l, [field]: value }
    }))
  }

  function removeLine(index) {
    setLines(prev => prev.filter((_, i) => i !== index))
  }

  // Calculate totals
  const subtotal = lines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0)
  const taxTotal = lines.reduce((sum, l) => {
    const lineTotal = l.quantity * l.unit_price
    return sum + (lineTotal * (l.tax_rate / 100))
  }, 0)
  const grandTotal = subtotal + taxTotal

  async function handleSubmit(mode) {
    if (!supplierId) {
      setError('Please select a supplier')
      return
    }
    if (lines.length === 0) {
      setError('Add at least one item')
      return
    }
    for (const l of lines) {
      if (l.quantity <= 0) {
        setError(`Quantity must be greater than 0 for ${l.item_name}`)
        return
      }
      if (l.unit_price < 0) {
        setError(`Unit price cannot be negative for ${l.item_name}`)
        return
      }
    }

    setError('')
    setSubmitting(true)

    try {
      const payload = {
        supplier_id: supplierId,
        delivery_date: deliveryDate || null,
        payment_terms: paymentTerms,
        notes: notes || null,
        status: mode === 'submit' ? 'submitted' : 'draft',
        lines: lines.map(l => ({
          item_id: l.item_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate || 0,
          description: null,
        })),
      }
      const result = await poApi.create(payload)
      toast.success(`PO ${result.purchase_order?.po_number || ''} ${mode === 'submit' ? 'submitted' : 'saved as draft'}`)
      navigate(`/app/purchase-orders/${result.purchase_order?.id}`)
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
        <Link to="/app/purchase-orders" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Purchase Order</h1>
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

      {/* Step 1: Supplier Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Supplier Details</h2>

        {supplierId ? (
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Building2 size={20} className="text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{supplierName}</p>
              <p className="text-xs text-gray-500">Payment terms: {paymentTerms} days</p>
            </div>
            <button
              onClick={clearSupplier}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={supplierSearch}
              onChange={(e) => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true) }}
              onFocus={() => setShowSupplierDropdown(true)}
              placeholder="Search suppliers..."
              className="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
            {showSupplierDropdown && (supplierResults.length > 0 || searchingSupplier) && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-60 overflow-y-auto">
                {searchingSupplier && (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
                    <Loader2 size={16} className="animate-spin" /> Searching...
                  </div>
                )}
                {supplierResults.map(s => (
                  <button
                    key={s.id}
                    onClick={() => selectSupplier(s)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition text-left border-b border-gray-50 last:border-0"
                  >
                    <Building2 size={18} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        {s.supplier_code} · {s.payment_terms || 30} day terms
                        {s.email && ` · ${s.email}`}
                      </p>
                    </div>
                  </button>
                ))}
                {!searchingSupplier && supplierResults.length === 0 && supplierSearch.length >= 2 && (
                  <div className="px-4 py-3 text-sm text-gray-500 text-center">No suppliers found</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Delivery Date & Payment Terms */}
        {supplierId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Date</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Terms (days)</label>
              <input
                type="number"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(parseInt(e.target.value) || 0)}
                min="0"
                className="input-field"
              />
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Add Items */}
      {supplierId && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Add Items</h2>
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => { setItemSearch(e.target.value); setShowItemDropdown(true) }}
                  onFocus={() => setShowItemDropdown(true)}
                  placeholder="Search items to add..."
                  className="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
                {itemSearch && (
                  <button
                    onClick={() => { setItemSearch(''); setItemResults([]); setShowItemDropdown(false) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {showItemDropdown && (itemResults.length > 0 || searchingItems) && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-72 overflow-y-auto">
                {searchingItems && (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
                    <Loader2 size={16} className="animate-spin" /> Searching...
                  </div>
                )}
                {itemResults.map(item => (
                  <button
                    key={item.id}
                    onClick={() => addItem(item)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition text-left border-b border-gray-50 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-gray-400">{item.item_code}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">
                        {item.group_name} · {item.purchase_uom || item.stock_uom}
                        {item.last_purchase_price > 0 && ` · KES ${Number(item.last_purchase_price).toLocaleString()}`}
                      </p>
                    </div>
                    <Plus size={18} className="text-green-600 flex-shrink-0" />
                  </button>
                ))}
                {!searchingItems && itemResults.length === 0 && itemSearch.length >= 2 && (
                  <div className="px-4 py-3 text-sm text-gray-500 text-center">No items found</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PO Lines */}
      {lines.length === 0 && supplierId && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mb-4">
          <FileText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Search and add items above</p>
        </div>
      )}

      {lines.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-4">
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Item</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2.5 w-28">Qty</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2.5 w-32">Unit Price</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2.5 w-24">Tax %</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2.5 w-32">Line Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const lineTotal = line.quantity * line.unit_price
                  const lineTax = lineTotal * (line.tax_rate / 100)
                  return (
                    <tr key={`${line.item_id}-${index}`} className="border-b border-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{line.item_name}</p>
                        <p className="text-xs text-gray-400">{line.item_code} · {line.uom}</p>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full text-right text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.unit_price}
                          onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-full text-right text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={line.tax_rate}
                          onChange={(e) => updateLine(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                          className="w-full text-right text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-gray-900">
                          KES {Math.round(lineTotal + lineTax).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeLine(index)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-gray-100">
            {lines.map((line, index) => {
              const lineTotal = line.quantity * line.unit_price
              return (
                <div key={`${line.item_id}-${index}`} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{line.item_name}</p>
                      <p className="text-xs text-gray-400">{line.item_code} · {line.uom}</p>
                    </div>
                    <button
                      onClick={() => removeLine(index)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Qty</label>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Price</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.unit_price}
                        onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Total</label>
                      <p className="text-sm font-medium text-gray-900 py-1.5">
                        KES {Math.round(lineTotal).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
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
            placeholder="Any special instructions for the supplier..."
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
          />
        </div>
      )}

      {/* Submit Bar */}
      {lines.length > 0 && (
        <div className="sticky bottom-16 lg:bottom-0 bg-white border border-gray-200 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-gray-500 space-y-0.5">
                <p>Subtotal: KES {Math.round(subtotal).toLocaleString()}</p>
                {taxTotal > 0 && <p>Tax: KES {Math.round(taxTotal).toLocaleString()}</p>}
              </div>
              <p className="text-lg font-bold text-gray-900">
                KES {Math.round(grandTotal).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSubmit('draft')}
                disabled={submitting}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition"
              >
                {submitting && saveMode === 'draft' ? <Loader2 size={16} className="animate-spin" /> : null}
                Save Draft
              </button>
              <button
                onClick={() => handleSubmit('submit')}
                disabled={submitting}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition"
              >
                {submitting && saveMode === 'submit' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
                Submit PO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
