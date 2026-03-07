import { useState, useEffect } from 'react'
import { GitBranch, Plus, X, Loader2 } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import EmptyState from '../components/ui/EmptyState'

const ENTITY_TYPES = [
  { value: 'leave', label: 'Leave Requests' },
  { value: 'loan', label: 'Loans' },
  { value: 'advance', label: 'Salary Advances' },
  { value: 'expense', label: 'Expense Claims' },
  { value: 'payroll', label: 'Payroll Runs' },
]

const ENTITY_LABELS = Object.fromEntries(ENTITY_TYPES.map(t => [t.value, t.label]))

const ROLES = [
  { value: 'stores_manager', label: 'Stores Manager' },
  { value: 'procurement_officer', label: 'Procurement Officer' },
  { value: 'director', label: 'Director' },
  { value: 'admin', label: 'Admin' },
]

const DEFAULT_RULES = [
  { id: 1, entity_type: 'leave', required_role: 'stores_manager', auto_approve_below: 0 },
  { id: 2, entity_type: 'loan', required_role: 'director', auto_approve_below: 50000 },
  { id: 3, entity_type: 'advance', required_role: 'stores_manager', auto_approve_below: 20000 },
  { id: 4, entity_type: 'expense', required_role: 'stores_manager', auto_approve_below: 10000 },
  { id: 5, entity_type: 'payroll', required_role: 'director', auto_approve_below: 0 },
]

const EMPTY_FORM = {
  entity_type: 'leave',
  required_role: 'stores_manager',
  auto_approve_below: 0,
}

export default function ApprovalWorkflows() {
  const [rules, setRules] = useState(DEFAULT_RULES)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [nextId, setNextId] = useState(DEFAULT_RULES.length + 1)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(rule) {
    setEditing(rule)
    setForm({
      entity_type: rule.entity_type,
      required_role: rule.required_role,
      auto_approve_below: rule.auto_approve_below || 0,
    })
    setShowModal(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (editing) {
      setRules(prev => prev.map(r =>
        r.id === editing.id ? { ...r, ...form } : r
      ))
    } else {
      setRules(prev => [...prev, { id: nextId, ...form }])
      setNextId(prev => prev + 1)
    }
    setShowModal(false)
  }

  function handleDelete(id) {
    setRules(prev => prev.filter(r => r.id !== id))
  }

  // Filter
  const filtered = rules.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (ENTITY_LABELS[r.entity_type] || r.entity_type).toLowerCase().includes(s) ||
      r.required_role.toLowerCase().includes(s)
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
            <GitBranch size={22} className="text-green-600" />
            Approval Workflows
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure approval rules for different entity types
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Rule</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
        <p className="text-sm text-blue-700">
          These rules define who can approve requests and the auto-approval thresholds. Rules are saved locally and will be connected to the backend in a future update.
        </p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Search workflow rules..."
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        {paginated.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No approval rules"
            message="Add an approval rule to configure workflows"
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Entity Type</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Required Role</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Auto-Approve Below</th>
                    <th className="w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(rule => (
                    <tr key={rule.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <Badge variant="ok">
                          {ENTITY_LABELS[rule.entity_type] || rule.entity_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">
                          {rule.required_role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-600">
                          {rule.auto_approve_below > 0 ? Number(rule.auto_approve_below).toLocaleString() : 'Manual only'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEdit(rule)}
                            className="text-sm text-green-600 hover:text-green-700 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="text-sm text-red-500 hover:text-red-600 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {paginated.map(rule => (
                <div
                  key={rule.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <GitBranch size={18} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="ok">
                        {ENTITY_LABELS[rule.entity_type] || rule.entity_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      Role: {rule.required_role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Auto-approve below: {rule.auto_approve_below > 0 ? Number(rule.auto_approve_below).toLocaleString() : 'Manual only'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => openEdit(rule)}
                      className="text-xs text-green-600 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-xs text-red-500 font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Edit Approval Rule' : 'New Approval Rule'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type *</label>
                <select
                  value={form.entity_type}
                  onChange={e => setForm(prev => ({ ...prev, entity_type: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                >
                  {ENTITY_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Required Role *</label>
                <select
                  value={form.required_role}
                  onChange={e => setForm(prev => ({ ...prev, required_role: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auto-Approve Below Amount</label>
                <input
                  type="number"
                  step="1"
                  value={form.auto_approve_below}
                  onChange={e => setForm(prev => ({ ...prev, auto_approve_below: parseInt(e.target.value, 10) || 0 }))}
                  placeholder="0 for manual only"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Set to 0 to require manual approval for all amounts</p>
              </div>

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
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition"
                >
                  {editing ? 'Update Rule' : 'Add Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
