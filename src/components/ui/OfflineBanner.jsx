import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { WifiOff, RefreshCw, Check } from 'lucide-react'

export default function OfflineBanner() {
  const { isOnline, pendingSyncCount, syncState } = useOnlineStatus()

  if (syncState === 'done') {
    return (
      <div className="bg-green-50 border-b border-green-200 px-4 py-2 flex items-center justify-center gap-2">
        <Check size={16} className="text-green-600" />
        <span className="text-sm text-green-700 font-medium">All changes synced</span>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-2">
        <WifiOff size={16} className="text-amber-600" />
        <span className="text-sm text-amber-700 font-medium">
          You're offline — changes will sync when connected
          {pendingSyncCount > 0 && ` (${pendingSyncCount} pending)`}
        </span>
      </div>
    )
  }

  if (syncState === 'syncing') {
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-center gap-2">
        <RefreshCw size={16} className="text-blue-600 animate-spin" />
        <span className="text-sm text-blue-700 font-medium">
          Syncing {pendingSyncCount} item{pendingSyncCount !== 1 ? 's' : ''}...
        </span>
      </div>
    )
  }

  return null
}
