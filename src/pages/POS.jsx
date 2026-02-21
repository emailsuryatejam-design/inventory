import { useState, useEffect, useRef, useMemo } from 'react'
import { useUser } from '../context/AppContext'
import { pos as posApi, items as itemsApi, users as usersApi } from '../services/api'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, X, CreditCard,
  Loader2, AlertTriangle, Coffee, UtensilsCrossed, BedDouble,
  Wine, Users, Wrench, ChevronLeft, Clock, ReceiptText,
  Sparkles, ChevronRight, Grid3X3, ChevronDown
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import PrintPortal from '../components/print/PrintPortal'
import ReceiptTemplate from '../components/print/ReceiptTemplate'
import PrintButton from '../components/print/PrintButton'
import { saveReceipt } from '../services/offlineDb'
import { usePrinterConfig } from '../hooks/useSettings'
import { generateReceiptCommands, sendToNetworkPrinter } from '../services/escpos'

const SERVICE_TYPES = [
  { value: 'bar', label: 'Bar', icon: Wine, color: 'bg-purple-500', costCenter: 'BAR' },
  { value: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed, color: 'bg-orange-500', costCenter: 'KITCHEN' },
  { value: 'kitchen', label: 'Kitchen', icon: Coffee, color: 'bg-amber-500', costCenter: 'KITCHEN' },
  { value: 'rooms', label: 'Rooms', icon: BedDouble, color: 'bg-blue-500', costCenter: 'ROOMS' },
  { value: 'guest', label: 'Guest', icon: Users, color: 'bg-green-500', costCenter: 'ROOMS' },
  { value: 'staff', label: 'Staff', icon: Users, color: 'bg-gray-500', costCenter: 'STAFF' },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'bg-red-500', costCenter: 'MAINT' },
]

// Groups that show for Bar service (alcohol + juices only)
const BAR_GROUP_CODES = ['BA', 'BJ']

const TABLE_OPTIONS = Array.from({ length: 20 }, (_, i) => String(i + 1))
const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50]
const ROOM_OPTIONS = ['101','102','103','104','105','106','107','108','201','202','203','204','205','206','207','208']

