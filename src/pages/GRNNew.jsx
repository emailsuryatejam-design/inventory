import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useUser } from '../context/AppContext'
import { grn as grnApi, purchaseOrders as poApi } from '../services/api'
import { useToast } from '../components/ui/Toast'
import {
  ArrowLeft, PackageCheck, Loader2, AlertTriangle, Search, X
} from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function GRNNew() {
  const user = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const preselectedPoId = searchParams.get('po_id')

  // PO selection
  const [poId, setPoId] = useState(preselectedPoId || '')
  const [poNumber, setPoNumber] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [poSearch, setPoSearch] = useState('')
  const [poResults, setPoResults] = useState([])
  const [searchingPO, setSearchingPO] = useState(false)
  const [showPODropdown, setShowPODropdown] = useState(false)

  // GRN data
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0])
  const [deliveryNoteRef, setDeliveryNoteRef] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([])
  const [loadingLines, setLoadingLines] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load PO lines when PO is selected
  useEffect(() => {
    if (poId) loadPOLines(poId)
  }, [poId])

  // PO search
  useEffect(() => {
    if (poSearch.length >= 2) {
      const timer = setTimeout(async () => {
        setSearchingPO(true)
        try {
          const data = await poApi.list({ search: poSearch, status: 'sent,approved,partial_received', per_page: 10 })
          setPoResults(data.purchase_orders || [])
        } catch (err) {
          console.error('PO search failed:', err)
        } finally {
          setSearchingPO(false)
        }
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setPoResults([])
    }
  }, [poSearch])

  async function loadPOLines(id) {
    setLoadingLines(true)
    setError('')
    try {
      const data = await grnApi.poLines(id)
      if (data.purchase_order) {
        setPoNumber(data.purchase_order.po_number)
        setSupplierName(data.purchase_order.supplier_name)
      }
      // Pre-populate lines from PO
      setLines((data.lines || []).map(l => ({
        po_line_id: l.id,
        item_id: l.item_id,
        item_name: l.item_name,
        item_code: l.item_code,
        ordered_qty: l.quantity,
        already_received: l.received_qty || 0,
        remaining: l.remaining_qty || (l.quantity - (l.received_qty || 0)),
        received_qty: l.remaining_qty || (l.quantity - (l.received_qty || 0)),
        rejected_qty: 0,
        rejection_reason: '',
        unit_cost: l.unit_price,
        batch_number: '',
        expiry_date: '',
      })))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingLines(false)
    }
  }

  function selectPO(po) {
    setPoId(po.id)
    setPoNumber(po.po_number)
    setSupplierName(po.supplier_name)
    setPoSearch('')
    setShowPODropdown(false)
  }

  function clearPO() {
    setPoId('')
    setPoNumber('')
    setSupplierName('')
    setLines([])
  }

  function updateLine(index, field, value) {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  const totalValue = lines.reduce((sum, l) => sum + (l.received_qty * l.unit_cost), 0)

  async function handleSubmit() {
    if (!poId) {
      setError('Please select a Purchase Order')
      return
    }
    if (!receivedDate) {
      setError('Please enter the received date')
      return
    }

    const validLines = lines.filter(l => l.received_qty > 0 || l.rejected_qty > 0)
    if (validLines.length === 0) {
      setError('Enter received or rejected quantities for at least one item')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      const payload = {
        po_id: parseInt(poId),
        received_date: receivedDate,
        delivery_note_ref: deliveryNoteRef || null,
        notes: notes || null,
        lines: validLines.map(l => ({
          po_line_id: l.po_line_id,
          item_id: l.item_id,
          received_qty: l.received_qty,
          rejected_qty: l.rejected_qty || 0,
          rejection_reason: l.rejection_reason || null,
          unit_cost: l.unit_cost,
          batch_number: l.batch_number || null,
          expiry_date: l.expiry_date || null,
        })),
      }
      const result = await grnApi.create(payload)
      toast.success(`GRN ${result.grn?.grn_number || ''} created`)
      navigate(`/app/grn/${result.grn?.id}`)
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
        <Link to="/app/grn" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Goods Received Note</h1>
          <p className="text-sm text-gray-500">
            {supplierName ? `${supplierName} — ` : ''}{lines.length} line items
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

      {/* Step 1: Select PO */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Purchase Order</h2>

        {poId ? (
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <PackageCheck size={20} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-medium text-gray-900">{poNumber}</p>
              <p className="text-xs text-gray-500">{supplierName}</p>
            </div>
            {!preselectedPoId && (
              <button
                onClick={clearPO}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={poSearch}
              onChange={(e) => { setPoSearch(e.target.value); setShowPODropdown(true) }}
              onFocus={() => setShowPODropdown(true)}
              placeholder="Search purchase orders (sent/approved)..."
              className="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
            {showPODropdown && (poResults.length > 0 || searchingPO) && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-60 overflow-y-auto">
                {searchingPO && (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
                    <Loader2 size={16} className="animate-spin" /> Searching...
                  </div>
                )}
                {poResults.map(po => (
                  <button
                    key={po.id}
                    onClick={() => selectPO(po)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition text-left border-b border-gray-50 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium text-gray-900">{po.po_number}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          po.status === 'sent' ? 'bg-indigo-100 text-indigo-700' :
                          po.status === 'partial_received' ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {po.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{po.supplier_name} · {po.line_count} items</p>
                    </div>
                  </button>
                ))}
                {!searchingPO && poResults.length === 0 && poSearch.length >= 2 && (
                  <div className="px-4 py-3 text-sm text-gray-500 text-center">No open POs found</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Date & Delivery Ref */}
        {poId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Received Date *</label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Note Ref</label>
              <input
                type="text"
                value={deliveryNoteRef}
                onChange={(e) => setDeliveryNoteRef(e.target.value)}
                placeholder="Supplier's delivery note #"
                className="input-field"
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading PO lines */}
      {loadingLines && <LoadingSpinner message="Loading PO lines..." />}

      {/* GRN Lines */}
      {lines.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-4">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Receive Items</h2>
            <p className="text-xs text-gray-500 mt-0.5">Enter received and rejected quantities for each item</p>
          </div>

          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Item</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Ordered</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Prev Rcvd</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2 w-28">Received</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2 w-28">Rejected</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Unit Cost</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.po_line_id} className="border-b border-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{line.item_name}</p>
                      <p className="text-xs text-gray-400">{line.item_code}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-gray-700">{line.ordered_qty}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm ${line.already_received > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                        {line.already_received}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        max={line.remaining}
                        value={line.received_qty}
                        onChange={(e) => updateLine(idx, 'received_qty', parseFloat(e.target.value) || 0)}
                        className="w-full text-right text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.rejected_qty}
                        onChange={(e) => updateLine(idx, 'rejected_qty', parseFloat(e.target.value) || 0)}
                        className="w-full text-right text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-gray-600">KES {Number(line.unit_cost).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-900">
                        KES {Math.round(line.received_qty * line.unit_cost).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="lg:hidden divide-y divide-gray-100">
            {lines.map((line, idx) => (
              <div key={line.po_line_id} className="p-4">
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-900">{line.item_name}</p>
                  <p className="text-xs text-gray-400">
                    {line.item_code} · Ordered: {line.ordered_qty} · Prev: {line.already_received}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Received</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.received_qty}
                      onChange={(e) => updateLine(idx, 'received_qty', parseFloat(e.target.value) || 0)}
                      className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Rejected</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.rejected_qty}
                      onChange={(e) => updateLine(idx, 'rejected_qty', parseFloat(e.target.value) || 0)}
                      className="w-full text-sm px-2 py-1.5 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Total</label>
                    <p className="text-sm font-medium text-gray-900 py-1.5">
                      KES {Math.round(line.received_qty * line.unit_cost).toLocaleString()}
                    </p>
                  </div>
                </div>
                {line.rejected_qty > 0 && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={line.rejection_reason}
                      onChange={(e) => updateLine(idx, 'rejection_reason', e.target.value)}
                      placeholder="Rejection reason..."
                      className="w-full text-xs px-2 py-1.5 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    />
                  </div>
                )}
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
            placeholder="Any notes about this delivery..."
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
          />
        </div>
      )}

      {/* Submit */}
      {lines.length > 0 && (
        <div className="sticky bottom-16 lg:bottom-0 bg-white border border-gray-200 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">{lines.filter(l => l.received_qty > 0).length} items received</p>
              <p className="text-lg font-bold text-gray-900">
                KES {Math.round(totalValue).toLocaleString()}
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
                  <PackageCheck size={18} />
                  Create GRN
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
