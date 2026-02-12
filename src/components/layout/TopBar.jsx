import { useUser, useApp, isManager } from '../../context/AppContext'
import { Bell, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import SyncStatus from '../ui/SyncStatus'

export default function TopBar() {
  const user = useUser()
  const { state, dispatch } = useApp()
  const [showCampPicker, setShowCampPicker] = useState(false)

  const selectedCamp = state.camps.find(c => c.id === state.selectedCampId)

  function selectCamp(campId) {
    dispatch({ type: 'SELECT_CAMP', payload: campId })
    setShowCampPicker(false)
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 h-14 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Camp selector or camp name */}
      <div className="flex items-center gap-3">
        {/* Mobile logo (hidden on desktop where sidebar shows it) */}
        <div className="lg:hidden w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xs">KC</span>
        </div>

        {isManager(user?.role) && state.camps.length > 0 ? (
          <div className="relative">
            <button
              onClick={() => setShowCampPicker(!showCampPicker)}
              data-guide="camp-selector"
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-sm font-medium text-gray-700"
            >
              {selectedCamp ? selectedCamp.name : 'All Camps'}
              <ChevronDown size={16} />
            </button>
            {showCampPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCampPicker(false)} />
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px]">
                  <button
                    onClick={() => selectCamp(null)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${
                      !state.selectedCampId ? 'text-green-600 font-medium' : 'text-gray-700'
                    }`}
                  >
                    All Camps
                  </button>
                  {state.camps.map(camp => (
                    <button
                      key={camp.id}
                      onClick={() => selectCamp(camp.id)}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${
                        state.selectedCampId === camp.id ? 'text-green-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {camp.code} — {camp.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <span className="text-sm font-medium text-gray-700">
            {user?.camp_name || 'KCL Stores'}
          </span>
        )}
      </div>

      {/* Right: Sync status + Notifications + User */}
      <div className="flex items-center gap-3">
        <SyncStatus />
        <button data-guide="notifications-btn" className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition">
          <Bell size={20} />
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-700 font-medium text-xs">
              {user?.name?.charAt(0) || '?'}
            </span>
          </div>
          <span className="text-sm text-gray-700 font-medium">{user?.name}</span>
        </div>
      </div>
    </header>
  )
}
