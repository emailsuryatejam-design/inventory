/**
 * KCL Stores — API Client
 * Handles all HTTP requests to the PHP backend
 * With offline caching and sync queue support
 */

import { getCached, setCached, addToQueue } from './offlineDb'

// In dev, Vite proxy forwards /api → localhost:8000
// In production, points to the Hostinger API domain
const BASE_URL = import.meta.env.DEV
  ? '/api'
  : 'https://darkblue-goshawk-672880.hostingersite.com'

function getToken() {
  return localStorage.getItem('kcl_token')
}

// ── In-memory cache (instant, sync) ─────────────────
// Eliminates loading spinners on tab switches by returning
// data synchronously from RAM before the async fetch completes
const memCache = new Map()
const MAX_MEM_ENTRIES = 80

function memGet(key) {
  const entry = memCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key)
    return { data: entry.data, stale: true }
  }
  return { data: entry.data, stale: false }
}

function memSet(key, data, ttlMinutes) {
  if (memCache.size >= MAX_MEM_ENTRIES) {
    const oldest = memCache.keys().next().value
    memCache.delete(oldest)
  }
  memCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
  })
}

function memInvalidate(endpoint) {
  const base = endpoint.split('?')[0].replace(/-detail|-approve|-reject|-query/, '')
  for (const key of memCache.keys()) {
    if (key.includes(base)) memCache.delete(key)
  }
  // Writes affect dashboard counts + alerts
  for (const key of memCache.keys()) {
    if (key.includes('dashboard.php') || key.includes('alerts.php')) memCache.delete(key)
  }
}

// ── Offline helpers ─────────────────────────────────

// Endpoints that must never be cached or queued
const NO_OFFLINE = ['auth-login.php', 'auth-pin-login.php', 'auth-me.php']

// Endpoints that should never be queued (need live server)
const NO_QUEUE = ['recipes.php', 'reports.php', 'debug-schema.php']

// Cache TTL by endpoint pattern (minutes)
function getCacheTTL(endpoint) {
  if (endpoint.includes('pos.php?action=categories')) return 60
  if (endpoint.includes('menu.php?action=categories')) return 60
  if (endpoint.includes('items.php')) return 30
  if (endpoint.includes('dashboard.php')) return 30
  if (endpoint.includes('stock')) return 30
  if (endpoint.includes('users.php') && !endpoint.includes('?id=')) return 30
  if (endpoint.includes('orders.php')) return 15
  if (endpoint.includes('dispatch.php')) return 15
  if (endpoint.includes('receive.php')) return 15
  if (endpoint.includes('issue.php')) return 15
  if (endpoint.includes('daily-overview.php')) return 15
  if (endpoint.includes('pos.php')) return 15
  if (endpoint.includes('menu.php')) return 15
  if (endpoint.includes('alerts.php')) return 5
  if (endpoint.includes('detail')) return 10
  return 15 // default
}

function isOnline() {
  return navigator.onLine
}

function shouldSkipOffline(endpoint) {
  return NO_OFFLINE.some(e => endpoint.includes(e))
}

function shouldSkipQueue(endpoint) {
  return NO_QUEUE.some(e => endpoint.includes(e)) || shouldSkipOffline(endpoint)
}

