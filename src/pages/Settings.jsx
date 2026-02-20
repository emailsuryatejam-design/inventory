import { useState, useEffect } from 'react'
import { useUser, useApp, useSelectedCamp, isManager } from '../context/AppContext'
import { rawRequest } from '../services/api'
import { User, Building2, Shield, LogOut, ChevronDown, Blocks, Loader2, Lock } from 'lucide-react'
import { useToast } from '../components/ui/Toast'

export default function Settings() {
  const user = useUser()
  const { dispatch } = useApp()
  const { campId, camps } = useSelectedCamp()
  const manager = isManager(user?.role)
  const isAdmin = ['admin', 'director'].includes(user?.role)
  const toast = useToast()

  function handleLogout() {
    localStorage.removeItem('kcl_token')
    localStorage.removeItem('kcl_stores')
    window.location.hash = '#/login'
    window.location.reload()
  }

  function handleCampChange(e) {
    const newCampId = parseInt(e.target.value) || null
    dispatch({ type: 'SELECT_CAMP', payload: newCampId })
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
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
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
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

      {/* App Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h3 className="font-semibold text-gray-900 mb-3">About</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Application</span>
            <span className="text-gray-900 font-medium">KCL Stores</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Version</span>
            <span className="text-gray-900 font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Organisation</span>
            <span className="text-gray-900 font-medium">Karibu Camps Limited</span>
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
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
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
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
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
