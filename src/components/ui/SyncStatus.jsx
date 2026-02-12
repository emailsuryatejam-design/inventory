import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'

export default function SyncStatus() {
  const { isOnline, pendingSyncCount, syncState } = useOnlineStatus()

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded-lg" title="You're offline">
        <WifiOff size={16} className="text-red-500" />
        <span className="text-xs font-medium text-red-600 hidden sm:inline">Offline</span>
      </div>
    )
  }

  if (syncState === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-lg" title="Syncing...">
        <RefreshCw size={16} className="text-amber-500 animate-spin" />
        <span className="text-xs font-medium text-amber-600 hidden sm:inline">Syncing</span>
      </div>
    )
  }

  if (pendingSyncCount > 0) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-lg" title={`${pendingSyncCount} pending`}>
        <div className="relative">
          <Wifi size={16} className="text-amber-500" />
          <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center">
            <span className="text-[9px] font-bold text-white">{pendingSyncCount > 9 ? '9+' : pendingSyncCount}</span>
          </span>
        </div>
        <span className="text-xs font-medium text-amber-600 hidden sm:inline">{pendingSyncCount} pending</span>
      </div>
    )
  }

  if (syncState === 'done') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-lg" title="All synced">
        <Wifi size={16} className="text-green-500" />
        <span className="text-xs font-medium text-green-600 hidden sm:inline">Synced</span>
      </div>
    )
  }

  return null
}
