import { useState, useEffect } from 'react'
import { useUser, isManager } from '../context/AppContext'
import { kitchens as kitchensApi } from '../services/api'
import { ChefHat, Plus, X, Pencil, ToggleLeft, ToggleRight, Settings } from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

export default function KitchenAdmin() {
  const user = useUser()
  const canManage = isManager(user?.role)
  const [kitchensList, setKitchensList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', camp_id: '', default_servings: 50 })
  const [saving, setSaving] = useState(false)
  const [settingsModal, setSettingsModal] = useState(null)
  const [settingsForm, setSettingsForm] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await kitchensApi.list()
      setKitchensList(result.kitchens || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: '', camp_id: '', default_servings: 50 })
    setShowModal(true)
  }

  function openEdit(k) {
    setEditing(k)
    setForm({ name: k.name, camp_id: k.camp_id || '', default_servings: k.default_servings || 50 })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await kitchensApi.save({
        id: editing?.id || 0,
        ...form,
        default_servings: parseInt(form.default_servings) || 50,
      })
      closeModal()
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(k) {
    try {
      await kitchensApi.toggleActive(k.id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function openSettings(k) {
    try {
      const result = await kitchensApi.getSettings(k.id)
      setSettingsForm(result.settings || {})
      setSettingsModal(k)
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveSettings(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await kitchensApi.saveSettings(settingsModal.id, settingsForm)
      setSettingsModal(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4" data-guide="kitchen-admin-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kitchens</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {kitchensList.length} kitchen{kitchensList.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            data-guide="kitchen-add-btn"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Kitchen</span>
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      {loading ? (
        <LoadingSpinner message="Loading kitchens..." />
      ) : kitchensList.length === 0 ? (
        <EmptyState icon={ChefHat} title="No kitchens yet" description="Create your first kitchen to get started" />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-left text-xs uppercase tracking-wider">
                <th className="px-4 py-3 font-semibold">Kitchen</th>
                <th className="px-4 py-3 font-semibold hidden sm:table-cell">Camp</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Default Servings</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                {canManage && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kitchensList.map(k => (
                <tr key={k.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{k.name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{k.camp_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{k.default_servings || 50}</td>
                  <td className="px-4 py-3">
                    <Badge variant={k.is_active ? 'green' : 'gray'}>
                      {k.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openSettings(k)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Settings">
                          <Settings size={15} className="text-gray-500" />
                        </button>
                        <button onClick={() => openEdit(k)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Edit">
                          <Pencil size={15} className="text-gray-500" />
                        </button>
                        <button onClick={() => handleToggle(k)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={k.is_active ? 'Deactivate' : 'Activate'}>
                          {k.is_active ? <ToggleRight size={15} className="text-green-500" /> : <ToggleLeft size={15} className="text-gray-400" />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Kitchen' : 'New Kitchen'}</h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kitchen Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="e.g. Main Kitchen"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Camp ID (optional)</label>
                <input
                  type="number"
                  value={form.camp_id}
                  onChange={e => setForm(f => ({ ...f, camp_id: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Link to a camp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Servings</label>
                <input
                  type="number"
                  value={form.default_servings}
                  onChange={e => setForm(f => ({ ...f, default_servings: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  min="1"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSettingsModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Settings — {settingsModal.name}</h2>
              <button onClick={() => setSettingsModal(null)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={saveSettings} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Breakfast Time</label>
                <input
                  type="time"
                  value={settingsForm.breakfast_time || '07:00'}
                  onChange={e => setSettingsForm(f => ({ ...f, breakfast_time: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lunch Time</label>
                <input
                  type="time"
                  value={settingsForm.lunch_time || '12:30'}
                  onChange={e => setSettingsForm(f => ({ ...f, lunch_time: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dinner Time</label>
                <input
                  type="time"
                  value={settingsForm.dinner_time || '19:00'}
                  onChange={e => setSettingsForm(f => ({ ...f, dinner_time: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requisition Cutoff (hours before meal)</label>
                <input
                  type="number"
                  value={settingsForm.req_cutoff_hours || 4}
                  onChange={e => setSettingsForm(f => ({ ...f, req_cutoff_hours: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  min="1" max="48"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setSettingsModal(null)} className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
