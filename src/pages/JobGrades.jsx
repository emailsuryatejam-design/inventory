import { useState, useEffect } from 'react'
import { jobGrades as jobGradesApi } from '../services/api'
import { useUser, isManager } from '../context/AppContext'
import { BarChart3, Plus, X, Pencil, Trash2 } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

export default function JobGrades() {
  const user = useUser()
  const canManage = isManager(user?.role)
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', level: '', min_salary: '', max_salary: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await jobGradesApi.list()
      setGrades(result.job_grades || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: '', level: '', min_salary: '', max_salary: '' })
    setShowModal(true)
  }

  function openEdit(grade) {
    setEditing(grade)
    setForm({
      name: grade.name,
      level: String(grade.level),
      min_salary: grade.min_salary != null ? String(grade.min_salary) : '',
      max_salary: grade.max_salary != null ? String(grade.max_salary) : '',
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm({ name: '', level: '', min_salary: '', max_salary: '' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        level: Number(form.level),
        min_salary: form.min_salary ? Number(form.min_salary) : null,
        max_salary: form.max_salary ? Number(form.max_salary) : null,
      }
      if (editing) {
        await jobGradesApi.update(editing.id, payload)
      } else {
        await jobGradesApi.create(payload)
      }
      closeModal()
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(grade) {
    if (!confirm(`Delete job grade "${grade.name}"?`)) return
    try {
      await jobGradesApi.remove(grade.id)
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
          <h1 className="text-xl font-bold text-gray-900">Job Grades</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {grades.length} grade{grades.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Grade</span>
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
      {loading && !grades.length && <LoadingSpinner message="Loading job grades..." />}

      {/* Grades List */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200">
          {grades.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No job grades found"
              message="Create your first job grade to get started"
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Name</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Level</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Min Salary</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Max Salary</th>
                      {canManage && <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map(grade => (
                      <tr key={grade.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">{grade.name}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-gray-600">{grade.level}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-600">
                            {grade.min_salary != null ? grade.min_salary.toLocaleString() : '--'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-600">
                            {grade.max_salary != null ? grade.max_salary.toLocaleString() : '--'}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEdit(grade)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(grade)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
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
                {grades.map(grade => (
                  <div
                    key={grade.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <BarChart3 size={18} className="text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-gray-400">Level {grade.level}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{grade.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">
                          {grade.min_salary != null ? grade.min_salary.toLocaleString() : '--'}
                        </span>
                        <span className="text-xs text-gray-300">-</span>
                        <span className="text-xs text-gray-400">
                          {grade.max_salary != null ? grade.max_salary.toLocaleString() : '--'}
                        </span>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(grade)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(grade)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
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
                {editing ? 'Edit Job Grade' : 'New Job Grade'}
              </h2>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Grade Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. Senior Manager"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Level</label>
                <input
                  type="number"
                  value={form.level}
                  onChange={e => setForm({ ...form, level: e.target.value })}
                  required
                  min="1"
                  placeholder="e.g. 5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Min Salary</label>
                  <input
                    type="number"
                    value={form.min_salary}
                    onChange={e => setForm({ ...form, min_salary: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Max Salary</label>
                  <input
                    type="number"
                    value={form.max_salary}
                    onChange={e => setForm({ ...form, max_salary: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
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
