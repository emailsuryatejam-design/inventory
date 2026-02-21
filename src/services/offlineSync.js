/**
 * WebSquare — Offline Sync Manager
 * Flushes queued operations when connectivity returns
 */

import { getQueue, removeFromQueue, updateQueueItem, getQueueCount } from './offlineDb'
import { rawRequest } from './api'

const MAX_RETRIES = 5
let isSyncing = false

function emit(event, detail = {}) {
  window.dispatchEvent(new CustomEvent(event, { detail }))
}

export async function flushQueue() {
  if (isSyncing) return
  if (!navigator.onLine) return

  const queue = await getQueue()
  const pending = queue.filter(item => item.status !== 'failed')
  if (pending.length === 0) return

  isSyncing = true
  emit('sync:start', { count: pending.length })

  let synced = 0
  let failed = 0

  for (const item of pending) {
    if (!navigator.onLine) break

    try {
      await updateQueueItem(item.id, { status: 'syncing' })

      await rawRequest(item.endpoint, {
        method: item.method,
        body: item.body || undefined,
        headers: item.headers || {},
      })

      await removeFromQueue(item.id)
      synced++
      emit('sync:item-synced', { id: item.id, synced, total: pending.length })
    } catch (error) {
      const retries = (item.retries || 0) + 1
      if (retries >= MAX_RETRIES) {
        await updateQueueItem(item.id, { status: 'failed', retries, lastError: error.message })
        failed++
      } else {
        await updateQueueItem(item.id, { status: 'pending', retries, lastError: error.message })
      }
      emit('sync:error', { id: item.id, error: error.message, retries })
    }
  }

  isSyncing = false
  emit('sync:complete', { synced, failed, remaining: await getQueueCount() })
}

export function startSyncListener() {
  window.addEventListener('online', () => {
    setTimeout(flushQueue, 1000)
  })

  if (navigator.onLine) {
    setTimeout(flushQueue, 2000)
  }
}

export function isSyncInProgress() {
  return isSyncing
}
