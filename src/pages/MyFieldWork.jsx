import { useState, useEffect } from 'react'
import { useUser } from '../context/AppContext'
import { selfService as selfServiceApi } from '../services/api'
import {
  MapPin, Plus, Clock, Route, Calendar, CheckCircle2,
  Loader2, X, Navigation, AlertCircle
} from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

const STATUS_VARIANTS = {
  completed: 'ok',
  in_progress: 'info',
  cancelled: 'danger',
}

export default function MyFieldWork() {
  const user = useUser()
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Summary
  const [summary, setSummary] = useState({ total: 0, completed: 0, distance: 0, fieldDays: 0 })

  // Start Visit Modal
  const [showStartModal, setShowStartModal] = useState(false)
  const [startForm, setStartForm] = useState({ client_name: '', purpose: '' })
  const [startSubmitting, setStartSubmitting] = useState(false)
  const [startError, setStartError] = useState('')
  const [startGps, setStartGps] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)

  // End Visit Modal
  const [showEndModal, setShowEndModal] = useState(false)
  const [endForm, setEndForm] = useState({ notes: '', outcome: '' })
  const [endSubmitting, setEndSubmitting] = useState(false)
  const [endError, setEndError] = useState('')
  const [endGps, setEndGps] = useState(null)
  const [endGpsLoading, setEndGpsLoading] = useState(false)

  useEffect(() => { load() }, [month])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await selfServiceApi.myVisits(month)
      const visitList = result.visits || result.data || []
      setVisits(visitList)

      // Calculate summary
      const completed = visitList.filter(v => v.status === 'completed')
      const totalDistance = visitList.reduce((sum, v) => sum + (parseFloat(v.distance_km) || 0), 0)
      const uniqueDays = new Set(visitList.map(v => v.check_in_time?.slice(0, 10) || v.date)).size
      setSummary({
        total: visitList.length,
        completed: completed.length,
        distance: Math.round(totalDistance * 10) / 10,
        fieldDays: uniqueDays,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Active visit detection
  const activeVisit = visits.find(v => v.status === 'in_progress')

  function captureGps(setGpsState, setLoadingState) {
    if (!navigator.geolocation) {
      return
    }
    setLoadingState(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setLoadingState(false)
      },
      () => {
        setLoadingState(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Start Visit
  function openStartVisit() {
    setStartForm({ client_name: '', purpose: '' })
    setStartError('')
    setStartGps(null)
    setShowStartModal(true)
    captureGps(setStartGps, setGpsLoading)
  }

  async function handleStartVisit(e) {
    e.preventDefault()
    setStartError('')

    if (!startForm.client_name || !startForm.purpose) {
      setStartError('Please fill in all required fields')
      return
    }

    setStartSubmitting(true)
    try {
      await selfServiceApi.startVisit({
        client_name: startForm.client_name,
        purpose: startForm.purpose,
        latitude: startGps?.latitude || null,
        longitude: startGps?.longitude || null,
        accuracy: startGps?.accuracy || null,
      })
      setShowStartModal(false)
      await load()
    } catch (err) {
      setStartError(err.message)
    } finally {
      setStartSubmitting(false)
    }
  }

  // End Visit
  function openEndVisit() {
    setEndForm({ notes: '', outcome: '' })
    setEndError('')
    setEndGps(null)
    setShowEndModal(true)
    captureGps(setEndGps, setEndGpsLoading)
  }

  async function handleEndVisit(e) {
    e.preventDefault()
    setEndError('')

    setEndSubmitting(true)
    try {
      await selfServiceApi.endVisit({
        visit_id: activeVisit?.id,
        notes: endForm.notes,
        outcome: endForm.outcome,
        latitude: endGps?.latitude || null,
        longitude: endGps?.longitude || null,
        accuracy: endGps?.accuracy || null,
      })
      setShowEndModal(false)
      await load()
    } catch (err) {
      setEndError(err.message)
    } finally {
      setEndSubmitting(false)
    }
  }

  function formatTime(dateStr) {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatDuration(minutes) {
    if (!minutes && minutes !== 0) return '--'
    const hrs = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    if (hrs > 0) return `${hrs}h ${mins}m`
    return `${mins}m`
  }

  return (
    <div data-guide="my-field-work-header">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={22} className="text-green-600" />
            My Field Work
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track your field visits and client meetings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeVisit ? (
            <button
              onClick={openEndVisit}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition"
            >
              <CheckCircle2 size={16} />
              <span className="hidden sm:inline">End Visit</span>
            </button>
          ) : (
            <button
              onClick={openStartVisit}
              data-guide="my-field-start-visit"
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Start Visit</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Visit Indicator */}
      {activeVisit && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900">
              Visit in progress: {activeVisit.client_name}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              Started at {formatTime(activeVisit.check_in_time)} | {activeVisit.purpose}
            </p>
          </div>
          <button
            onClick={openEndVisit}
            className="text-sm text-blue-700 hover:text-blue-800 font-medium flex-shrink-0"
          >
            End Visit
          </button>
        </div>
      )}

      {/* Month Selector */}
      <div className="mb-4">
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={load} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Visits</p>
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <MapPin size={16} className="text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{summary.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{summary.completed}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Distance (km)</p>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Route size={16} className="text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{summary.distance}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Field Days</p>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Calendar size={16} className="text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{summary.fieldDays}</p>
        </div>
      </div>

      {/* Loading */}
      {loading && <LoadingSpinner message="Loading your field visits..." />}

      {/* Visit History */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200">
          {visits.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No visits found"
              message="Start a field visit to begin tracking your work"
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Purpose</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Check In</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Check Out</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Duration</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Distance (km)</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map(v => (
                      <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">
                            {formatDate(v.check_in_time || v.date)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">{v.client_name || '--'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{v.purpose || '--'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{formatTime(v.check_in_time)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{formatTime(v.check_out_time)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-600">{formatDuration(v.duration_minutes)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-600">
                            {v.distance_km ? Number(v.distance_km).toLocaleString() : '--'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={STATUS_VARIANTS[v.status] || 'default'}>
                            {v.status === 'in_progress' ? 'In Progress' : v.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 truncate block max-w-[150px]">
                            {v.notes || '--'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {visits.map(v => (
                  <div key={v.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin size={18} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {v.client_name || 'Unknown Client'}
                        </span>
                        <Badge variant={STATUS_VARIANTS[v.status] || 'default'}>
                          {v.status === 'in_progress' ? 'In Progress' : v.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400">
                        {formatDate(v.check_in_time || v.date)} | {v.purpose || 'No purpose'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatTime(v.check_in_time)} - {formatTime(v.check_out_time)}
                        {v.duration_minutes ? ` (${formatDuration(v.duration_minutes)})` : ''}
                        {v.distance_km ? ` | ${v.distance_km} km` : ''}
                      </p>
                      {v.notes && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{v.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Start Visit Modal */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Start Field Visit</h2>
              <button
                onClick={() => setShowStartModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleStartVisit} className="p-6 space-y-4">
              {startError && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {startError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                <input
                  type="text"
                  value={startForm.client_name}
                  onChange={e => setStartForm(prev => ({ ...prev, client_name: e.target.value }))}
                  placeholder="e.g. Acme Corporation"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose *</label>
                <input
                  type="text"
                  value={startForm.purpose}
                  onChange={e => setStartForm(prev => ({ ...prev, purpose: e.target.value }))}
                  placeholder="e.g. Sales meeting, Delivery, Inspection"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              {/* GPS Status */}
              <div className="bg-gray-50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Navigation size={14} className={startGps ? 'text-green-600' : 'text-gray-400'} />
                  <span className="text-sm text-gray-600">
                    {gpsLoading ? 'Capturing GPS location...' :
                     startGps ? `Location captured (${startGps.latitude.toFixed(4)}, ${startGps.longitude.toFixed(4)})` :
                     'GPS location not available'}
                  </span>
                  {gpsLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
                </div>
                {!startGps && !gpsLoading && (
                  <button
                    type="button"
                    onClick={() => captureGps(setStartGps, setGpsLoading)}
                    className="text-xs text-green-600 hover:text-green-700 font-medium mt-1"
                  >
                    Retry GPS capture
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-lg transition"
                >
                  {startSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Start Visit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Visit Modal */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">End Field Visit</h2>
              <button
                onClick={() => setShowEndModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleEndVisit} className="p-6 space-y-4">
              {endError && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {endError}
                </div>
              )}

              {activeVisit && (
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm">
                  <p className="font-medium text-blue-900">{activeVisit.client_name}</p>
                  <p className="text-blue-600 text-xs mt-0.5">
                    Started at {formatTime(activeVisit.check_in_time)} | {activeVisit.purpose}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
                <select
                  value={endForm.outcome}
                  onChange={e => setEndForm(prev => ({ ...prev, outcome: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                >
                  <option value="">Select outcome</option>
                  <option value="successful">Successful</option>
                  <option value="follow_up">Follow Up Required</option>
                  <option value="not_available">Client Not Available</option>
                  <option value="rescheduled">Rescheduled</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={endForm.notes}
                  onChange={e => setEndForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Summary of the visit..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              {/* GPS Status */}
              <div className="bg-gray-50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Navigation size={14} className={endGps ? 'text-green-600' : 'text-gray-400'} />
                  <span className="text-sm text-gray-600">
                    {endGpsLoading ? 'Capturing GPS location...' :
                     endGps ? `Location captured (${endGps.latitude.toFixed(4)}, ${endGps.longitude.toFixed(4)})` :
                     'GPS location not available'}
                  </span>
                  {endGpsLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
                </div>
                {!endGps && !endGpsLoading && (
                  <button
                    type="button"
                    onClick={() => captureGps(setEndGps, setEndGpsLoading)}
                    className="text-xs text-green-600 hover:text-green-700 font-medium mt-1"
                  >
                    Retry GPS capture
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEndModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={endSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg transition"
                >
                  {endSubmitting && <Loader2 size={16} className="animate-spin" />}
                  End Visit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
