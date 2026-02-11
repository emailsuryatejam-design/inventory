import { useState, useEffect } from 'react'
import { users as usersApi } from '../services/api'
import { useUser } from '../context/AppContext'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const ROLES = [
  'camp_storekeeper', 'camp_manager', 'chef', 'housekeeping',
  'stores_manager', 'procurement_officer', 'accountant', 'director', 'admin'
]

export default function UserManagement() {
  const currentUser = useUser()
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', name: '', role: 'camp_storekeeper', password: '', camp_id: '', pin: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setLoading(true)
      const res = await usersApi.list()
      setUserList(res.users || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await usersApi.create({
        ...form,
        camp_id: form.camp_id ? Number(form.camp_id) : null,
      })
      setShowForm(false)
      setForm({ username: '', name: '', role: 'camp_storekeeper', password: '', camp_id: '', pin: '' })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(user) {
    try {
      await usersApi.update(user.id, { is_active: !user.is_active })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return <LoadingSpinner message="Loading users..." />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">User Management</h1>
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"
          >
            {showForm ? 'Cancel' : '+ New User'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Full Name</label>
              <input
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Username</label>
              <input
                value={form.username}
                onChange={e => setForm({...form, username: e.target.value})}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Role</label>
              <select
                value={form.role}
                onChange={e => setForm({...form, role: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Camp ID</label>
              <input
                value={form.camp_id}
                onChange={e => setForm({...form, camp_id: e.target.value})}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">PIN (optional)</label>
              <input
                value={form.pin}
                onChange={e => setForm({...form, pin: e.target.value})}
                placeholder="4-digit PIN"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create User'}
          </button>
        </form>
      )}

      {/* User List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Username</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Camp</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">PIN</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                {currentUser?.role === 'admin' && (
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Action</th>
                )}
              </tr>
            </thead>
            <tbody>
              {userList.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {u.role?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.camp_code || 'HO'}</td>
                  <td className="px-4 py-3 text-center">
                    {u.pin_enabled ? '✅' : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={u.is_active ? 'success' : 'danger'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  {currentUser?.role === 'admin' && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(u)}
                        className={`text-xs px-3 py-1 rounded-full ${
                          u.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {userList.map(u => (
            <div key={u.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.username} · {u.camp_code || 'HO'}</p>
                </div>
                <Badge variant={u.is_active ? 'success' : 'danger'}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {u.role?.replace(/_/g, ' ')}
                </span>
                {u.pin_enabled && <span className="text-xs text-gray-400">PIN enabled</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">{userList.length} users total</p>
    </div>
  )
}