// ── Core request function ───────────────────────────

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}/${endpoint}`
  const token = getToken()
  const method = (options.method || 'GET').toUpperCase()

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  }

  // ── Writes: invalidate memory cache + handle offline queue ──
  if (method === 'POST' || method === 'PUT') {
    memInvalidate(endpoint)

    if (!isOnline() && !shouldSkipOffline(endpoint)) {
      if (shouldSkipQueue(endpoint)) {
        throw new Error('This action requires an internet connection.')
      }

      await addToQueue({
        endpoint,
        method,
        body: options.body || null,
        headers: config.headers,
      })

      return {
        success: true,
        _offline: true,
        _queued_at: Date.now(),
        message: 'Saved offline. Will sync when connected.',
      }
    }
  }

  // ── GETs: check in-memory cache first (instant) ──
  if (method === 'GET' && !shouldSkipOffline(endpoint)) {
    const mem = memGet(endpoint)
    if (mem && !mem.stale) {
      // Fresh memory cache — return instantly, skip network
      return mem.data
    }

    if (mem && mem.stale) {
      // Stale memory cache — return instantly, refresh in background
      fetchAndCache(endpoint, url, config).catch(() => {})
      return mem.data
    }
  }

  // ── No memory hit: fetch from network ──
  return fetchAndCache(endpoint, url, config, method)
}

// Separated fetch logic for reuse by stale-while-revalidate
async function fetchAndCache(endpoint, url, config, method = 'GET') {
  try {
    const response = await fetch(url, config)

    if (response.status === 401 && !endpoint.includes('auth-login')) {
      localStorage.removeItem('kcl_token')
      localStorage.removeItem('kcl_stores')
      window.location.hash = '#/login'
      throw new Error('Session expired. Please login again.')
    }

    const text = await response.text()
    let data
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      console.error('API response not valid JSON:', text.substring(0, 200))
      throw new Error('Server returned an invalid response. Please try again.')
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed (${response.status})`)
    }

    // Cache in both memory (instant) and IndexedDB (persistent)
    if (method === 'GET' && !shouldSkipOffline(endpoint)) {
      const ttl = getCacheTTL(endpoint)
      memSet(endpoint, data, ttl)
      setCached(endpoint, data, ttl).catch(() => {})
    }

    return data
  } catch (error) {
    // Offline fallback: try IndexedDB cache
    if (method === 'GET' && !shouldSkipOffline(endpoint)) {
      const cached = await getCached(endpoint)
      if (cached) {
        // Also warm memory cache from IndexedDB
        memSet(endpoint, cached.data, cached.stale ? 0.5 : getCacheTTL(endpoint))
        return { ...cached.data, _cached: true, _cached_at: cached.timestamp }
      }
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection.')
    }
    throw error
  }
}

// ── Raw request for sync (bypasses caching/queuing) ──
export async function rawRequest(endpoint, options = {}) {
  const url = `${BASE_URL}/${endpoint}`
  const token = getToken()

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  }

  const response = await fetch(url, config)
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`)
  }

  return data
}

// ── Auth ────────────────────────────────────────────
export const auth = {
  login: (username, password) =>
    request('auth-login.php', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  pinLogin: (username, pin) =>
    request('auth-pin-login.php', {
      method: 'POST',
      body: JSON.stringify({ username, pin }),
    }),

  me: () => request('auth-me.php'),
}

// ── Dashboard ───────────────────────────────────────
export const dashboard = {
  get: (campId) =>
    request(`dashboard.php${campId ? `?camp_id=${campId}` : ''}`),
}

// ── Items ───────────────────────────────────────────
export const items = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`items.php${qs ? `?${qs}` : ''}`)
  },

  get: (id) => request(`items-detail.php?id=${id}`),
}

// ── Stock ───────────────────────────────────────────
export const stock = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`stock.php${qs ? `?${qs}` : ''}`)
  },

  camp: (campId, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`stock-camp.php?camp_id=${campId}${qs ? `&${qs}` : ''}`)
  },
}

// ── Orders ──────────────────────────────────────────
export const orders = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`orders.php${qs ? `?${qs}` : ''}`)
  },

  get: (id) => request(`orders-detail.php?id=${id}`),

  create: (data) =>
    request('orders.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request('orders-detail.php', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    }),

  approve: (id, lines) =>
    request('orders-approve.php', {
      method: 'PUT',
      body: JSON.stringify({ order_id: id, lines }),
    }),

  reject: (id, reason) =>
    request('orders-reject.php', {
      method: 'PUT',
      body: JSON.stringify({ order_id: id, reason }),
    }),

  query: (id, message, lineId = null) =>
    request('orders-query.php', {
      method: 'POST',
      body: JSON.stringify({ order_id: id, message, order_line_id: lineId }),
    }),
}

// ── Dispatch ────────────────────────────────────────
export const dispatch = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`dispatch.php${qs ? `?${qs}` : ''}`)
  },

  get: (id) => request(`dispatch-detail.php?id=${id}`),

  create: (data) =>
    request('dispatch.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request('dispatch-detail.php', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    }),
}

// ── Receive ─────────────────────────────────────────
export const receive = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`receive.php${qs ? `?${qs}` : ''}`)
  },

  get: (id) => request(`receive-detail.php?id=${id}`),

  create: (data) =>
    request('receive.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  confirm: (id, lines) =>
    request('receive-detail.php', {
      method: 'PUT',
      body: JSON.stringify({ id, lines }),
    }),
}

// ── Issue Vouchers ──────────────────────────────────
export const issue = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`issue.php${qs ? `?${qs}` : ''}`)
  },

  get: (id) => request(`issue-detail.php?id=${id}`),

  create: (data) =>
    request('issue.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ── Alerts & Projections ───────────────────────────
export const alerts = {
  summary: (campId) =>
    request(`alerts.php?type=summary${campId ? `&camp_id=${campId}` : ''}`),

  lowStock: (campId) =>
    request(`alerts.php?type=low_stock${campId ? `&camp_id=${campId}` : ''}`),

  projections: (days = 14, campId) =>
    request(`alerts.php?type=projections&days=${days}${campId ? `&camp_id=${campId}` : ''}`),

  deadStock: (minDays = 60, campId) =>
    request(`alerts.php?type=dead_stock&min_days=${minDays}${campId ? `&camp_id=${campId}` : ''}`),

  excess: (campId) =>
    request(`alerts.php?type=excess${campId ? `&camp_id=${campId}` : ''}`),
}

// ── Reports ─────────────────────────────────────────
export const reports = {
  get: (type, params = {}) => {
    const qs = new URLSearchParams({ type, ...params }).toString()
    return request(`reports.php?${qs}`)
  },
}

// ── Users (Admin) ───────────────────────────────────
export const users = {
  list: () => request('users.php'),

  create: (data) =>
    request('users.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request(`users.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}

