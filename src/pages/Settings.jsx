import { useState, useEffect, useCallback } from 'react'
import { useUser, useApp, useSelectedCamp, isManager } from '../context/AppContext'
import { rawRequest, settings as settingsApi } from '../services/api'
import { useSettings, invalidateSettingsCache } from '../hooks/useSettings'
import { getQueueCount, clearAllCache, getCacheStats, clearQueue } from '../services/offlineDb'
import {
  User, Building2, Shield, LogOut, ChevronDown, Blocks, Loader2, Lock,
  Printer, Receipt, Database, Wifi, WifiOff, Save, TestTube2, Trash2, RefreshCw
} from 'lucide-react'
import { useToast } from '../components/ui/Toast'

export default function Settings() {
  const user = useUser()
  const { dispatch } = useApp()
  const { campId, camps } = useSelectedCamp()
  const manager = isManager(user?.role)
  const isAdmin = ['admin', 'director'].includes(user?.role)
  const toast = useToast()

  function handleLogout() {
    localStorage.removeItem('ws_token')
    localStorage.removeItem('ws_state')
    window.location.hash = '#/login'
    window.location.reload()
  }

  function handleCampChange(e) {
    const newCampId = parseInt(e.target.value) || null
    dispatch({ type: 'SELECT_CAMP', payload: newCampId })
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-700 font-bold text-xl">
              {user?.name?.charAt(0) || '?'}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{user?.name}</h2>
            <p className="text-sm text-gray-500">@{user?.username}</p>
          </div>
        </div>

        <div className="space-y-3">
          <InfoRow icon={User} label="Role" value={user?.role?.replace(/_/g, ' ')} />
          <InfoRow icon={Building2} label="Camp" value={user?.camp_name || 'Head Office'} />
          <InfoRow icon={Shield} label="Approval Limit" value={
            user?.approval_limit
              ? `TZS ${Math.round(user.approval_limit).toLocaleString()}`
              : 'None'
          } />
        </div>
      </div>

      {/* Camp Selector (Managers only) */}
      {manager && camps.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">View Camp</h3>
          <p className="text-sm text-gray-500 mb-3">
            As a manager, you can switch between camps to view their stock, orders, and issues.
          </p>
          <div className="relative">
            <select
              value={campId || ''}
              onChange={handleCampChange}
              className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none bg-white"
            >
              <option value="">All Camps (Head Office View)</option>
              {camps.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Module Management (Admin/Director only) */}
      {isAdmin && <ModuleManager camps={camps} toast={toast} />}

      {/* ═══════ Admin-Only Configuration Sections ═══════ */}
      {isAdmin && (
        <>
          <PrinterConfig toast={toast} />
          <ReceiptConfig toast={toast} />
          <TallyConfig toast={toast} />
        </>
      )}

      {/* Offline & Sync (visible to managers too) */}
      {manager && <OfflineSyncConfig toast={toast} />}

      {/* App Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">About</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Application</span>
            <span className="text-gray-900 font-medium">WebSquare</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Version</span>
            <span className="text-gray-900 font-medium">2.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Powered by</span>
            <span className="text-gray-900 font-medium">Vyoma AI Studios</span>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-3 rounded-xl text-sm font-medium transition"
      >
        <LogOut size={18} />
        Sign Out
      </button>
    </div>
  )
}

// ── Printer Configuration ────────────────────────

function PrinterConfig({ toast }) {
  const { settings, loading } = useSettings()
  const [form, setForm] = useState({
    printer_type: 'browser',
    printer_endpoint: '',
    printer_width: '80',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading && settings) {
      setForm({
        printer_type: settings.printer_type || 'browser',
        printer_endpoint: settings.printer_endpoint || '',
        printer_width: settings.printer_width || '80',
      })
    }
  }, [loading, settings])

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.save(form)
      invalidateSettingsCache()
      toast.success('Printer settings saved')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTestPrint() {
    if (form.printer_type === 'browser') {
      // For browser printing, just open a small test window
      const win = window.open('', '_blank', 'width=400,height=300')
      if (win) {
        win.document.write(`
          <html><body style="font-family:monospace;text-align:center;padding:20px">
          <h3>WebSquare Test Print</h3>
          <p>Printer: Browser</p>
          <p>Width: ${form.printer_width}mm</p>
          <p>Date: ${new Date().toLocaleString()}</p>
          <hr/><p style="font-size:10px">If you can read this, printing works!</p>
          <script>setTimeout(()=>{window.print();window.close()},500)</script>
          </body></html>
        `)
      }
    } else {
      // Test network thermal printer
      try {
        const { sendToNetworkPrinter, generateReceiptCommands } = await import('../services/escpos')
        const testReceipt = {
          items: [{ name: 'Test Item', quantity: 1, price: 1000 }],
          total: 1000,
          voucherNumber: 'TEST-001',
          date: new Date().toISOString(),
        }
        const commands = generateReceiptCommands(testReceipt, {
          width: parseInt(form.printer_width) || 80,
          headerText: 'WebSquare Test Print',
          footerText: 'Printer is working!',
        })
        await sendToNetworkPrinter(commands, form.printer_endpoint)
        toast.success('Test sent to printer')
      } catch (e) {
        toast.error(`Printer test failed: ${e.message}`)
      }
    }
  }

  if (loading) return <SettingSkeleton icon={Printer} title="Printer Configuration" />

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-1">
        <Printer size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-900">Printer Configuration</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Configure receipt printing method and paper size.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Printer Type</label>
          <select
            value={form.printer_type}
            onChange={e => setForm(f => ({ ...f, printer_type: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="browser">Browser Print (Default)</option>
            <option value="thermal">Network Thermal Printer</option>
          </select>
        </div>

        {form.printer_type === 'thermal' && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Printer Endpoint URL</label>
            <input
              type="text"
              value={form.printer_endpoint}
              onChange={e => setForm(f => ({ ...f, printer_endpoint: e.target.value }))}
              placeholder="http://192.168.1.50:9100"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">IP address and port of the thermal printer</p>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Paper Width</label>
          <div className="flex gap-3">
            {['80', '58'].map(w => (
              <label key={w} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="printer_width"
                  value={w}
                  checked={form.printer_width === w}
                  onChange={e => setForm(f => ({ ...f, printer_width: e.target.value }))}
                  className="text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">{w}mm</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
          <button
            onClick={handleTestPrint}
            className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            <TestTube2 size={14} /> Test Print
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Receipt Customization ────────────────────────

function ReceiptConfig({ toast }) {
  const { settings, loading } = useSettings()
  const [form, setForm] = useState({
    receipt_header: '',
    receipt_footer: 'Thank you for visiting!',
    receipt_show_logo: '1',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading && settings) {
      setForm({
        receipt_header: settings.receipt_header || '',
        receipt_footer: settings.receipt_footer || 'Thank you for visiting!',
        receipt_show_logo: settings.receipt_show_logo ?? '1',
      })
    }
  }, [loading, settings])

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.save(form)
      invalidateSettingsCache()
      toast.success('Receipt settings saved')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SettingSkeleton icon={Receipt} title="Receipt Customization" />

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-1">
        <Receipt size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-900">Receipt Customization</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Customize the header and footer text on printed receipts.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Header Text</label>
          <textarea
            value={form.receipt_header}
            onChange={e => setForm(f => ({ ...f, receipt_header: e.target.value }))}
            placeholder="Company name, address, phone..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">Appears at the top of each receipt below the camp name</p>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Footer Text</label>
          <input
            type="text"
            value={form.receipt_footer}
            onChange={e => setForm(f => ({ ...f, receipt_footer: e.target.value }))}
            placeholder="Thank you for visiting!"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.receipt_show_logo === '1'}
              onChange={e => setForm(f => ({ ...f, receipt_show_logo: e.target.checked ? '1' : '0' }))}
              className="text-green-600 focus:ring-green-500 rounded"
            />
            <span className="text-sm text-gray-700">Show WebSquare branding on receipts</span>
          </label>
        </div>

        {/* Mini preview */}
        <div className="bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200">
          <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Preview</p>
          <div className="text-center space-y-1" style={{ fontFamily: 'monospace', fontSize: 11 }}>
            <div className="font-bold">CAMP NAME</div>
            {form.receipt_header && (
              <div className="text-gray-500 whitespace-pre-line">{form.receipt_header}</div>
            )}
            <div className="border-t border-dashed border-gray-300 my-1" />
            <div className="text-gray-400">... receipt items ...</div>
            <div className="border-t border-dashed border-gray-300 my-1" />
            {form.receipt_footer && (
              <div className="text-gray-600 italic">{form.receipt_footer}</div>
            )}
            {form.receipt_show_logo === '1' && (
              <div className="text-gray-300 text-[9px]">WebSquare by Vyoma AI Studios</div>
            )}
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tally ERP Configuration ─────────────────────

function TallyConfig({ toast }) {
  const { settings, loading } = useSettings()
  const [form, setForm] = useState({
    tally_company_name: '',
    tally_server_url: '',
    tally_godown_prefix: 'Camp-',
    tally_ledger_sales: 'Sales Account',
    tally_ledger_purchase: 'Purchase Account',
    tally_ledger_cash: 'Cash Account',
    tally_ledger_bank: 'Bank Account',
    tally_expense_kitchen: 'Kitchen Expenses',
    tally_expense_rooms: 'Rooms Expenses',
    tally_expense_bar: 'Bar Expenses',
    tally_expense_staff: 'Staff Welfare',
    tally_expense_maint: 'Maintenance Expenses',
  })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!loading && settings) {
      setForm(prev => {
        const updated = { ...prev }
        Object.keys(prev).forEach(key => {
          if (settings[key] !== undefined) updated[key] = settings[key]
        })
        return updated
      })
    }
  }, [loading, settings])

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.save(form)
      invalidateSettingsCache()
      toast.success('Tally settings saved')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SettingSkeleton icon={Database} title="Tally ERP Integration" />

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-1">
        <Database size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-900">Tally ERP Integration</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Configure Tally company name, ledger mappings, and godown settings for XML export.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Company Name (in Tally)</label>
          <input
            type="text"
            value={form.tally_company_name}
            onChange={e => setForm(f => ({ ...f, tally_company_name: e.target.value }))}
            placeholder="Karibu Camps Ltd"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tally Server URL (optional)</label>
          <input
            type="text"
            value={form.tally_server_url}
            onChange={e => setForm(f => ({ ...f, tally_server_url: e.target.value }))}
            placeholder="http://localhost:9000"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Leave empty to download XML manually</p>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Godown Prefix</label>
          <input
            type="text"
            value={form.tally_godown_prefix}
            onChange={e => setForm(f => ({ ...f, tally_godown_prefix: e.target.value }))}
            placeholder="Camp-"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Camp codes will be appended (e.g. Camp-NGO, Camp-SER)</p>
        </div>

        {/* Expandable ledger mappings */}
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
          >
            <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Hide' : 'Show'} Ledger Mappings
          </button>

          {expanded && (
            <div className="mt-3 space-y-3 pl-2 border-l-2 border-blue-100">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Account Ledgers</h4>
              {[
                { key: 'tally_ledger_sales', label: 'Sales Ledger' },
                { key: 'tally_ledger_purchase', label: 'Purchase Ledger' },
                { key: 'tally_ledger_cash', label: 'Cash Ledger' },
                { key: 'tally_ledger_bank', label: 'Bank Ledger' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}

              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide pt-2">Expense Ledgers</h4>
              {[
                { key: 'tally_expense_kitchen', label: 'Kitchen Expenses' },
                { key: 'tally_expense_rooms', label: 'Rooms Expenses' },
                { key: 'tally_expense_bar', label: 'Bar Expenses' },
                { key: 'tally_expense_staff', label: 'Staff Welfare' },
                { key: 'tally_expense_maint', label: 'Maintenance Expenses' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Offline & Sync Configuration ─────────────────

function OfflineSyncConfig({ toast }) {
  const [queueCount, setQueueCount] = useState(0)
  const [cacheStats, setCacheStats] = useState({ entries: 0 })
  const [online, setOnline] = useState(navigator.onLine)
  const [clearing, setClearing] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const loadStats = useCallback(async () => {
    const [count, stats] = await Promise.all([
      getQueueCount(),
      getCacheStats(),
    ])
    setQueueCount(count)
    setCacheStats(stats)
  }, [])

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 10000) // refresh every 10s

    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      clearInterval(interval)
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [loadStats])

  async function handleClearCache() {
    setClearing(true)
    try {
      await clearAllCache()
      toast.success('Cache cleared')
      loadStats()
    } catch {
      toast.error('Failed to clear cache')
    } finally {
      setClearing(false)
    }
  }

  async function handleManualSync() {
    if (!navigator.onLine) {
      toast.error('No internet connection')
      return
    }
    setSyncing(true)
    try {
      const { flushQueue } = await import('../services/offlineSync')
      await flushQueue()
      toast.success('Sync complete')
      loadStats()
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function handleClearQueue() {
    if (queueCount === 0) return
    try {
      await clearQueue()
      toast.success('Sync queue cleared')
      loadStats()
    } catch {
      toast.error('Failed to clear queue')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-1">
        {online
          ? <Wifi size={18} className="text-green-500" />
          : <WifiOff size={18} className="text-red-400" />
        }
        <h3 className="font-semibold text-gray-900">Offline & Sync</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Monitor offline storage and sync status.
      </p>

      <div className="space-y-3">
        {/* Status indicators */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Connection</p>
            <p className={`text-sm font-medium ${online ? 'text-green-600' : 'text-red-500'}`}>
              {online ? 'Online' : 'Offline'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Sync Queue</p>
            <p className={`text-sm font-medium ${queueCount > 0 ? 'text-amber-600' : 'text-gray-600'}`}>
              {queueCount} pending
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Cached Entries</p>
            <p className="text-sm font-medium text-gray-600">{cacheStats.entries}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Service Worker</p>
            <p className="text-sm font-medium text-gray-600">
              {'serviceWorker' in navigator ? 'Active' : 'N/A'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={handleManualSync}
            disabled={syncing || !online || queueCount === 0}
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Sync Now
          </button>
          <button
            onClick={handleClearCache}
            disabled={clearing}
            className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
          >
            {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Clear Cache
          </button>
          {queueCount > 0 && (
            <button
              onClick={handleClearQueue}
              className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100"
            >
              <Trash2 size={14} /> Clear Queue
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400">
          Data syncs automatically when connection is restored. Cache is refreshed on each login.
        </p>
      </div>
    </div>
  )
}

// ── Loading skeleton for settings sections ───────

function SettingSkeleton({ icon: Icon, title }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-3">
        <Icon size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  )
}

// ── Module Manager Component ───────────────────────

function ModuleManager({ camps, toast }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null) // 'campId-moduleId'

  useEffect(() => {
    loadModules()
  }, [])

  async function loadModules() {
    setLoading(true)
    try {
      const result = await rawRequest('modules.php?action=camp_modules')
      setData(result)
    } catch (err) {
      console.error('Failed to load modules:', err)
    } finally {
      setLoading(false)
    }
  }

  async function toggleModule(campId, moduleId, currentState) {
    const key = `${campId}-${moduleId}`
    setToggling(key)
    try {
      await rawRequest('modules.php?action=toggle', {
        method: 'POST',
        body: JSON.stringify({
          camp_id: campId,
          module_id: moduleId,
          enabled: !currentState,
        }),
      })
      // Update local state
      setData(prev => ({
        ...prev,
        camp_modules: {
          ...prev.camp_modules,
          [campId]: {
            ...prev.camp_modules[campId],
            [moduleId]: !currentState,
          },
        },
      }))
      toast.success(`Module ${!currentState ? 'enabled' : 'disabled'}`)
    } catch (err) {
      toast.error('Failed to toggle module')
    } finally {
      setToggling(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-3">
          <Blocks size={18} className="text-gray-400" />
          <h3 className="font-semibold text-gray-900">Module Management</h3>
        </div>
        <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading modules...</span>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-1">
        <Blocks size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-900">Module Management</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Enable or disable modules per camp. Core modules cannot be disabled.
      </p>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 px-2 py-2">Camp</th>
              {data.modules.map(m => (
                <th key={m.id} className="text-center text-xs font-medium text-gray-500 px-2 py-2 whitespace-nowrap">
                  {m.label.split(' ')[0]}
                  {m.is_core == 1 && <Lock size={10} className="inline ml-0.5 text-gray-300" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.camps.map(camp => (
              <tr key={camp.id} className="border-b border-gray-50">
                <td className="px-2 py-2">
                  <span className="text-sm font-medium text-gray-900">{camp.code}</span>
                  <span className="text-xs text-gray-400 ml-1 hidden sm:inline">{camp.name}</span>
                </td>
                {data.modules.map(m => {
                  const isCore = m.is_core == 1
                  const enabled = isCore || data.camp_modules?.[camp.id]?.[m.id] !== false
                  const key = `${camp.id}-${m.id}`
                  const isToggling = toggling === key

                  return (
                    <td key={m.id} className="text-center px-2 py-2">
                      {isCore ? (
                        <div className="inline-flex items-center justify-center w-8 h-5 bg-green-100 rounded-full">
                          <div className="w-3 h-3 bg-green-500 rounded-full" />
                        </div>
                      ) : (
                        <button
                          onClick={() => toggleModule(camp.id, m.id, enabled)}
                          disabled={isToggling}
                          className={`relative inline-flex items-center h-5 w-9 rounded-full transition-colors ${
                            enabled ? 'bg-green-500' : 'bg-gray-200'
                          } ${isToggling ? 'opacity-50' : ''}`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                              enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                            }`}
                          />
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-gray-400" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900 capitalize">{value}</p>
      </div>
    </div>
  )
}
