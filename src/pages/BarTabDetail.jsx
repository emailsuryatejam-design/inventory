import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from '../context/AppContext'
import { barTabs as api, pos as posApi } from '../services/api'
import {
  ArrowLeft, Plus, Trash2, X, CreditCard, Gift, Scissors,
  ArrowRightLeft, Percent, Search, Loader2, AlertTriangle, RefreshCw
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function BarTabDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useUser()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState(null)
  const [lines, setLines] = useState([])
  const [discounts, setDiscounts] = useState([])

  // Add items
  const [showAddItems, setShowAddItems] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [cart, setCart] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Modals
  const [showPayment, setShowPayment] = useState(false)
  const [showVoid, setShowVoid] = useState(null) // line id
  const [showDiscount, setShowDiscount] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showSplit, setShowSplit] = useState(false)
  const [showVoidTab, setShowVoidTab] = useState(false)

  // Form state
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentRef, setPaymentRef] = useState('')
  const [voidReason, setVoidReason] = useState('')
  const [discountType, setDiscountType] = useState('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [transferTable, setTransferTable] = useState('')
  const [splitLineIds, setSplitLineIds] = useState([])

  const [submitting, setSubmitting] = useState(false)

  const fetchTab = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.get(id)
      setTab(data.tab)
      setLines(data.lines || [])
      setDiscounts(data.discounts || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchTab() }, [fetchTab])

  // Item search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true)
        const data = await posApi.items({ search: searchQuery, limit: 20 })
        setSearchResults(data.items || [])
      } catch {} finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.item_id === item.id)
      if (existing) return prev.map(c => c.item_id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { item_id: item.id, item_name: item.name, qty: 1, unit_price: item.price }]
    })
  }

  const updateCartQty = (itemId, qty) => {
    if (qty <= 0) setCart(prev => prev.filter(c => c.item_id !== itemId))
    else setCart(prev => prev.map(c => c.item_id === itemId ? { ...c, qty } : c))
  }

  const handleAddItems = async () => {
    if (cart.length === 0) return
    try {
      setSubmitting(true)
      await api.addItems(tab.id, cart.map(c => ({ item_id: c.item_id, qty: c.qty, unit_price: c.unit_price })))
      setCart([])
      setShowAddItems(false)
      setSearchQuery('')
      fetchTab()
    } catch (e) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = async () => {
    try {
      setSubmitting(true)
      await api.close(tab.id, paymentMethod, paymentRef || null)
      setShowPayment(false)
      fetchTab()
    } catch (e) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVoidLine = async () => {
    if (!voidReason.trim()) { alert('Reason required'); return }
    try {
      setSubmitting(true)
      await api.voidLine(showVoid, voidReason)
      setShowVoid(null)
      setVoidReason('')
      fetchTab()
    } catch (e) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVoidTab = async () => {
    if (!voidReason.trim()) { alert('Reason required'); return }
    try {
      setSubmitting(true)
      await api.voidTab(tab.id, voidReason)
      setShowVoidTab(false)
      setVoidReason('')
      fetchTab()
    } catch (e) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDiscount = async () => {
    if (!discountReason.trim() || !discountValue) { alert('Fill all fields'); return }
    try {
      setSubmitting(true)
      await api.discount(tab.id, discountType, parseFloat(discountValue), discountReason)
      setShowDiscount(false)
      setDiscountValue('')
      setDiscountReason('')
      fetchTab()
    } catch (e) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleTransfer = async () => {
    try {
      setSubmitting(true)
      await api.transfer(tab.id, { table_number: transferTable || undefined })
      setShowTransfer(false)
      setTransferTable('')
      fetchTab()
    } catch (e) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSplit = async () => {
    if (splitLineIds.length === 0) { alert('Select lines to split'); return }
    try {
      setSubmitting(true)
      const result = await api.split(tab.id, splitLineIds)
      setShowSplit(false)
      setSplitLineIds([])
      navigate(`/app/bar-tab/${result.new_tab.id}`)
    } catch (e) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleComplimentary = async (lineId) => {
    const reason = prompt('Complimentary reason:')
    if (!reason) return
    try {
      await api.complimentary(lineId, reason)
      fetchTab()
    } catch (e) {
      alert(e.message)
    }
  }

  const formatMoney = (v) => (v ?? 0).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  if (loading && !tab) return <LoadingSpinner />
  if (error && !tab) return <div className="p-6 text-red-600">{error}</div>
  if (!tab) return null

  const isOpen = tab.status === 'open'
  const activeLines = lines.filter(l => !l.is_voided)
  const voidedLines = lines.filter(l => l.is_voided)

  // Group by round
  const rounds = {}
  activeLines.forEach(l => {
    const r = l.round_number || 1
    if (!rounds[r]) rounds[r] = []
    rounds[r].push(l)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/app/bar-tabs')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{tab.tab_number}</h1>
            <Badge variant={tab.status === 'open' ? 'success' : tab.status === 'voided' ? 'danger' : 'default'}>{tab.status}</Badge>
          </div>
          <p className="text-sm text-gray-500">
            {tab.table_number ? `Table ${tab.table_number}` : tab.room_number ? `Room ${tab.room_number}` : tab.guest_name || tab.tab_type}
            {' · '}Server: {tab.server}
            {' · '}Covers: {tab.covers}
            {tab.current_round > 1 ? ` · Round ${tab.current_round}` : ''}
          </p>
        </div>
        <button onClick={fetchTab} className="p-2 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Totals */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-sm text-gray-500">Subtotal</div>
            <div className="text-xl font-bold">{formatMoney(tab.subtotal)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Discount</div>
            <div className="text-xl font-bold text-red-500">{tab.discount_amount > 0 ? `-${formatMoney(tab.discount_amount)}` : '—'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-2xl font-bold text-blue-600">{formatMoney(tab.total)}</div>
          </div>
          {tab.payment_method && (
            <div>
              <div className="text-sm text-gray-500">Payment</div>
              <div className="text-lg font-medium capitalize">{tab.payment_method}</div>
            </div>
          )}
          {tab.closed_at && (
            <div>
              <div className="text-sm text-gray-500">Closed</div>
              <div className="text-sm">{new Date(tab.closed_at).toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {isOpen && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowAddItems(true)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Items
          </button>
          <button onClick={() => setShowPayment(true)} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
            <CreditCard className="w-4 h-4" /> Close & Pay
          </button>
          <button onClick={() => setShowDiscount(true)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <Percent className="w-4 h-4" /> Discount
          </button>
          <button onClick={() => setShowTransfer(true)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <ArrowRightLeft className="w-4 h-4" /> Transfer
          </button>
          <button onClick={() => setShowSplit(true)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <Scissors className="w-4 h-4" /> Split
          </button>
          <button onClick={() => setShowVoidTab(true)} className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50">
            <Trash2 className="w-4 h-4" /> Void Tab
          </button>
        </div>
      )}

      {/* Lines by Round */}
      {Object.entries(rounds).map(([round, roundLines]) => (
        <div key={round} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b text-sm font-medium text-gray-600">Round {round}</div>
          <div className="divide-y">
            {roundLines.map(line => (
              <div key={line.id} className={`px-4 py-3 flex items-center justify-between ${line.is_complimentary ? 'bg-purple-50' : ''}`}>
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {line.item_name}
                    {line.is_complimentary && <span className="ml-2 text-xs text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">COMP</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {line.quantity} x {formatMoney(line.unit_price)}
                    {line.notes && ` · ${line.notes}`}
                    {line.complimentary_reason && ` · Reason: ${line.complimentary_reason}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatMoney(line.line_total)}</span>
                  {isOpen && !line.is_complimentary && (
                    <div className="flex gap-1">
                      <button onClick={() => handleComplimentary(line.id)} title="Mark complimentary"
                        className="p-1 text-purple-400 hover:text-purple-600"><Gift className="w-4 h-4" /></button>
                      <button onClick={() => setShowVoid(line.id)} title="Void"
                        className="p-1 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Voided Lines */}
      {voidedLines.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-red-100 border-b text-sm font-medium text-red-700">Voided Items</div>
          <div className="divide-y divide-red-100">
            {voidedLines.map(line => (
              <div key={line.id} className="px-4 py-2 flex justify-between text-sm text-red-600 line-through opacity-60">
                <span>{line.item_name} x{line.quantity}</span>
                <span>{line.void_reason} — {line.voided_by}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discounts */}
      {discounts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <h3 className="text-sm font-medium text-orange-700 mb-2">Applied Discounts</h3>
          {discounts.map(d => (
            <div key={d.id} className="text-sm flex justify-between">
              <span>{d.discount_type === 'percentage' ? `${d.discount_value}%` : `Fixed ${formatMoney(d.discount_value)}`} — {d.reason}</span>
              <span className="font-medium">-{formatMoney(d.discount_amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Add Items */}
      {showAddItems && (
        <Modal onClose={() => { setShowAddItems(false); setCart([]); setSearchQuery('') }} title="Add Items" wide>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Search items..." autoFocus />
            </div>

            <div className="max-h-48 overflow-y-auto divide-y border rounded-lg">
              {searchLoading && <div className="p-3 text-center text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline" /></div>}
              {searchResults.map(item => (
                <div key={item.id} className="px-3 py-2 flex justify-between items-center hover:bg-gray-50 cursor-pointer" onClick={() => addToCart(item)}>
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.group_name} · {item.uom} · Stock: {item.stock_qty}</div>
                  </div>
                  <div className="text-sm font-medium">{formatMoney(item.price)}</div>
                </div>
              ))}
              {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                <div className="p-3 text-center text-gray-400 text-sm">No items found</div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border rounded-lg divide-y">
                <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500">Cart ({cart.length} items)</div>
                {cart.map(c => (
                  <div key={c.item_id} className="px-3 py-2 flex items-center justify-between">
                    <span className="text-sm">{c.item_name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateCartQty(c.item_id, c.qty - 1)} className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-sm">-</button>
                      <span className="w-8 text-center text-sm">{c.qty}</span>
                      <button onClick={() => updateCartQty(c.item_id, c.qty + 1)} className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-sm">+</button>
                      <span className="text-sm font-medium w-16 text-right">{formatMoney(c.qty * c.unit_price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowAddItems(false); setCart([]) }} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleAddItems} disabled={cart.length === 0 || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {submitting && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}
                Add {cart.length} Item{cart.length !== 1 ? 's' : ''} ({formatMoney(cart.reduce((s, c) => s + c.qty * c.unit_price, 0))})
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Payment */}
      {showPayment && (
        <Modal onClose={() => setShowPayment(false)} title="Close Tab & Pay">
          <div className="space-y-4">
            <div className="text-center text-3xl font-bold text-blue-600">{formatMoney(tab.total)}</div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {['cash', 'card', 'room_charge', 'mpesa', 'split', 'complimentary'].map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={`px-3 py-2 rounded-lg text-sm border capitalize transition ${paymentMethod === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    {m.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            {(paymentMethod === 'card' || paymentMethod === 'mpesa' || paymentMethod === 'room_charge') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={paymentMethod === 'room_charge' ? 'Room number' : 'Transaction reference'} />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPayment(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleClose} disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                {submitting && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}Close & Pay
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Void Line */}
      {showVoid && (
        <Modal onClose={() => { setShowVoid(null); setVoidReason('') }} title="Void Item">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason (required)</label>
              <input type="text" value={voidReason} onChange={e => setVoidReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Why is this item being voided?" autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowVoid(null); setVoidReason('') }} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleVoidLine} disabled={submitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {submitting && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}Void Item
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Void Tab */}
      {showVoidTab && (
        <Modal onClose={() => { setShowVoidTab(false); setVoidReason('') }} title="Void Entire Tab">
          <div className="space-y-4">
            <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
              This will void the entire tab ({formatMoney(tab.total)}). No stock will be deducted. Manager approval required.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason (required)</label>
              <input type="text" value={voidReason} onChange={e => setVoidReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Why is this tab being voided?" autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowVoidTab(false); setVoidReason('') }} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleVoidTab} disabled={submitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {submitting && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}Void Tab
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Discount */}
      {showDiscount && (
        <Modal onClose={() => setShowDiscount(false)} title="Apply Discount">
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setDiscountType('percentage')}
                className={`flex-1 py-2 rounded-lg text-sm border ${discountType === 'percentage' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                Percentage (%)
              </button>
              <button onClick={() => setDiscountType('fixed')}
                className={`flex-1 py-2 rounded-lg text-sm border ${discountType === 'fixed' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                Fixed Amount
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{discountType === 'percentage' ? 'Percentage' : 'Amount'}</label>
              <input type="number" step="0.01" min="0" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={discountType === 'percentage' ? 'e.g., 10' : 'e.g., 500'} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input type="text" value={discountReason} onChange={e => setDiscountReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Reason for discount" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDiscount(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleDiscount} disabled={submitting}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">
                {submitting && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}Apply Discount
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Transfer */}
      {showTransfer && (
        <Modal onClose={() => setShowTransfer(false)} title="Transfer Tab">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Table Number</label>
              <input type="text" value={transferTable} onChange={e => setTransferTable(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g., 12" autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowTransfer(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleTransfer} disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {submitting && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}Transfer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Split */}
      {showSplit && (
        <Modal onClose={() => { setShowSplit(false); setSplitLineIds([]) }} title="Split Tab">
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Select items to move to a new tab:</p>
            <div className="max-h-64 overflow-y-auto divide-y border rounded-lg">
              {activeLines.map(line => (
                <label key={line.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={splitLineIds.includes(line.id)}
                    onChange={e => {
                      if (e.target.checked) setSplitLineIds(prev => [...prev, line.id])
                      else setSplitLineIds(prev => prev.filter(id => id !== line.id))
                    }} />
                  <span className="flex-1 text-sm">{line.item_name} x{line.quantity}</span>
                  <span className="text-sm font-medium">{formatMoney(line.line_total)}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowSplit(false); setSplitLineIds([]) }} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleSplit} disabled={splitLineIds.length === 0 || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {submitting && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}Split {splitLineIds.length} Items
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ onClose, title, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-xl mx-4 p-6 max-h-[90vh] overflow-y-auto ${wide ? 'w-full max-w-lg' : 'w-full max-w-md'}`}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}
