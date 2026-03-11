import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/AppContext'
import { barTabs as api, barShifts } from '../services/api'
import {
  Plus, Search, Clock, Users, BedDouble, ShoppingBag, User,
  Loader2, AlertTriangle, RefreshCw, ArrowRightLeft, Merge
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const TAB_TYPE_ICONS = { table: Clock, room: BedDouble, guest: User, takeaway: ShoppingBag }
const TAB_TYPE_LABELS = { table: 'Table', room: 'Room', guest: 'Guest', takeaway: 'Takeaway' }

export default function BarTabs() {
  const user = useUser()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tabs, setTabs] = useState([])
  const [statusCounts, setStatusCounts] = useState({})
  const [filter, setFilter] = useState('open')
  const [currentShift, setCurrentShift] = useState(null)

  // Open tab form
  const [showNewTab, setShowNewTab] = useState(false)
  const [newTab, setNewTab] = useState({ tab_type: 'table', table_number: '', room_number: '', guest_name: '', covers: 1 })

  // Merge form
  const [showMerge, setShowMerge] = useState(false)
  const [mergeSource, setMergeSource] = useState('')
  const [mergeTarget, setMergeTarget] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const fetchTabs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [tabData, shiftData] = await Promise.all([
        api.list({ status: filter }),
        barShifts.list(),
      ])
      setTabs(tabData.tabs || [])
      setStatusCounts(tabData.status_counts || {})
      setCurrentShift(shiftData.current_shift)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchTabs() }, [fetchTabs])

  const handleOpenTab = async (e) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const result = await api.open(newTab)
      setShowNewTab(false)
      setNewTab({ tab_type: 'table', table_number: '', room_number: '', guest_name: '', covers: 1 })
      navigate(`/app/bar-tab/${result.tab.id}`)
    } catch (e) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleMerge = async (e) => {
    e.preventDefault()
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) {
      alert('Select two different tabs')
      return
    }
    try {
      setSubmitting(true)
      await api.merge(parseInt(mergeSource), parseInt(mergeTarget))
      setShowMerge(false)
      setMergeSource('')
      setMergeTarget('')
      fetchTabs()
    } catch (e) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatElapsed = (seconds) => {
    if (!seconds) return ''
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const formatMoney = (v) => (v ?? 0).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const openTabs = tabs.filter(t => t.status === 'open')

  const statusBadge = (status) => {
    const map = { open: 'success', closed: 'default', voided: 'danger', merged: 'warning' }
    return <Badge variant={map[status] || 'default'}>{status}</Badge>
  }

  if (loading && !tabs.length) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tabs / Bills</h1>
          <p className="text-sm text-gray-500">
            {currentShift ? `Shift ${currentShift.shift_number} active` : 'No active shift'}
            {statusCounts.open ? ` · ${statusCounts.open} open tab${statusCounts.open > 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTabs} className="flex items-center gap-1.5 text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" />
          </button>
          {openTabs.length >= 2 && (
            <button onClick={() => setShowMerge(true)} className="flex items-center gap-1.5 text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Merge className="w-4 h-4" /> Merge
            </button>
          )}
          <button onClick={() => setShowNewTab(true)} className="flex items-center gap-1.5 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Tab
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}

      {/* Status Filters */}
      <div className="flex gap-2">
        {['open', 'closed', 'voided', 'all'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filter === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {statusCounts[s] ? ` (${statusCounts[s]})` : s === 'all' ? ` (${Object.values(statusCounts).reduce((a, b) => a + parseInt(b), 0)})` : ''}
          </button>
        ))}
      </div>

      {/* Tabs Grid */}
      {filter === 'open' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tabs.map(tab => {
            const Icon = TAB_TYPE_ICONS[tab.tab_type] || Clock
            return (
              <div key={tab.id} onClick={() => navigate(`/app/bar-tab/${tab.id}`)}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-blue-300 cursor-pointer transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{tab.tab_number}</div>
                      <div className="text-xs text-gray-500">
                        {tab.table_number ? `Table ${tab.table_number}` : tab.room_number ? `Room ${tab.room_number}` : tab.guest_name || TAB_TYPE_LABELS[tab.tab_type]}
                      </div>
                    </div>
                  </div>
                  {statusBadge(tab.status)}
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Server</span>
                    <span>{tab.server}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Items</span>
                    <span>{tab.item_count} (Rd {tab.current_round})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Covers</span>
                    <span>{tab.covers}</span>
                  </div>
                  {tab.elapsed_seconds && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Open for</span>
                      <span className="text-orange-600">{formatElapsed(tab.elapsed_seconds)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t flex justify-between items-center">
                  <span className="text-xs text-gray-400">{tab.discount_amount > 0 ? `Disc: -${formatMoney(tab.discount_amount)}` : ''}</span>
                  <span className="text-lg font-bold">{formatMoney(tab.total)}</span>
                </div>
              </div>
            )
          })}
          {tabs.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              No {filter} tabs. Click "New Tab" to start.
            </div>
          )}
        </div>
      ) : (
        /* Table view for closed/voided/all */
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-2">Tab #</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Guest / Table</th>
                  <th className="px-4 py-2">Server</th>
                  <th className="px-4 py-2">Items</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2">Payment</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tabs.map(tab => (
                  <tr key={tab.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/app/bar-tab/${tab.id}`)}>
                    <td className="px-4 py-2.5 font-medium">{tab.tab_number}</td>
                    <td className="px-4 py-2.5 capitalize">{tab.tab_type}</td>
                    <td className="px-4 py-2.5">{tab.guest_name || (tab.table_number ? `Table ${tab.table_number}` : tab.room_number ? `Room ${tab.room_number}` : '—')}</td>
                    <td className="px-4 py-2.5">{tab.server}</td>
                    <td className="px-4 py-2.5">{tab.item_count}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatMoney(tab.total)}</td>
                    <td className="px-4 py-2.5 capitalize">{tab.payment_method || '—'}</td>
                    <td className="px-4 py-2.5">{statusBadge(tab.status)}</td>
                  </tr>
                ))}
                {tabs.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No tabs found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Tab Modal */}
      {showNewTab && (
        <Modal onClose={() => setShowNewTab(false)} title="Open New Tab">
          <form onSubmit={handleOpenTab} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tab Type</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(TAB_TYPE_LABELS).map(([val, label]) => {
                  const Icon = TAB_TYPE_ICONS[val]
                  return (
                    <button key={val} type="button" onClick={() => setNewTab(t => ({ ...t, tab_type: val }))}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition ${newTab.tab_type === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <Icon className="w-5 h-5" />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {newTab.tab_type === 'table' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Table Number</label>
                <input type="text" value={newTab.table_number} onChange={e => setNewTab(t => ({ ...t, table_number: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="e.g., 5" autoFocus />
              </div>
            )}

            {newTab.tab_type === 'room' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                <input type="text" value={newTab.room_number} onChange={e => setNewTab(t => ({ ...t, room_number: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="e.g., 204" autoFocus />
              </div>
            )}

            {(newTab.tab_type === 'guest' || newTab.tab_type === 'room') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
                <input type="text" value={newTab.guest_name} onChange={e => setNewTab(t => ({ ...t, guest_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Guest name" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Covers</label>
              <input type="number" min="1" max="100" value={newTab.covers} onChange={e => setNewTab(t => ({ ...t, covers: parseInt(e.target.value) || 1 }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNewTab(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {submitting && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}Open Tab
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Merge Modal */}
      {showMerge && (
        <Modal onClose={() => setShowMerge(false)} title="Merge Tabs">
          <form onSubmit={handleMerge} className="space-y-4">
            <p className="text-sm text-gray-500">Move all items from the source tab into the target tab.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source Tab (will be closed)</label>
              <select value={mergeSource} onChange={e => setMergeSource(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" required>
                <option value="">Select source tab...</option>
                {openTabs.map(t => <option key={t.id} value={t.id}>{t.tab_number} — {t.table_number ? `Table ${t.table_number}` : t.guest_name || 'Tab'} ({formatMoney(t.total)})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Tab (keeps items)</label>
              <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" required>
                <option value="">Select target tab...</option>
                {openTabs.filter(t => String(t.id) !== mergeSource).map(t => <option key={t.id} value={t.id}>{t.tab_number} — {t.table_number ? `Table ${t.table_number}` : t.guest_name || 'Tab'} ({formatMoney(t.total)})</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowMerge(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">
                {submitting && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}Merge Tabs
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}
