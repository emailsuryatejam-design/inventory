import { useState, useEffect } from 'react'
import { departments as departmentsApi } from '../services/api'
import { useUser, isManager } from '../context/AppContext'
import { Building2, Plus, X, Pencil, Trash2 } from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

export default function Departments() {
  const user = useUser()
  const canManage = isManager(user?.role)
  const [departments, setDepartments] = useState([])
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
      const result = await departmentsApi.list()
      setDepartments(result.departments || [])
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

  function openEdit(dept) {
    setEditing(dept)
    setForm({ name: dept.name, code: dept.code })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm({ name: '', code: '' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await departmentsApi.update(editing.id, form)
      } else {
        await departmentsApi.create(form)
      }
      closeModal()
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(dept) {
    if (!confirm(`Deactivate department "${dept.name}"?`)) return
    try {
      await departmentsApi.remove(dept.id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Departments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {departments.length} department{departments.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Department</span>
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={load} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !departments.length && <LoadingSpinner message="Loading departments..." />}

      {/* Departments List */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200">
          {departments.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No departments found"
              message="Create your first department to get started"
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Code</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Name</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Head</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      {canManage && <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map(dept => (
                      <tr key={dept.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-gray-900">{dept.code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">{dept.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{dept.head_name || '--'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={dept.is_active ? 'ok' : 'out'}>
                            {dept.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEdit(dept)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              {dept.is_active && (
                                <button
                                  onClick={() => handleDeactivate(dept)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                  title="Deactivate"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {departments.map(dept => (
                  <div
                    key={dept.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-gray-400">{dept.code}</span>
                        <Badge variant={dept.is_active ? 'ok' : 'out'}>
                          {dept.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{dept.name}</p>
                      <p className="text-xs text-gray-400">{dept.head_name || 'No head assigned'}</p>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(dept)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg"
                        >
                          <Pencil size={14} />
                        </button>
                        {dept.is_active && (
                          <button
                            onClick={() => handleDeactivate(dept)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Department' : 'New Department'}
              </h2>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Department Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. Human Resources"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Code</label>
                <input
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  required
                  placeholder="e.g. HR"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
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