export default function POS() {
  const user = useUser()
  const [view, setView] = useState('service') // service | items | cart | receipt
  const [serviceType, setServiceType] = useState(null)
  const [categories, setCategories] = useState([])
  const [activeGroup, setActiveGroup] = useState(null) // null = All
  const [allItems, setAllItems] = useState([])
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastReceipt, setLastReceipt] = useState(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const searchTimerRef = useRef(null)

  // Optional details
  const [tableNumber, setTableNumber] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [roomNumbers, setRoomNumbers] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  // Staff & room picker
  const [staffList, setStaffList] = useState([])
  const [selectedRooms, setSelectedRooms] = useState([])
  const [showRoomPicker, setShowRoomPicker] = useState(false)

  // Today stats
  const [todayStats, setTodayStats] = useState(null)

  // Recent transactions
  const [recentTx, setRecentTx] = useState([])
  const [showRecent, setShowRecent] = useState(false)
  const [printing, setPrinting] = useState(false)
  const printerConfig = usePrinterConfig()

  // Handle print receipt
  function handlePrint() {
    if (printerConfig.type === 'thermal' && printerConfig.endpoint) {
      // Thermal printer: send ESC/POS commands
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
      // Browser print dialog
      setPrinting(true)
    }
  }

  // Load today stats on mount
  useEffect(() => {
    loadTodayStats()
  }, [])

  // Load staff list on mount
  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await usersApi.list()
        setStaffList((res.users || []).filter(u => u.is_active))
      } catch (err) {
        console.error('Failed to load staff:', err)
      }
    }
    loadStaff()
  }, [])

  async function loadTodayStats() {
    try {
      const data = await posApi.today()
      setTodayStats(data.today)
    } catch (err) {
      console.error('Failed to load today stats:', err)
    }
  }

  // Load categories + all items for the selected service
  async function loadItemsForService(svc) {
    setLoading(true)
    try {
      const [catData, itemData] = await Promise.all([
        posApi.categories(),
        posApi.items({ limit: 100 }),
      ])

      let cats = catData.categories || []
      let items = itemData.items || []

      // For "bar" service, filter to only Bar + Juice groups
      if (svc.value === 'bar') {
        cats = cats.filter(c => BAR_GROUP_CODES.includes(c.code))
        items = items.filter(i => BAR_GROUP_CODES.includes(i.group_code))
      }

      setCategories(cats)
      setAllItems(items)
      setActiveGroup(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Load recent transactions
  async function loadRecent() {
    try {
      const data = await posApi.recent({ limit: 15 })
      setRecentTx(data.transactions || [])
      setShowRecent(true)
    } catch (err) {
      setError(err.message)
    }
  }

  // Select service type — go directly to items view with group tabs
  function selectService(svc) {
    setServiceType(svc)
    setView('items')
    setSearchQuery('')
    loadItemsForService(svc)
  }

  // Visible groups (for tabs)
  const visibleGroups = categories

  // Filtered items based on active group + search
  const filteredItems = useMemo(() => {
    let items = allItems

    // Filter by active group tab
    if (activeGroup) {
      items = items.filter(i => i.group_code === activeGroup)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.item_code?.toLowerCase().includes(q) ||
        i.group_name?.toLowerCase().includes(q)
      )
    }

    return items
  }, [allItems, activeGroup, searchQuery])

  // Add to cart
  function addToCart(item) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, { ...item, qty: 1 }]
    })
  }

  // Update cart qty
  function updateCartQty(itemId, newQty) {
    if (newQty <= 0) {
      setCart(prev => prev.filter(c => c.id !== itemId))
    } else {
      setCart(prev => prev.map(c => c.id === itemId ? { ...c, qty: newQty } : c))
    }
  }

  // Remove from cart
  function removeFromCart(itemId) {
    setCart(prev => prev.filter(c => c.id !== itemId))
  }

  // Toggle room selection
  function toggleRoom(room) {
    setSelectedRooms(prev => {
      const next = prev.includes(room) ? prev.filter(r => r !== room) : [...prev, room]
      setRoomNumbers(next.join(', '))
      return next
    })
  }

  // Cart total
  const cartTotal = cart.reduce((sum, c) => sum + c.qty * c.price, 0)
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0)

  // Submit POS transaction
  async function handleCheckout() {
    if (cart.length === 0) return

    setSubmitting(true)
    setError('')

    try {
      const svc = SERVICE_TYPES.find(s => s.value === serviceType?.value)
      const result = await posApi.create({
        service_type: serviceType.value,
        cost_center: svc?.costCenter || 'BAR',
        received_by: receivedBy.trim() || 'Walk-in',
        table_number: tableNumber || null,
        guest_count: guestCount ? parseInt(guestCount) : null,
        room_numbers: roomNumbers || null,
        notes: notes || null,
        items: cart.map(c => ({
          id: c.id,
          qty: c.qty,
          notes: null,
        })),
      })

      const receiptData = {
        ...result.transaction,
        items: [...cart],
        service: serviceType,
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
        service_type: serviceType?.value,
        camp_name: user?.camp_name,
        created_by: user?.name,
        created_at: Date.now(),
      }).catch(() => {})
      setTableNumber('')
      setGuestCount('')
      setRoomNumbers('')
      setReceivedBy('')
      setNotes('')
      setSelectedRooms([])
      setShowRoomPicker(false)
      setShowDetails(false)
      loadTodayStats()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // New transaction
  function newTransaction() {
    setView('service')
    setServiceType(null)
    setActiveGroup(null)
    setAllItems([])
    setCategories([])
    setCart([])
    setSearchQuery('')
    setLastReceipt(null)
    setError('')
    setShowRecent(false)
  }

  // Back navigation
  function goBack() {
    if (view === 'cart') setView('items')
    else if (view === 'items') { setView('service'); setServiceType(null); setAllItems([]); setCategories([]) }
  }

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════

  // ── Receipt View ──
  if (view === 'receipt' && lastReceipt) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Success Header */}
          <div className="bg-green-600 text-white text-center py-6 px-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <ReceiptText size={32} />
            </div>
            <h2 className="text-lg font-bold">Transaction Complete</h2>
            <p className="text-green-100 text-sm mt-1">{lastReceipt.voucher_number}</p>
          </div>

          {/* Receipt Details */}
          <div className="p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Service</span>
              <span className="font-medium">{lastReceipt.service?.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Time</span>
              <span className="font-medium">{lastReceipt.time}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Items</span>
              <span className="font-medium">{lastReceipt.items_count}</span>
            </div>

            <div className="border-t border-dashed border-gray-200 pt-3 mt-3">
              {lastReceipt.items.map(item => (
                <div key={item.id} className="flex justify-between text-sm py-1">
                  <span className="text-gray-700">{item.qty}x {item.name}</span>
                  <span className="text-gray-600">TZS {Math.round(item.qty * item.price).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-3 flex justify-between">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-bold text-gray-900 text-lg">
                TZS {Math.round(lastReceipt.total_value).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-100 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={newTransaction}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-green-700 transition"
              >
                New Transaction
              </button>
              <PrintButton onClick={handlePrint} variant="icon" />
            </div>
            <button
              onClick={() => { setView('service'); setServiceType(null) }}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition"
            >
              Back to POS Home
            </button>
          </div>
        </div>

        {/* Print Portal — hidden on screen, shown in print */}
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

  // ── Recent Transactions ──
  if (showRecent) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setShowRecent(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Recent Transactions</h1>
        </div>

        <div className="space-y-2">
          {recentTx.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              No recent transactions
            </div>
          ) : (
            recentTx.map(tx => (
              <div key={tx.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-xs text-gray-400">{tx.voucher_number}</p>
                    <p className="font-medium text-gray-900 text-sm mt-0.5">
                      {tx.cost_center || tx.issue_type} — {tx.received_by}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">TZS {Math.round(tx.total_value).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{tx.line_count} items</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <Clock size={12} />
                  <span>{new Date(tx.created_at).toLocaleString()}</span>
                  {tx.notes && <span className="text-gray-300">· {tx.notes}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}

      {/* ══════ SERVICE TYPE SELECTION ══════ */}
      {view === 'service' && (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">POS Terminal</h1>
              <p className="text-sm text-gray-500">{user?.camp_name || 'Your Camp'}</p>
            </div>
            <button
              onClick={loadRecent}
              data-guide="pos-history-btn"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-2 rounded-lg transition"
            >
              <Clock size={16} /> History
            </button>
          </div>

          {/* Today Stats */}
          {todayStats && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{todayStats.transactions}</p>
                <p className="text-xs text-gray-500">Today's Sales</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                <p className="text-lg font-bold text-green-600">
                  {todayStats.value > 0 ? `TZS ${Math.round(todayStats.value).toLocaleString()}` : '-'}
                </p>
                <p className="text-xs text-gray-500">Today's Value</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{todayStats.guests || 0}</p>
                <p className="text-xs text-gray-500">Guests Served</p>
              </div>
            </div>
          )}

          {/* Service Types */}
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Select Service Type</h2>
          <div data-guide="pos-service-types" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SERVICE_TYPES.map(svc => (
              <button
                key={svc.value}
                onClick={() => selectService(svc)}
                className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-green-300 hover:shadow-md transition group"
              >
                <div className={`w-12 h-12 ${svc.color} rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition`}>
                  <svc.icon size={24} className="text-white" />
                </div>
                <p className="font-medium text-gray-900 text-sm">{svc.label}</p>
              </button>
            ))}
          </div>

          {/* Quick Cart (if items in cart from previous) */}
          {cart.length > 0 && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={20} className="text-green-600" />
                  <span className="font-medium text-green-800">{cartCount} items in cart</span>
                </div>
                <span className="font-bold text-green-800">TZS {Math.round(cartTotal).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════ ITEMS VIEW WITH GROUP TABS ══════ */}
      {view === 'items' && (
        <div>
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">{serviceType?.label}</h1>
              <p className="text-xs text-gray-500">
                {filteredItems.length} items · Tap to add
              </p>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setView('cart')}
                className="relative p-2 bg-green-100 rounded-lg transition hover:bg-green-200"
              >
                <ShoppingCart size={20} className="text-green-700" />
                <span className="absolute -top-1 -right-1 bg-green-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* ── Group Tabs ── */}
          {visibleGroups.length > 1 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scroll-touch">
              <button
                onClick={() => setActiveGroup(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  !activeGroup ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All ({allItems.length})
              </button>
              {visibleGroups.map(grp => {
                const count = allItems.filter(i => i.group_code === grp.code).length
                return (
                  <button
                    key={grp.id}
                    onClick={() => setActiveGroup(grp.code)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                      activeGroup === grp.code
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {grp.name} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {loading ? (
            <LoadingSpinner message="Loading items..." />
          ) : filteredItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Grid3X3 size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">
                {searchQuery ? 'No items match your search' : 'No items available'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-sm text-green-600 font-medium"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredItems.map(item => {
                const inCart = cart.find(c => c.id === item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className={`bg-white rounded-xl border p-3 text-left transition relative ${
                      inCart
                        ? 'border-green-400 shadow-sm'
                        : item.stock_qty <= 0
                        ? 'border-red-200 opacity-60'
                        : 'border-gray-200 hover:border-green-300 hover:shadow-sm'
                    }`}
                    disabled={item.stock_qty <= 0}
                  >
                    {inCart && (
                      <span className="absolute -top-1.5 -right-1.5 bg-green-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                        {inCart.qty}
                      </span>
                    )}
                    <p className="text-sm font-medium text-gray-900 truncate leading-tight">{item.name}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className="text-[10px] font-mono text-gray-400">{item.group_code}</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-[10px] text-gray-400">{item.uom}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      {item.price > 0 ? (
                        <span className="text-xs font-semibold text-gray-700">
                          TZS {Math.round(item.price).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No price</span>
                      )}
                      {item.stock_qty > 0 ? (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          item.stock_status === 'low' || item.stock_status === 'critical'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {item.stock_qty}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Out</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Floating Cart Bar */}
          {cart.length > 0 && (
            <div className="sticky bottom-16 lg:bottom-0 mt-4">
              <button
                onClick={() => setView('cart')}
                className="w-full bg-green-600 text-white py-3.5 rounded-xl flex items-center justify-center gap-3 font-semibold text-sm shadow-lg hover:bg-green-700 transition"
              >
                <ShoppingCart size={20} />
                <span>View Cart ({cartCount})</span>
                <span className="bg-white/20 px-3 py-0.5 rounded-full">
                  TZS {Math.round(cartTotal).toLocaleString()}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════ CART / CHECKOUT ══════ */}
      {view === 'cart' && (
        <div>
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">Cart</h1>
              <p className="text-xs text-gray-500">
                {serviceType?.label} · {cartCount} items
              </p>
            </div>
            <button
              onClick={() => { setCart([]); goBack() }}
              className="text-xs text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg"
            >
              Clear All
            </button>
          </div>

          {cart.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">Cart is empty</p>
              <button
                onClick={goBack}
                className="mt-3 text-sm text-green-600 font-medium hover:text-green-700"
              >
                Browse items
              </button>
            </div>
          ) : (
            <>
              {/* Cart Items */}
              <div className="bg-white rounded-xl border border-gray-200 mb-4">
                <div className="divide-y divide-gray-100">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{item.uom}</span>
                          {item.price > 0 && (
                            <span className="text-xs text-gray-500">
                              TZS {Math.round(item.qty * item.price).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Qty Controls */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => updateCartQty(item.id, item.qty - 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 h-8 flex items-center justify-center text-sm font-bold">
                          {item.qty}
                        </span>
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

              {/* Optional Details */}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full bg-white rounded-xl border border-gray-200 p-3 mb-4 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                <span>Add details (table, guest, notes)</span>
                <ChevronRight size={16} className={`transition ${showDetails ? 'rotate-90' : ''}`} />
              </button>

              {showDetails && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Table # dropdown */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Table #</label>
                      <div className="relative">
                        <select
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          className="w-full appearance-none bg-white px-3 py-2 pr-8 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        >
                          <option value="">Select table</option>
                          {TABLE_OPTIONS.map(t => (
                            <option key={t} value={t}>Table {t}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Guest Count dropdown */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Guest Count</label>
                      <div className="relative">
                        <select
                          value={guestCount}
                          onChange={(e) => setGuestCount(e.target.value)}
                          className="w-full appearance-none bg-white px-3 py-2 pr-8 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        >
                          <option value="">Select</option>
                          {GUEST_OPTIONS.map(g => (
                            <option key={g} value={g}>{g} {g === 1 ? 'guest' : 'guests'}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Received By dropdown (staff list) */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Received By</label>
                      <div className="relative">
                        <select
                          value={receivedBy}
                          onChange={(e) => setReceivedBy(e.target.value)}
                          className="w-full appearance-none bg-white px-3 py-2 pr-8 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        >
                          <option value="">Select staff</option>
                          {staffList.map(s => (
                            <option key={s.id} value={s.full_name || s.username}>
                              {s.full_name || s.username}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Room #s picker */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Room #s</label>
                      <button
                        type="button"
                        onClick={() => setShowRoomPicker(!showRoomPicker)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition text-left"
                      >
                        <span className={selectedRooms.length > 0 ? 'text-gray-900 truncate' : 'text-gray-400'}>
                          {selectedRooms.length > 0 ? selectedRooms.join(', ') : 'Select rooms'}
                        </span>
                        <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition ${showRoomPicker ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Room picker grid */}
                  {showRoomPicker && (
                    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <p className="text-xs text-gray-500 mb-2 font-medium">Tap rooms to select</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {ROOM_OPTIONS.map(room => (
                          <button
                            key={room}
                            type="button"
                            onClick={() => toggleRoom(room)}
                            className={`px-2 py-1.5 text-xs font-medium rounded-lg transition ${
                              selectedRooms.includes(room)
                                ? 'bg-green-600 text-white shadow-sm'
                                : 'bg-white text-gray-700 border border-gray-200 hover:border-green-300'
                            }`}
                          >
                            {room}
                          </button>
                        ))}
                      </div>
                      {selectedRooms.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setSelectedRooms([]); setRoomNumbers('') }}
                          className="mt-2 text-xs text-red-500 hover:text-red-700"
                        >
                          Clear rooms
                        </button>
                      )}
                    </div>
                  )}

                  {/* Notes (kept as text input) */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Notes</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Special requests..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Checkout Bar */}
              <div className="sticky bottom-16 lg:bottom-0 bg-white border border-gray-200 rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-gray-500">{cartCount} items</p>
                    <p className="text-xl font-bold text-gray-900">
                      TZS {Math.round(cartTotal).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={submitting}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition shadow-md"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard size={18} />
                        Checkout
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
