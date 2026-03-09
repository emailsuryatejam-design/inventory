import { useState, useEffect } from 'react'
import { useUser, isManager } from '../context/AppContext'
import { requisitionTypes as reqTypesApi } from '../services/api'
import { ClipboardList, Plus, X, Pencil, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

export default function RequisitionTypes() {
  const user = useUser()
  const canManage = isManager(user?.role)
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', code: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await reqTypesApi.listAll()
      setTypes(result.types || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: '', code: '' })
    setShowModal(true)
  }

  function openEdit(t) {
    setEditing(t)
    setForm({ name: t.name, code: t.code })
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
      await reqTypesApi.save({
        id: editing?.id || 0,
        ...form,
        sort_order: editing?.sort_order || 0,
        is_active: editing?.is_active ?? 1,
      })
      closeModal()
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(t) {
    try {
      await reqTypesApi.toggleActive(t.id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function moveUp(idx) {
    if (idx === 0) return
    const newTypes = [...types]
    ;[newTypes[idx - 1], newTypes[idx]] = [newTypes[idx], newTypes[idx - 1]]
    const items = newTypes.map((t, i) => ({ id: t.id, sort_order: i + 1 }))
    setTypes(newTypes)
    try {
      await reqTypesApi.reorder(items)
    } catch (err) {
      setError(err.message)
      load()
    }
  }

  async function moveDown(idx) {
    if (idx >= types.length - 1) return
    const newTypes = [...types]
    ;[newTypes[idx], newTypes[idx + 1]] = [newTypes[idx + 1], newTypes[idx]]
    const items = newTypes.map((t, i) => ({ id: t.id, sort_order: i + 1 }))
    setTypes(newTypes)
    try {
      await reqTypesApi.reorder(items)
    } catch (err) {
      setError(err.message)
      load()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4" data-guide="req-types-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Requisition Types</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Meal types for kitchen requisitions (e.g. Breakfast, Lunch, Dinner)
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            data-guide="req-type-add-btn"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Type</span>
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      {loading ? (
        <LoadingSpinner message="Loading requisition types..." />
      ) : types.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No requisition types" description="Create meal types like Breakfast, Lunch, Dinner" />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden" data-guide="req-types-list">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-left text-xs uppercase tracking-wider">
                {canManage && <th className="px-3 py-3 w-10"></th>}
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                {canManage && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {types.map((t, idx) => (
                <tr key={t.id} className="hover:bg-gray-50 transition">
                  {canManage && (
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveUp(idx)}
                          disabled={idx === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                        >▲</button>
                        <button
                          onClick={() => moveDown(idx)}
                          disabled={idx >= types.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                        >▼</button>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{t.code}</td>
                  <td className="px-4 py-3">
                    <Badge variant={t.is_active ? 'green' : 'gray'}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Edit">
                          <Pencil size={15} className="text-gray-500" />
                        </button>
                        <button onClick={() => handleToggle(t)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={t.is_active ? 'Deactivate' : 'Activate'}>
                          {t.is_active ? <ToggleRight size={15} className="text-green-500" /> : <ToggleLeft size={15} className="text-gray-400" />}
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
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Type' : 'New Requisition Type'}</h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="e.g. Breakfast"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
                  placeholder="auto-generated if blank"
                />
                <p className="text-xs text-gray-400 mt-1">Leave blank to auto-generate from name</p>
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
    </div>
  )
}
