import { useState, useEffect } from 'react'
import { useUser } from '../context/AppContext'
import { menu as menuApi, users as usersApi } from '../services/api'
import {
  Wine, GlassWater, Sparkles, Plus, Minus, Trash2, ShoppingCart,
  Loader2, AlertTriangle, X, ChevronDown, ChevronUp, CreditCard,
  ReceiptText, Clock, TrendingDown, AlertCircle, CheckCircle2, Beaker
} from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import RecipeSheet from '../components/bar/RecipeSheet'
import PrintPortal from '../components/print/PrintPortal'
import ReceiptTemplate from '../components/print/ReceiptTemplate'
import PrintButton from '../components/print/PrintButton'
import { saveReceipt } from '../services/offlineDb'
import { usePrinterConfig } from '../hooks/useSettings'
import { generateReceiptCommands, sendToNetworkPrinter } from '../services/escpos'

const STATUS_STYLES = {
  available: { bg: 'bg-green-100', text: 'text-green-700', label: 'In Stock' },
  low: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Low Stock' },
  critical: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Critical' },
  out: { bg: 'bg-red-100', text: 'text-red-700', label: 'Out of Stock' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Unknown' },
}

const STATUS_ICONS = {
  available: CheckCircle2,
  low: TrendingDown,
  critical: AlertCircle,
  out: X,
  unknown: AlertCircle,
}

const TABLE_OPTIONS = Array.from({ length: 20 }, (_, i) => String(i + 1))
const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50]