// ── POS (Point of Sale) ────────────────────────────
export const pos = {
  categories: () => request('pos.php?action=categories'),

  items: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`pos.php?action=items${qs ? `&${qs}` : ''}`)
  },

  recent: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`pos.php?action=recent${qs ? `&${qs}` : ''}`)
  },

  today: () => request('pos.php?action=today'),

  create: (data) =>
    request('pos.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ── Recipes (Gemini AI) ────────────────────────────
export const recipes = {
  generate: (data) =>
    request('recipes.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  ingredients: () => request('recipes.php?action=ingredients'),
}

// ── Bar Menu ──────────────────────────────────────
export const menu = {
  categories: () => request('menu.php?action=categories'),

  items: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`menu.php?action=items${qs ? `&${qs}` : ''}`)
  },

  item: (id) => request(`menu.php?action=item&id=${id}`),

  suggestAlternatives: (ingredient, drink) => {
    const params = new URLSearchParams({ ingredient, drink: drink || '' })
    return request(`menu.php?action=suggest_alternatives&${params}`)
  },

  searchIngredients: (q) => request(`menu.php?action=search_ingredients&q=${encodeURIComponent(q)}`),

  stockStatus: () => request('menu.php?action=stock_status'),

  depletion: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`menu.php?action=depletion${qs ? `&${qs}` : ''}`)
  },

  order: (data) =>
    request('menu.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ── Kitchen Recipes & Preferences ─────────────────
export const kitchen = {
  recipes: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`kitchen.php?action=recipes${qs ? `&${qs}` : ''}`)
  },

  recipe: (id) => request(`kitchen.php?action=recipe&id=${id}`),

  searchRecipes: (q) => request(`kitchen.php?action=search_recipes&q=${encodeURIComponent(q)}`),

  suggestRecipe: (itemNames) => request(`kitchen.php?action=suggest_recipe&items=${encodeURIComponent(itemNames)}`),

  suggestAlternatives: (ingredient, dish) => {
    const params = new URLSearchParams({ ingredient, dish: dish || '' })
    return request(`kitchen.php?action=suggest_alternatives&${params}`)
  },

  searchIngredients: (q) => request(`kitchen.php?action=search_ingredients&q=${encodeURIComponent(q)}`),

  saveRecipe: (data) =>
    request('kitchen.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'save_recipe', ...data }),
    }),

  logPattern: (items, source, referenceId) =>
    request('kitchen.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'log_pattern', items, source, reference_id: referenceId }),
    }),

  preferences: (type) => {
    const qs = type ? `&type=${type}` : ''
    return request(`kitchen.php?action=preferences${qs}`)
  },

  suggestedItems: (context = 'issue') =>
    request(`kitchen.php?action=suggested_items&context=${context}`),

  learn: () =>
    request('kitchen.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'learn' }),
    }),
}

// ── Daily Overview ─────────────────────────────────
export const dailyOverview = {
  get: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`daily-overview.php${qs ? `?${qs}` : ''}`)
  },
}

// ── Health Check ────────────────────────────────────
export const health = {
  check: () => request('health.php'),
}
