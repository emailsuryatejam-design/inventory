import { useState } from 'react'
import { useUser, useApp, useSelectedCamp, isManager } from '../context/AppContext'
import { User, Building2, Shield, LogOut, ChevronDown } from 'lucide-react'

export default function Settings() {
  const user = useUser()
  const { dispatch } = useApp()
  const { campId, camps } = useSelectedCamp()
  const manager = isManager(user?.role)

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
