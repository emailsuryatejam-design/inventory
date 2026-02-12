import { useState, useEffect, useCallback } from 'react'
import { getQueueCount } from '../services/offlineDb'
import { flushQueue } from '../services/offlineSync'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [syncState, setSyncState] = useState('idle') // idle | syncing | done | error

  const refreshCount = useCallback(async () => {
    const count = await getQueueCount()
    setPendingSyncCount(count)
  }, [])

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true)
      flushQueue()
    }
    const goOffline = () => setIsOnline(false)

    const onSyncStart = () => setSyncState('syncing')
    const onSyncComplete = (e) => {
      setSyncState(e.detail.synced > 0 ? 'done' : 'idle')
      refreshCount()
      if (e.detail.synced > 0) {
        setTimeout(() => setSyncState('idle'), 3000)
      }
    }
    const onSyncError = () => setSyncState('error')
    const onItemSynced = () => refreshCount()

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener('sync:start', onSyncStart)
    window.addEventListener('sync:complete', onSyncComplete)
    window.addEventListener('sync:error', onSyncError)
    window.addEventListener('sync:item-synced', onItemSynced)

    refreshCount()
    const interval = setInterval(refreshCount, 5000)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('sync:start', onSyncStart)
      window.removeEventListener('sync:complete', onSyncComplete)
      window.removeEventListener('sync:error', onSyncError)
      window.removeEventListener('sync:item-synced', onItemSynced)
      clearInterval(interval)
    }
  }, [refreshCount])

  return { isOnline, pendingSyncCount, syncState }
}
