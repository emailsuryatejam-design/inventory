import { useState, useEffect } from 'react'
import { hrRegions as regionsApi } from '../services/api'
import { MapPin, Plus, X, Loader2 } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const EMPTY_FORM = {
  name: '',
  code: '',
  country: '',
}

export default function HRRegions() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await regionsApi.list()
      setItems(result.regions || result.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({
      name: item.name || '',
      code: item.code || '',
      country: item.country || '',
    })
    setFormError('')
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!form.name || !form.code) {
      setFormError('Name and code are required')
      return
    }

    setSubmitting(true)
    try {
      if (editing) {
        await regionsApi.update(editing.id, form)
      } else {
        await regionsApi.create(form)
      }
      setShowModal(false)
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Filter
  const filtered = items.filter(item => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (item.name || '').toLowerCase().includes(s) ||
      (item.code || '').toLowerCase().includes(s) ||
      (item.country || '').toLowerCase().includes(s)
    )
  })

  const perPage = 20
  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={22} className="text-green-600" />
            HR Regions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} region{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Region</span>
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Search regions..."
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={load} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingSpinner message="Loading regions..." />}

      {/* Table */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200">
          {paginated.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No regions found"
              message="Create a region to get started"
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
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Country</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(item => (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono font-medium text-gray-900">{item.code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">{item.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{item.country || '--'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={item.is_active ? 'ok' : 'out'}>
                            {item.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openEdit(item)}
                            className="text-sm text-green-600 hover:text-green-700 font-medium"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {paginated.map(item => (
                  <button
                    key={item.id}
                    onClick={() => openEdit(item)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
                  >
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin size={18} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                        <Badge variant={item.is_active ? 'ok' : 'out'}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400">
                        {item.code}{item.country ? ` | ${item.country}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 pb-4">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    total={filtered.length}
                    perPage={perPage}
                    onChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Edit Region' : 'New Region'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Dar es Salaam"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. DSM"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={form.country}
                  onChange={e => setForm(prev => ({ ...prev, country: e.target.value }))}
                  placeholder="e.g. Tanzania"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>

              {editing && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active !== false}
                    onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-lg transition"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {editing ? 'Update Region' : 'Create Region'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
