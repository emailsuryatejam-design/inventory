/**
 * WebSquare — IndexedDB Offline Storage
 * Provides API response caching, sync queue management, and receipt storage
 */

const DB_NAME = 'ws_offline'
const DB_VERSION = 2 // v2: added receipts store

let dbInstance = null

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // Cache store: keyed by endpoint URL
      if (!db.objectStoreNames.contains('apiCache')) {
        db.createObjectStore('apiCache', { keyPath: 'key' })
      }

      // Sync queue: auto-increment, ordered by timestamp
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }

      // Receipts store: for offline reprint capability (v2)
      if (!db.objectStoreNames.contains('receipts')) {
        const store = db.createObjectStore('receipts', { keyPath: 'id', autoIncrement: true })
        store.createIndex('voucher_number', 'voucher_number', { unique: true })
        store.createIndex('created_at', 'created_at', { unique: false })
      }
    }

    request.onsuccess = () => {
      dbInstance = request.result
      // Handle version change (e.g., another tab triggers upgrade)
      dbInstance.onversionchange = () => {
        dbInstance.close()
        dbInstance = null
      }
      resolve(dbInstance)
    }

    request.onerror = () => reject(request.error)
  })
}

// ── API Cache ─────────────────────────────────────

export async function getCached(key) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('apiCache', 'readonly')
      const store = tx.objectStore('apiCache')
      const req = store.get(key)
      req.onsuccess = () => {
        const record = req.result
        if (!record) return resolve(null)

        // Check TTL
        if (record.expiresAt && Date.now() > record.expiresAt) {
          // Expired, but still return stale data (caller decides)
          resolve({ data: record.data, stale: true, timestamp: record.timestamp })
        } else {
          resolve({ data: record.data, stale: false, timestamp: record.timestamp })
        }
      }
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function setCached(key, data, ttlMinutes = 30) {
  try {
    const db = await openDB()
    const tx = db.transaction('apiCache', 'readwrite')
    const store = tx.objectStore('apiCache')
    store.put({
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
    })
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

export async function clearExpiredCache() {
  try {
    const db = await openDB()
    const tx = db.transaction('apiCache', 'readwrite')
    const store = tx.objectStore('apiCache')
    const req = store.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        if (cursor.value.expiresAt && Date.now() > cursor.value.expiresAt) {
          cursor.delete()
        }
        cursor.continue()
      }
    }
  } catch { /* ignore */ }
}

export async function clearAllCache() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('apiCache', 'readwrite')
      tx.objectStore('apiCache').clear()
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

export async function getCacheStats() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('apiCache', 'readonly')
      const store = tx.objectStore('apiCache')
      const req = store.count()
      req.onsuccess = () => resolve({ entries: req.result || 0 })
      req.onerror = () => resolve({ entries: 0 })
    })
  } catch {
    return { entries: 0 }
  }
}

// ── Sync Queue ────────────────────────────────────

export async function addToQueue(operation) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite')
      const store = tx.objectStore('syncQueue')
      const req = store.add({
        ...operation,
        timestamp: Date.now(),
        retries: 0,
        status: 'pending', // pending | syncing | failed
      })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.error('Failed to add to sync queue:', e)
    throw e
  }
}

export async function getQueue() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('syncQueue', 'readonly')
      const store = tx.objectStore('syncQueue')
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

export async function getQueueCount() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('syncQueue', 'readonly')
      const store = tx.objectStore('syncQueue')
      const req = store.count()
      req.onsuccess = () => resolve(req.result || 0)
      req.onerror = () => resolve(0)
    })
  } catch {
    return 0
  }
}

export async function removeFromQueue(id) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('syncQueue', 'readwrite')
      const store = tx.objectStore('syncQueue')
      store.delete(id)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

export async function updateQueueItem(id, updates) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('syncQueue', 'readwrite')
      const store = tx.objectStore('syncQueue')
      const getReq = store.get(id)
      getReq.onsuccess = () => {
        if (getReq.result) {
          store.put({ ...getReq.result, ...updates })
        }
      }
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

export async function clearQueue() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('syncQueue', 'readwrite')
      const store = tx.objectStore('syncQueue')
      store.clear()
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

// ── Receipts ──────────────────────────────────────

export async function saveReceipt(receipt) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('receipts', 'readwrite')
      const store = tx.objectStore('receipts')
      store.put({
        ...receipt,
        created_at: receipt.created_at || Date.now(),
      })
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

export async function getReceipts(limit = 50) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('receipts', 'readonly')
      const store = tx.objectStore('receipts')
      const index = store.index('created_at')
      const req = index.openCursor(null, 'prev') // newest first
      const results = []
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor && results.length < limit) {
          results.push(cursor.value)
          cursor.continue()
        } else {
          resolve(results)
        }
      }
      req.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

export async function getReceiptByVoucher(voucherNumber) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('receipts', 'readonly')
      const store = tx.objectStore('receipts')
      const index = store.index('voucher_number')
      const req = index.get(voucherNumber)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

// ── Pre-cache Critical Data ───────────────────────

export async function precacheCriticalData() {
  try {
    // Dynamic import to avoid circular dependency (api.js imports offlineDb.js)
    const api = await import('./api')

    // Fire all requests in parallel — api.js caches responses automatically
    await Promise.allSettled([
      api.pos.categories(),
      api.pos.items({ limit: 200 }),
      api.menu.categories(),
      api.menu.items({}),
      api.items.list({ limit: 200 }),
    ])
    console.log('[offlineDb] Critical data pre-cached for offline use')
  } catch (e) {
    console.warn('[offlineDb] Pre-cache partial failure:', e)
  }
}