export default function BarMenu() {
  const user = useUser()
  const [view, setView] = useState('menu') // menu | cart | receipt | alerts
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cart, setCart] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [lastReceipt, setLastReceipt] = useState(null)
  const [printing, setPrinting] = useState(false)
  const printerConfig = usePrinterConfig()

  // Handle print receipt
  function handlePrint() {
    if (printerConfig.type === 'thermal' && printerConfig.endpoint) {
      const commands = generateReceiptCommands(lastReceipt, {
        campName: user?.camp_name,
        headerText: printerConfig.headerText,
        footerText: printerConfig.footerText,
        printerWidth: printerConfig.width === 58 ? 32 : 48,
      })
      sendToNetworkPrinter(commands, printerConfig.endpoint)
        .then(() => window.__ws_toast?.success('Receipt sent to printer'))
        .catch(() => window.__ws_toast?.error('Printer error. Check connection.'))
    } else {
      setPrinting(true)
    }
  }

  // Filters
  const [activeCategory, setActiveCategory] = useState(null)
  const [filterType, setFilterType] = useState('') // '', cocktail, mocktail

  // Optional order details
  const [tableNumber, setTableNumber] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [staffList, setStaffList] = useState([])

  // Recipe sheet for cocktails/mocktails
  const [recipeItem, setRecipeItem] = useState(null)

  // Depletion alerts
  const [depletionAlerts, setDepletionAlerts] = useState([])
  const [stockSummary, setStockSummary] = useState(null)
  const [alertsLoading, setAlertsLoading] = useState(false)

  // Load data on mount
  useEffect(() => {
    loadMenu()
  }, [])

  async function loadMenu() {
    setLoading(true)
    try {
      const [catData, itemData, staffData] = await Promise.all([
        menuApi.categories(),
        menuApi.items({}),
        usersApi.list(),
      ])
      setCategories(catData.categories || [])
      setMenuItems(itemData.menu_items || [])
      setStaffList((staffData.users || []).filter(u => u.is_active))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadAlerts() {
    setAlertsLoading(true)
    try {
      const [depData, statusData] = await Promise.all([
        menuApi.depletion({ days: 7 }),
        menuApi.stockStatus(),
      ])
      setDepletionAlerts(depData.alerts || [])
      setStockSummary(statusData.summary || null)
    } catch (err) {
      setError(err.message)
    } finally {
      setAlertsLoading(false)
      setView('alerts')
    }
  }

  // Filter items
  const filteredItems = menuItems.filter(item => {
    if (activeCategory && item.category_code !== activeCategory) return false
    if (filterType === 'cocktail' && !item.is_cocktail) return false
    if (filterType === 'mocktail' && !item.is_mocktail) return false
    return true
  })

  // Group items by category
  const groupedItems = {}
  filteredItems.forEach(item => {
    const key = item.category_name
    if (!groupedItems[key]) groupedItems[key] = { name: item.category_name, code: item.category_code, pricing: item.pricing_type, items: [] }
    groupedItems[key].items.push(item)
  })

  // Cart functions
  function handleItemTap(item) {
    if (item.stock?.status === 'out') return
    // For cocktails/mocktails, show recipe sheet first
    if (item.is_cocktail || item.is_mocktail) {
      setRecipeItem(item)
      return
    }
    // For regular drinks (spirits, beer, etc.), add directly
    addToCart(item)
  }

  function addToCart(item) {
    if (item.stock?.status === 'out') return
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { ...item, qty: 1 }]
    })
  }

  // Called from RecipeSheet when user confirms "Add to Order"
  function handleRecipeAdd(item, _modifications) {
    addToCart(item)
  }

  function updateCartQty(itemId, newQty) {
    if (newQty <= 0) {
      setCart(prev => prev.filter(c => c.id !== itemId))
    } else {
      setCart(prev => prev.map(c => c.id === itemId ? { ...c, qty: newQty } : c))
    }
  }

  function removeFromCart(itemId) {
    setCart(prev => prev.filter(c => c.id !== itemId))
  }

  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0)

  // Submit order
  async function handleCheckout() {
    if (cart.length === 0) return
    setSubmitting(true)
    setError('')

    try {
      const result = await menuApi.order({
        received_by: receivedBy.trim() || 'Bar Guest',
        table_number: tableNumber || null,
        guest_count: guestCount ? parseInt(guestCount) : null,
        notes: notes || null,
        items: cart.map(c => ({
          menu_item_id: c.id,
          qty: c.qty,
        })),
      })

      const receiptData = {
        ...result.order,
        cartItems: [...cart],
        items: [...cart], // normalized for ReceiptTemplate
        time: new Date().toLocaleTimeString(),
      }
      setLastReceipt(receiptData)
      setView('receipt')
      setCart([])
      // Save receipt to IndexedDB for offline reprint
      saveReceipt({
        voucher_number: receiptData.voucher_number,
        total_value: receiptData.total_value,
        items: [...cart],
        service_type: 'bar',
        camp_name: user?.camp_name,
        created_by: user?.name,
        created_at: Date.now(),
      }).catch(() => {})
      setTableNumber('')
      setGuestCount('')
      setReceivedBy('')
      setNotes('')
      setShowDetails(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ═════════ RECEIPT VIEW ═════════
  if (view === 'receipt' && lastReceipt) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-amber-700 text-white text-center py-6 px-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <ReceiptText size={32} />
            </div>
            <h2 className="text-lg font-bold">Bar Order Complete</h2>
            <p className="text-amber-200 text-sm mt-1">{lastReceipt.voucher_number}</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Time</span>
              <span className="font-medium">{lastReceipt.time}</span>
            </div>
            <div className="border-t border-dashed border-gray-200 pt-3">
              {lastReceipt.cartItems.map(item => (
                <div key={item.id} className="flex justify-between text-sm py-1">
                  <span className="text-gray-700">{item.qty}x {item.name}</span>
                  {item.price_usd && (
                    <span className="text-gray-600">${(item.qty * item.price_usd).toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
            {lastReceipt.total_value > 0 && (
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="font-bold text-gray-900">Cost Value</span>
                <span className="font-bold text-gray-900">
                  TZS {Math.round(lastReceipt.total_value).toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-gray-100 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => { setView('menu'); setLastReceipt(null) }}
                className="flex-1 bg-amber-700 text-white py-3 rounded-xl font-semibold text-sm hover:bg-amber-800 transition"
              >
                New Order
              </button>
              <PrintButton onClick={handlePrint} variant="icon" />
            </div>
          </div>
        </div>

        {/* Print Portal */}
        <PrintPortal
          pageType="receipt"
          trigger={printing}
          onDone={() => setPrinting(false)}
        >
          <ReceiptTemplate
            receipt={lastReceipt}
            campName={user?.camp_name}
            headerText={printerConfig.headerText}
            footerText={printerConfig.footerText}
          />
        </PrintPortal>
      </div>
    )
  }

  // ═════════ ALERTS VIEW ═════════
  if (view === 'alerts') {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Menu Stock Alerts</h1>
            <p className="text-sm text-gray-500">Depletion warnings for bar menu items</p>
          </div>
          <button
            onClick={() => setView('menu')}
            className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg hover:bg-amber-100"
          >
            Back to Menu
          </button>
        </div>

        {/* Summary Cards */}
        {stockSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {Object.entries(stockSummary).map(([key, val]) => {
              const s = STATUS_STYLES[key] || STATUS_STYLES.unknown
              return (
                <div key={key} className={`rounded-xl border p-3 text-center ${s.bg}`}>
                  <p className={`text-2xl font-bold ${s.text}`}>{val}</p>
                  <p className="text-xs text-gray-600 capitalize">{key}</p>
                </div>
              )
            })}
          </div>
        )}

        {alertsLoading ? (
          <LoadingSpinner message="Checking stock levels..." />
        ) : depletionAlerts.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <CheckCircle2 size={40} className="mx-auto text-green-500 mb-2" />
            <p className="font-medium text-green-800">All menu items are well-stocked</p>
          </div>
        ) : (
          <div className="space-y-2">
            {depletionAlerts.map(alert => {
              const s = STATUS_STYLES[alert.status] || STATUS_STYLES.unknown
              const Icon = STATUS_ICONS[alert.status] || AlertCircle
              return (
                <div key={alert.id} className={`rounded-xl border p-4 ${s.bg} border-opacity-50`}>
                  <div className="flex items-center gap-3">
                    <Icon size={20} className={s.text} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{alert.name}</p>
                      <p className="text-xs text-gray-600">{alert.category}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.bg} ${s.text}`}>
                        {s.label}
                      </span>
                      {alert.stock?.servings_possible != null && (
                        <p className="text-xs text-gray-500 mt-1">
                          ~{alert.stock.servings_possible} servings left
                        </p>
                      )}
                    </div>
                  </div>
                  {alert.stock?.limiting_ingredient && (
                    <p className="text-xs text-gray-500 mt-2">
                      Limited by: {alert.stock.limiting_ingredient}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ═════════ CART VIEW ═════════
  if (view === 'cart') {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Bar Order</h1>
            <p className="text-xs text-gray-500">{cartCount} drinks</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView('menu')}
              className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg"
            >
              Add More
            </button>
            {cart.length > 0 && (
              <button
                onClick={() => { setCart([]); setView('menu') }}
                className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            <AlertTriangle size={16} /><span className="flex-1">{error}</span>
            <button onClick={() => setError('')}><X size={16} /></button>
          </div>
        )}

        {cart.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Wine size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No drinks in order</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 mb-4">
              <div className="divide-y divide-gray-100">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.category_name}</p>
                      {item.price_usd && (
                        <p className="text-xs text-amber-700 font-medium">${item.price_usd} each</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => updateCartQty(item.id, item.qty - 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 h-8 flex items-center justify-center text-sm font-bold">{item.qty}</span>
                      <button
                        onClick={() => updateCartQty(item.id, item.qty + 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Details */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full bg-white rounded-xl border border-gray-200 p-3 mb-4 flex items-center justify-between text-sm text-gray-600"
            >
              <span>Order details (table, guest, notes)</span>
              {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showDetails && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Table #</label>
                  <div className="relative">
                    <select value={tableNumber} onChange={e => setTableNumber(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 appearance-none bg-white">
                      <option value="">— Select —</option>
                      {TABLE_OPTIONS.map(t => <option key={t} value={t}>Table {t}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Guests</label>
                  <div className="relative">
                    <select value={guestCount} onChange={e => setGuestCount(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 appearance-none bg-white">
                      <option value="">— Select —</option>
                      {GUEST_OPTIONS.map(n => <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Served By</label>
                  <div className="relative">
                    <select value={receivedBy} onChange={e => setReceivedBy(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 appearance-none bg-white">
                      <option value="">— Select —</option>
                      {staffList.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notes</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Special requests..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>
            )}

            {/* Checkout */}
            <div className="sticky bottom-16 lg:bottom-0 bg-white border border-gray-200 rounded-xl p-4 shadow-lg">
              <button
                onClick={handleCheckout}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white py-3.5 rounded-xl font-bold text-sm transition"
              >
                {submitting ? (
                  <><Loader2 size={18} className="animate-spin" /> Placing Order...</>
                ) : (
                  <><CreditCard size={18} /> Place Bar Order ({cartCount} drinks)</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ═════════ MAIN MENU VIEW ═════════
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wine size={24} className="text-amber-700" />
            Drinks Menu
          </h1>
          <p className="text-sm text-gray-500">{user?.camp_name || 'WebSquare'}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadAlerts}
            data-guide="bar-stock-alerts-btn"
            className="flex items-center gap-1.5 text-sm text-orange-700 bg-orange-50 border border-orange-200 px-3 py-2 rounded-lg hover:bg-orange-100 transition"
          >
            <TrendingDown size={16} /> Stock Alerts
          </button>
          {cart.length > 0 && (
            <button
              onClick={() => setView('cart')}
              className="relative flex items-center gap-1.5 text-sm text-white bg-amber-700 px-3 py-2 rounded-lg hover:bg-amber-800 transition"
            >
              <ShoppingCart size={16} />
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
          <AlertTriangle size={16} /><span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}

      {/* Filter tabs */}
      <div data-guide="bar-menu-categories" className="flex gap-2 mb-3 overflow-x-auto pb-1">
        <button
          onClick={() => { setActiveCategory(null); setFilterType('') }}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
            !activeCategory && !filterType ? 'bg-amber-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => { setActiveCategory(null); setFilterType('cocktail') }}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1 ${
            filterType === 'cocktail' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Wine size={12} /> Cocktails
        </button>
        <button
          onClick={() => { setActiveCategory(null); setFilterType('mocktail') }}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1 ${
            filterType === 'mocktail' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <GlassWater size={12} /> Mocktails
        </button>
        {categories.filter(c => !['COCKTAIL', 'MOCKTAIL'].includes(c.code)).map(cat => (
          <button
            key={cat.code}
            onClick={() => { setActiveCategory(cat.code); setFilterType('') }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
              activeCategory === cat.code ? 'bg-amber-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading menu..." />
      ) : (
        <div className="space-y-6">
          {Object.values(groupedItems).map(group => (
            <div key={group.code}>
              {/* Category Header */}
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-bold text-amber-800 uppercase tracking-wider">{group.name}</h2>
                {group.pricing === 'exclusive' && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Exclusive</span>
                )}
                <div className="flex-1 h-px bg-amber-200" />
              </div>

              {/* Items */}
              <div className="space-y-1">
                {group.items.map(item => {
                  const inCart = cart.find(c => c.id === item.id)
                  const stockStatus = item.stock?.status || 'unknown'
                  const s = STATUS_STYLES[stockStatus]
                  const isOut = stockStatus === 'out'

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-xl border p-3 flex items-center gap-3 transition ${
                        inCart ? 'border-amber-400 shadow-sm' : isOut ? 'border-red-200 opacity-60' : 'border-gray-200 hover:border-amber-200'
                      }`}
                    >
                      {/* Drink Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                          {item.is_cocktail && <Wine size={12} className="text-purple-500 flex-shrink-0" />}
                          {item.is_mocktail && <GlassWater size={12} className="text-green-500 flex-shrink-0" />}
                        </div>
                        {item.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {item.price_usd && (
                            <span className="text-xs font-bold text-amber-800">${item.price_usd}</span>
                          )}
                          {/* Stock indicator */}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                            {item.stock?.servings_possible != null ? `${item.stock.servings_possible} servings` : s.label}
                          </span>
                          {item.stock?.days_remaining != null && (
                            <span className="text-[10px] text-gray-400">{item.stock.days_remaining}d left</span>
                          )}
                        </div>
                      </div>

                      {/* Add/Qty Controls */}
                      {inCart ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => updateCartQty(item.id, inCart.qty - 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-7 text-center text-sm font-bold text-amber-800">{inCart.qty}</span>
                          <button
                            onClick={() => updateCartQty(item.id, inCart.qty + 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Recipe button for cocktails/mocktails */}
                          {(item.is_cocktail || item.is_mocktail) && (
                            <button
                              onClick={() => setRecipeItem(item)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-50 text-purple-500 hover:bg-purple-100 transition"
                              title="View Recipe"
                            >
                              <Beaker size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleItemTap(item)}
                            disabled={isOut}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition ${
                              isOut
                                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Cart Bar */}
      {cart.length > 0 && view === 'menu' && (
        <div className="sticky bottom-16 lg:bottom-0 mt-4">
          <button
            onClick={() => setView('cart')}
            className="w-full bg-amber-700 text-white py-3.5 rounded-xl flex items-center justify-center gap-3 font-semibold text-sm shadow-lg hover:bg-amber-800 transition"
          >
            <ShoppingCart size={20} />
            <span>View Order ({cartCount} drinks)</span>
          </button>
        </div>
      )}

      {/* Recipe Sheet for cocktails/mocktails */}
      {recipeItem && (
        <RecipeSheet
          item={recipeItem}
          onClose={() => setRecipeItem(null)}
          onAddToCart={handleRecipeAdd}
        />
      )}
    </div>
  )
}
