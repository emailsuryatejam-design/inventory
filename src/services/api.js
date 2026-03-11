/**
 * WebSquare — API Client
 * Handles all HTTP requests to the PHP backend
 * With offline caching and sync queue support
 */

import { getCached, setCached, addToQueue } from './offlineDb'

// In dev, Vite proxy forwards /api → localhost:8000
// In production, same-origin /api (websquare.pro/api/)
const BASE_URL = import.meta.env.VITE_API_URL || '/api'

function getToken() {
  return localStorage.getItem('ws_token')
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
  // GRN confirm affects stock data
  if (endpoint.includes('grn.php')) {
    for (const key of memCache.keys()) {
      if (key.includes('stock')) memCache.delete(key)
    }
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
  if (endpoint.includes('item-groups.php')) return 60
  if (endpoint.includes('uom.php')) return 60
  if (endpoint.includes('suppliers.php')) return 15
  if (endpoint.includes('item-suppliers.php')) return 15
  if (endpoint.includes('stock-adjustments.php')) return 10
  if (endpoint.includes('purchase-orders.php')) return 15
  if (endpoint.includes('grn.php')) return 15
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
  if (endpoint.includes('bar-tabs.php')) return 5
  if (endpoint.includes('bar-shifts.php')) return 10
  if (endpoint.includes('bar-reports.php')) return 15
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

  // For FormData uploads, don't set Content-Type (browser adds boundary)
  const isFormData = options.isFormData || options.body instanceof FormData
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const { isFormData: _drop, ...restOptions } = options
  const config = {
    headers,
    ...restOptions,
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
      localStorage.removeItem('ws_token')
      localStorage.removeItem('ws_state')
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

  create: (data) =>
    request('items.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request('items.php', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    }),

  deactivate: (id) =>
    request(`items.php?id=${id}`, { method: 'DELETE' }),
}

// ── Item Groups & UOMs ─────────────────────────────
export const itemGroups = {
  list: () => request('item-groups.php'),
  create: (data) =>
    request('item-groups.php', { method: 'POST', body: JSON.stringify(data) }),
}

export const uom = {
  list: () => request('uom.php'),
  create: (data) =>
    request('uom.php', { method: 'POST', body: JSON.stringify(data) }),
}

// ── Suppliers ──────────────────────────────────────
export const suppliers = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`suppliers.php${qs ? `?${qs}` : ''}`)
  },
  get: (id) => request(`suppliers.php?id=${id}`),
  create: (data) =>
    request('suppliers.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    request('suppliers.php', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deactivate: (id) =>
    request(`suppliers.php?id=${id}`, { method: 'DELETE' }),
}

// ── Item-Supplier Links ────────────────────────────
export const itemSuppliers = {
  forItem: (itemId) => request(`item-suppliers.php?item_id=${itemId}`),
  forSupplier: (supplierId) => request(`item-suppliers.php?supplier_id=${supplierId}`),
  link: (data) =>
    request('item-suppliers.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    request('item-suppliers.php', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  remove: (id) =>
    request(`item-suppliers.php?id=${id}`, { method: 'DELETE' }),
}

// ── Stock Adjustments ──────────────────────────────
export const stockAdjustments = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`stock-adjustments.php${qs ? `?${qs}` : ''}`)
  },
  get: (id) => request(`stock-adjustments.php?id=${id}`),
  create: (data) =>
    request('stock-adjustments.php', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id) =>
    request('stock-adjustments.php', { method: 'PUT', body: JSON.stringify({ id, action: 'approve' }) }),
  reject: (id) =>
    request('stock-adjustments.php', { method: 'PUT', body: JSON.stringify({ id, action: 'reject' }) }),
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

  deleteRecipe: (id) =>
    request('kitchen.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete_recipe', id }),
    }),
}

// ── Kitchen Menu Planning ──────────────────────────
export const kitchenMenu = {
  // Combined: plan + recipes in one call (saves a full round-trip)
  // api.js memCache handles instant returns for cached data
  chefInit: (date, meal) =>
    request(`kitchen-menu.php?action=chef_init&date=${date}&meal=${meal}`),

  // Get single plan by date + meal
  plan: (date, meal) =>
    request(`kitchen-menu.php?action=plan&date=${date}&meal=${meal}`),

  // List plans for a month (YYYY-MM)
  plans: (month) =>
    request(`kitchen-menu.php?action=plans&month=${month}`),

  // Get audit trail for a plan
  audit: (planId) =>
    request(`kitchen-menu.php?action=audit&plan_id=${planId}`),

  // Get recipe ingredients scaled to portions
  recipeIngredients: (recipeId, portions) =>
    request(`kitchen-menu.php?action=recipe_ingredients&recipe_id=${recipeId}&portions=${portions || 0}`),

  // Search stock items for manual ingredient add
  searchItems: (q) =>
    request(`kitchen-menu.php?action=search_items&q=${encodeURIComponent(q)}`),

  // Create a new menu plan
  createPlan: (date, meal, portions) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'create_plan', date, meal, portions }),
    }),

  // Add a dish to a plan (optionally linked to recipe)
  addDish: (planId, course, dishName, portions, recipeId) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'add_dish', plan_id: planId, course, dish_name: dishName, portions, recipe_id: recipeId || null }),
    }),

  // Remove a dish
  removeDish: (dishId) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'remove_dish', dish_id: dishId }),
    }),

  // Load recipe ingredients into a dish
  loadRecipe: (dishId, recipeId, portions) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'load_recipe', dish_id: dishId, recipe_id: recipeId, portions }),
    }),

  // Rate dish presentation (photo upload + AI scoring)
  ratePresentation: (dishId, photoUrl) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'rate_presentation', dish_id: dishId, photo_url: photoUrl }),
    }),

  // Upload dish photo (returns URL)
  uploadDishPhoto: (file) => {
    const formData = new FormData()
    formData.append('photo', file)
    return request('upload-dish-photo.php', {
      method: 'POST',
      body: formData,
      isFormData: true,
    })
  },

  // Add a manual ingredient
  addIngredient: (dishId, itemId, qty, uom) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'add_ingredient', dish_id: dishId, item_id: itemId, qty, uom }),
    }),

  // Remove an ingredient
  removeIngredient: (ingredientId, reason) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'remove_ingredient', ingredient_id: ingredientId, reason }),
    }),

  // Update ingredient quantity
  updateQty: (ingredientId, qty) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'update_qty', ingredient_id: ingredientId, qty }),
    }),

  // Update portions count per dish
  updatePortions: (dishId, portions) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'update_portions', dish_id: dishId, portions }),
    }),

  // Update total pax (covers) for a meal plan
  updatePlanPax: (planId, pax) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'update_plan_pax', plan_id: planId, pax }),
    }),

  // Confirm plan
  confirmPlan: (planId) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'confirm_plan', plan_id: planId }),
    }),

  // Reopen plan
  reopenPlan: (planId) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'reopen_plan', plan_id: planId }),
    }),

  // Weekly ingredients (aggregated non-primary for a week)
  weeklyIngredients: (weekStart) =>
    request(`kitchen-menu.php?action=weekly_ingredients&week_start=${weekStart}`),

  // Update daily tracking (ordered/received/consumed)
  updateDailyTracking: (ingredientId, data) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'update_daily_tracking', ingredient_id: ingredientId, ...data }),
    }),

  // Update weekly grocery tracking (ordered/received)
  updateWeeklyGrocery: (weekStart, itemId, data) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'update_weekly_grocery', week_start: weekStart, item_id: itemId, ...data }),
    }),

  // Add manual weekly grocery item
  addWeeklyGrocery: (weekStart, itemId, projectedQty) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'add_weekly_grocery', week_start: weekStart, item_id: itemId, projected_qty: projectedQty }),
    }),

  // Update stock balance (physical count)
  updateStock: (itemId, qty) =>
    request('kitchen-menu.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'update_stock', item_id: itemId, qty }),
    }),

  // View default menu template for a specific day + meal
  defaultMenu: (day, meal) =>
    request(`kitchen-menu.php?action=default_menu&day=${day}&meal=${meal}`),
}

// ── Purchase Orders ──────────────────────────────────
export const purchaseOrders = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`purchase-orders.php${qs ? `?${qs}` : ''}`)
  },

  get: (id) => request(`purchase-orders.php?id=${id}`),

  create: (data) =>
    request('purchase-orders.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request('purchase-orders.php', {
      method: 'PUT',
      body: JSON.stringify({ id, action: 'update', ...data }),
    }),

  approve: (id) =>
    request('purchase-orders.php', {
      method: 'PUT',
      body: JSON.stringify({ id, action: 'approve' }),
    }),

  send: (id) =>
    request('purchase-orders.php', {
      method: 'PUT',
      body: JSON.stringify({ id, action: 'send' }),
    }),

  cancel: (id) =>
    request('purchase-orders.php', {
      method: 'PUT',
      body: JSON.stringify({ id, action: 'cancel' }),
    }),
}

// ── Goods Received Notes ─────────────────────────────
export const grn = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`grn.php${qs ? `?${qs}` : ''}`)
  },

  get: (id) => request(`grn.php?id=${id}`),

  poLines: (poId) => request(`grn.php?po_id=${poId}`),

  create: (data) =>
    request('grn.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  confirm: (id) =>
    request('grn.php', {
      method: 'PUT',
      body: JSON.stringify({ id, action: 'confirm' }),
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

// ── Settings ───────────────────────────────────────
export const settings = {
  get: (keys = []) => {
    const qs = keys.length ? `?keys=${keys.join(',')}` : ''
    return request(`settings.php${qs}`)
  },

  save: (data) =>
    request('settings.php', {
      method: 'POST',
      body: JSON.stringify({ settings: data }),
    }),
}

// ── Data Import / Export ──────────────────────────
export const dataExport = {
  items: () => downloadCSV('export.php?type=items'),
  suppliers: () => downloadCSV('export.php?type=suppliers'),
  stock: (campId) => downloadCSV(`export.php?type=stock${campId ? `&camp_id=${campId}` : ''}`),
  template: (entity) => downloadCSV(`export.php?type=template&entity=${entity}`),
}

export const dataImport = {
  validate: (file, entity) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('entity', entity)
    formData.append('mode', 'validate')
    return request('import.php', {
      method: 'POST',
      body: formData,
      isFormData: true,
    })
  },

  execute: (file, entity) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('entity', entity)
    formData.append('mode', 'import')
    return request('import.php', {
      method: 'POST',
      body: formData,
      isFormData: true,
    })
  },
}

// Helper: trigger file download via fetch + blob
async function downloadCSV(endpoint) {
  const url = `${BASE_URL}/${endpoint}`
  const token = getToken()
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    // Try to parse error JSON
    try {
      const err = await response.json()
      throw new Error(err.message || 'Download failed')
    } catch {
      throw new Error(`Download failed (${response.status})`)
    }
  }
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const filename = disposition.match(/filename="(.+)"/)?.[1] || 'export.csv'

  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}

// ── Payroll & HR ───────────────────────────────────
export const hrDashboard = {
  get: () => request('payroll-dashboard.php'),
}

export const departments = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`departments.php${qs ? `?${qs}` : ''}`)
  },
  create: (data) => request('departments.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request('departments.php', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  remove: (id) => request(`departments.php?id=${id}`, { method: 'DELETE' }),
}

export const jobGrades = {
  list: () => request('job-grades.php'),
  create: (data) => request('job-grades.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request('job-grades.php', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  remove: (id) => request(`job-grades.php?id=${id}`, { method: 'DELETE' }),
}

export const hrEmployees = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`hr-employees.php${qs ? `?${qs}` : ''}`)
  },
  get: (id) => request(`hr-employees-detail.php?id=${id}`),
  create: (data) => request('hr-employees.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request('hr-employees.php', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
}

export const allowanceTypes = {
  list: () => request('allowance-types.php'),
  create: (data) => request('allowance-types.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request('allowance-types.php', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
}

export const employeeAllowances = {
  list: (employeeId) => request(`employee-allowances.php?employee_id=${employeeId}`),
  create: (data) => request('employee-allowances.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request('employee-allowances.php', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  remove: (id) => request(`employee-allowances.php?id=${id}`, { method: 'DELETE' }),
}

export const payrollPeriods = {
  list: () => request('payroll-periods.php'),
  create: (data) => request('payroll-periods.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request('payroll-periods.php', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
}

export const payrollRuns = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`payroll-runs.php${qs ? `?${qs}` : ''}`)
  },
  get: (id) => request(`payroll-runs.php?id=${id}`),
  create: (data) => request('payroll-runs.php', { method: 'POST', body: JSON.stringify(data) }),
  review: (id) => request('payroll-runs.php', { method: 'PUT', body: JSON.stringify({ id, action: 'review' }) }),
  approve: (id) => request('payroll-runs.php', { method: 'PUT', body: JSON.stringify({ id, action: 'approve' }) }),
  markPaid: (id) => request('payroll-runs.php', { method: 'PUT', body: JSON.stringify({ id, action: 'mark_paid' }) }),
  cancel: (id) => request('payroll-runs.php', { method: 'PUT', body: JSON.stringify({ id, action: 'cancel' }) }),
  remove: (id) => request(`payroll-runs.php?id=${id}`, { method: 'DELETE' }),
  items: (runId) => request(`payroll-items.php?run_id=${runId}`),
}

export const leaveTypes = {
  list: () => request('leave-types.php'),
  create: (data) => request('leave-types.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request('leave-types.php', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
}

export const leaveRequests = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`leave-requests.php${qs ? `?${qs}` : ''}`)
  },
  calendar: (month, year) => request(`leave-calendar.php?month=${month}&year=${year}`),
  create: (data) => request('leave-requests.php', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id) => request('leave-requests.php', { method: 'PUT', body: JSON.stringify({ id, action: 'approve' }) }),
  reject: (id, reason) => request('leave-requests.php', { method: 'PUT', body: JSON.stringify({ id, action: 'reject', reason }) }),
}

export const hrAttendance = {
  daily: (date) => request(`attendance.php?date=${date}`),
  monthly: (month) => request(`attendance.php?month=${month}`),
  create: (data) => request('attendance.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request('attendance.php', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  bulk: (data) => request('attendance.php', { method: 'POST', body: JSON.stringify({ bulk: true, entries: data }) }),
}

export const hrLoans = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`hr-loans.php${qs ? `?${qs}` : ''}`)
  },
  create: (data) => request('hr-loans.php', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id) => request('hr-loans.php', { method: 'PUT', body: JSON.stringify({ id, action: 'approve' }) }),
  reject: (id) => request('hr-loans.php', { method: 'PUT', body: JSON.stringify({ id, action: 'reject' }) }),
  repayments: (loanId) => request(`loan-repayments.php?loan_id=${loanId}`),
}

export const salaryAdvances = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`salary-advances.php${qs ? `?${qs}` : ''}`)
  },
  create: (data) => request('salary-advances.php', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id) => request('salary-advances.php', { method: 'PUT', body: JSON.stringify({ id, action: 'approve' }) }),
  reject: (id) => request('salary-advances.php', { method: 'PUT', body: JSON.stringify({ id, action: 'reject' }) }),
}

export const expenseClaims = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`expense-claims.php${qs ? `?${qs}` : ''}`)
  },
  create: (data) => request('expense-claims.php', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id) => request('expense-claims.php', { method: 'PUT', body: JSON.stringify({ id, action: 'approve' }) }),
  reject: (id) => request('expense-claims.php', { method: 'PUT', body: JSON.stringify({ id, action: 'reject' }) }),
}

export const shifts = {
  list: () => request('shifts.php'),
  create: (data) => request('shifts.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request('shifts.php', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
}

export const hrRegions = {
  list: () => request('hr-regions.php'),
  create: (data) => request('hr-regions.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request('hr-regions.php', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
}

export const fieldTracking = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`field-tracking.php${qs ? `?${qs}` : ''}`)
  },
  create: (data) => request('field-tracking.php', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id) => request('field-tracking.php', { method: 'PUT', body: JSON.stringify({ id, action: 'approve' }) }),
}

export const contracts = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`contracts.php${qs ? `?${qs}` : ''}`)
  },
  create: (data) => request('contracts.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request('contracts.php', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
}

export const payrollReports = {
  get: (type, params = {}) => {
    const qs = new URLSearchParams({ type, ...params }).toString()
    return request(`payroll-reports.php?${qs}`)
  },
}

export const payrollAudit = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`payroll-audit.php${qs ? `?${qs}` : ''}`)
  },
}

// ── Tally ERP ──────────────────────────────────────
export const tally = {
  preview: (type, params = {}) => {
    const qs = new URLSearchParams({ type, ...params }).toString()
    return request(`tally-export.php?${qs}`)
  },

  exportXml: (data) =>
    rawRequest('tally-export.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ── Kitchens (Kitchen Admin) ─────────────────────────
export const kitchens = {
  list: () => request('kitchens.php?action=list'),
  get: (id) => request(`kitchens.php?action=get&id=${id}`),
  save: (data) => request('kitchens.php?action=save', { method: 'POST', body: JSON.stringify(data) }),
  toggleActive: (id) => request('kitchens.php?action=toggle_active', { method: 'POST', body: JSON.stringify({ id }) }),
  getSettings: (id) => request(`kitchens.php?action=get_settings&id=${id}`),
  saveSettings: (id, settings) => request('kitchens.php?action=save_settings', { method: 'POST', body: JSON.stringify({ id, ...settings }) }),
}

// ── Requisition Types ────────────────────────────────
export const requisitionTypes = {
  list: () => request('requisition-types.php?action=list'),
  listAll: () => request('requisition-types.php?action=list_all'),
  save: (data) => request('requisition-types.php?action=save', { method: 'POST', body: JSON.stringify(data) }),
  toggleActive: (id) => request('requisition-types.php?action=toggle_active', { method: 'POST', body: JSON.stringify({ id }) }),
  reorder: (items) => request('requisition-types.php?action=reorder', { method: 'POST', body: JSON.stringify({ items }) }),
}

// ── Set Menus (Rotational Weekly Menus) ──────────────
export const setMenus = {
  getWeek: () => request('set-menus.php?action=get_week'),
  getDay: (day, type) => request(`set-menus.php?action=get_day&day=${day}&type=${encodeURIComponent(type)}`),
  getDayWithIngredients: (day, type) => request(`set-menus.php?action=get_day_with_ingredients&day=${day}&type=${encodeURIComponent(type)}`),
  addDish: (data) => request('set-menus.php?action=add_dish', { method: 'POST', body: JSON.stringify(data) }),
  removeDish: (id) => request('set-menus.php?action=remove_dish', { method: 'POST', body: JSON.stringify({ id }) }),
  reorder: (items) => request('set-menus.php?action=reorder', { method: 'POST', body: JSON.stringify({ items }) }),
  copyDay: (data) => request('set-menus.php?action=copy_day', { method: 'POST', body: JSON.stringify(data) }),
  clearDay: (data) => request('set-menus.php?action=clear_day', { method: 'POST', body: JSON.stringify(data) }),
  searchRecipes: (q) => request(`set-menus.php?action=search_recipes&q=${encodeURIComponent(q)}`),
}

// ── Push Notifications ───────────────────────────────
export const pushNotifications = {
  vapidKey: () => request('push.php?action=vapid_key'),
  subscribe: (data) => request('push.php?action=subscribe', { method: 'POST', body: JSON.stringify(data) }),
  unsubscribe: (endpoint) => request('push.php?action=unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }),
  status: () => request('push.php?action=status'),
  notifications: (kitchenId, limit) => request(`push.php?action=notifications&kitchen_id=${kitchenId || 0}&limit=${limit || 20}`),
  markRead: (id) => request('push.php?action=mark_read', { method: 'POST', body: JSON.stringify({ id }) }),
  unreadCount: (kitchenId) => request(`push.php?action=unread_count&kitchen_id=${kitchenId || 0}`),
}

// ── Kitchen Requisitions ─────────────────────────────
export const kitchenRequisitions = {
  list: (date, kitchenId, status) => {
    const params = new URLSearchParams({ action: 'list', date: date || '', kitchen_id: kitchenId || '' })
    if (status) params.set('status', status)
    return request(`kitchen-requisitions.php?${params}`)
  },
  get: (id) => request(`kitchen-requisitions.php?action=get&id=${id}`),
  autoCreateForDate: (data) => request('kitchen-requisitions.php?action=auto_create_for_date', { method: 'POST', body: JSON.stringify(data) }),
  createSupplementary: (parentId) => request('kitchen-requisitions.php?action=create_supplementary', { method: 'POST', body: JSON.stringify({ parent_id: parentId }) }),
  create: (data) => request('kitchen-requisitions.php?action=create', { method: 'POST', body: JSON.stringify(data) }),
  saveLines: (reqId, lines) => request('kitchen-requisitions.php?action=save_lines', { method: 'POST', body: JSON.stringify({ requisition_id: reqId, lines }) }),
  submit: (reqId) => request('kitchen-requisitions.php?action=submit', { method: 'POST', body: JSON.stringify({ requisition_id: reqId }) }),
  fulfill: (reqId, lines) => request('kitchen-requisitions.php?action=fulfill', { method: 'POST', body: JSON.stringify({ requisition_id: reqId, lines }) }),
  confirmReceipt: (reqId, lines) => request('kitchen-requisitions.php?action=confirm_receipt', { method: 'POST', body: JSON.stringify({ requisition_id: reqId, lines }) }),
  close: (data) => request('kitchen-requisitions.php?action=close', { method: 'POST', body: JSON.stringify(data) }),
  closeWithUnused: (data) => request('kitchen-requisitions.php?action=close_with_unused', { method: 'POST', body: JSON.stringify(data) }),
  updateUnused: (reqId, unusedLines) => request('kitchen-requisitions.php?action=update_unused', { method: 'POST', body: JSON.stringify({ requisition_id: reqId, unused_lines: unusedLines }) }),
  dashboardStats: (kitchenId) => request(`kitchen-requisitions.php?action=dashboard_stats&kitchen_id=${kitchenId || ''}`),
  storeStats: (kitchenId) => request(`kitchen-requisitions.php?action=store_stats&kitchen_id=${kitchenId || ''}`),
  daySummary: (date, kitchenId) => request(`kitchen-requisitions.php?action=day_summary&date=${date || ''}&kitchen_id=${kitchenId || ''}`),
  getItems: (q) => request(`kitchen-requisitions.php?action=get_items${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  searchRecipes: (q) => request(`kitchen-requisitions.php?action=search_recipes&q=${encodeURIComponent(q)}`),
  getRecipeIngredients: (recipeId) => request(`kitchen-requisitions.php?action=get_recipe_ingredients&recipe_id=${recipeId}`),
  addSingleDish: (reqId, recipeId) => request('kitchen-requisitions.php?action=add_single_dish', { method: 'POST', body: JSON.stringify({ requisition_id: reqId, recipe_id: recipeId }) }),
  saveDishLines: (data) => request('kitchen-requisitions.php?action=save_dish_lines', { method: 'POST', body: JSON.stringify(data) }),
  getDishesWithIngredients: (reqId) => request(`kitchen-requisitions.php?action=get_dishes_with_ingredients&requisition_id=${reqId}`),
}

// ── Bank Export ──────────────────────────────────────
export const bankExport = {
  listRuns: () => request('bank-export.php?action=list_runs'),
  generate: (runId, format) => request('bank-export.php?action=generate', { method: 'POST', body: JSON.stringify({ run_id: runId, format }) }),
}

// ── Payslips ─────────────────────────────────────────
export const payslips = {
  generate: (itemId) => request(`payslips.php?action=generate&id=${itemId}`),
  list: (runId) => request(`payslips.php?action=list&run_id=${runId}`),
  templates: () => request('payslips.php?action=templates'),
  saveTemplate: (data) => request('payslips.php?action=save_template', { method: 'POST', body: JSON.stringify(data) }),
  deleteTemplate: (id) => request('payslips.php?action=delete_template', { method: 'POST', body: JSON.stringify({ id }) }),
  myPayslips: (year) => request(`payslips.php?action=my_payslips&year=${year || new Date().getFullYear()}`),
}

// ── Employee Self-Service ────────────────────────────
export const selfService = {
  dashboard: () => request('self-service.php?action=dashboard'),
  profile: () => request('self-service.php?action=profile'),
  updateProfile: (data) => request('self-service.php?action=update_profile', { method: 'POST', body: JSON.stringify(data) }),
  saveBank: (data) => request('self-service.php?action=save_bank', { method: 'POST', body: JSON.stringify(data) }),
  leaveBalance: (year) => request(`self-service.php?action=leave_balance&year=${year || new Date().getFullYear()}`),
  myLeave: (year) => request(`self-service.php?action=my_leave&year=${year || new Date().getFullYear()}`),
  requestLeave: (data) => request('self-service.php?action=request_leave', { method: 'POST', body: JSON.stringify(data) }),
  cancelLeave: (id) => request('self-service.php?action=cancel_leave', { method: 'POST', body: JSON.stringify({ id }) }),
  myLoans: () => request('self-service.php?action=my_loans'),
  requestLoan: (data) => request('self-service.php?action=request_loan', { method: 'POST', body: JSON.stringify(data) }),
  myAttendance: (month) => request(`self-service.php?action=my_attendance&month=${month || ''}`),
  checkIn: (data) => request('self-service.php?action=check_in', { method: 'POST', body: JSON.stringify(data) }),
  checkOut: (data) => request('self-service.php?action=check_out', { method: 'POST', body: JSON.stringify(data) }),
  myAllowances: () => request('self-service.php?action=my_allowances'),
  myDocuments: (type) => request(`self-service.php?action=my_documents${type ? `&type=${type}` : ''}`),
  startVisit: (data) => request('self-service.php?action=start_visit', { method: 'POST', body: JSON.stringify(data) }),
  endVisit: (data) => request('self-service.php?action=end_visit', { method: 'POST', body: JSON.stringify(data) }),
  myVisits: (month) => request(`self-service.php?action=my_visits&month=${month || ''}`),
  myIdCard: () => request('self-service.php?action=my_id_card'),
  changePassword: (data) => request('self-service.php?action=change_password', { method: 'POST', body: JSON.stringify(data) }),
}

// ── Document Templates ───────────────────────────────
export const documentTemplates = {
  list: (type) => request(`document-templates.php?action=list${type ? `&type=${type}` : ''}`),
  get: (id) => request(`document-templates.php?action=get&id=${id}`),
  save: (data) => request('document-templates.php?action=save', { method: 'POST', body: JSON.stringify(data) }),
  duplicate: (id) => request('document-templates.php?action=duplicate', { method: 'POST', body: JSON.stringify({ id }) }),
  remove: (id) => request('document-templates.php?action=delete', { method: 'POST', body: JSON.stringify({ id }) }),
  generate: (templateId, employeeId) => request('document-templates.php?action=generate', { method: 'POST', body: JSON.stringify({ template_id: templateId, employee_id: employeeId }) }),
  placeholders: () => request('document-templates.php?action=placeholders'),
}

// ── Approval Engine ──────────────────────────────────
export const approvalEngine = {
  list: () => request('approval-engine.php?action=list'),
  get: (id) => request(`approval-engine.php?action=get&id=${id}`),
  save: (data) => request('approval-engine.php?action=save', { method: 'POST', body: JSON.stringify(data) }),
  remove: (id) => request('approval-engine.php?action=delete', { method: 'POST', body: JSON.stringify({ id }) }),
  myPending: () => request('approval-engine.php?action=my_pending'),
  action: (requestId, decision, comment) => request('approval-engine.php?action=action', { method: 'POST', body: JSON.stringify({ request_id: requestId, decision, comment }) }),
  submit: (type, referenceId, description) => request('approval-engine.php?action=submit', { method: 'POST', body: JSON.stringify({ type, reference_id: referenceId, description }) }),
}

// ── Bulk Import ──────────────────────────────────────
export const bulkImport = {
  validate: (file, entity) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('entity', entity)
    return request('bulk-import.php?action=validate', { method: 'POST', body: formData, isFormData: true })
  },
  execute: (file, entity) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('entity', entity)
    return request('bulk-import.php?action=import', { method: 'POST', body: formData, isFormData: true })
  },
}

// ── Trip Allowances ──────────────────────────────────
export const tripAllowances = {
  list: (params = {}) => {
    const qs = new URLSearchParams({ action: 'list', ...params }).toString()
    return request(`trip-allowances.php?${qs}`)
  },
  byEmployee: (employeeId) => request(`trip-allowances.php?action=by_employee&employee_id=${employeeId}`),
  create: (data) => request('trip-allowances.php?action=create', { method: 'POST', body: JSON.stringify(data) }),
  update: (data) => request('trip-allowances.php?action=update', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id) => request('trip-allowances.php?action=approve', { method: 'POST', body: JSON.stringify({ id }) }),
  reject: (id) => request('trip-allowances.php?action=reject', { method: 'POST', body: JSON.stringify({ id }) }),
  remove: (id) => request('trip-allowances.php?action=delete', { method: 'POST', body: JSON.stringify({ id }) }),
}

// ── Employee Transfers ───────────────────────────────
export const transfers = {
  list: (params = {}) => {
    const qs = new URLSearchParams({ action: 'list', ...params }).toString()
    return request(`transfers.php?${qs}`)
  },
  create: (data) => request('transfers.php?action=create', { method: 'POST', body: JSON.stringify(data) }),
}

// ── M-Pesa ───────────────────────────────────────────
export const mpesa = {
  status: () => request('mpesa.php?action=status'),
  saveConfig: (data) => request('mpesa.php?action=save_config', { method: 'POST', body: JSON.stringify(data) }),
  sendPayment: (data) => request('mpesa.php?action=send_payment', { method: 'POST', body: JSON.stringify(data) }),
  bulkSalary: (runId) => request('mpesa.php?action=bulk_salary', { method: 'POST', body: JSON.stringify({ run_id: runId }) }),
  transactions: (page) => request(`mpesa.php?action=transactions&page=${page || 1}`),
}

// ── SMS ──────────────────────────────────────────────
export const sms = {
  status: () => request('sms.php?action=status'),
  saveConfig: (data) => request('sms.php?action=save_config', { method: 'POST', body: JSON.stringify(data) }),
  send: (phone, message) => request('sms.php?action=send', { method: 'POST', body: JSON.stringify({ phone, message }) }),
  bulk: (recipients, template) => request('sms.php?action=bulk', { method: 'POST', body: JSON.stringify({ recipients, template }) }),
  logs: (page) => request(`sms.php?action=logs&page=${page || 1}`),
}

// ── Bar Tabs ─────────────────────────────────────────
export const barTabs = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`bar-tabs.php${qs ? `?${qs}` : ''}`)
  },
  get: (id) => request(`bar-tabs.php?id=${id}`),
  open: (data) => request('bar-tabs.php', { method: 'POST', body: JSON.stringify({ action: 'open', ...data }) }),
  addItems: (tabId, items) => request('bar-tabs.php', { method: 'POST', body: JSON.stringify({ action: 'add_items', tab_id: tabId, items }) }),
  close: (tabId, paymentMethod, paymentRef) => request('bar-tabs.php', { method: 'PUT', body: JSON.stringify({ action: 'close', tab_id: tabId, payment_method: paymentMethod, payment_reference: paymentRef }) }),
  voidLine: (lineId, reason) => request('bar-tabs.php', { method: 'PUT', body: JSON.stringify({ action: 'void_line', line_id: lineId, reason }) }),
  voidTab: (tabId, reason) => request('bar-tabs.php', { method: 'PUT', body: JSON.stringify({ action: 'void_tab', tab_id: tabId, reason }) }),
  discount: (tabId, discountType, discountValue, reason) => request('bar-tabs.php', { method: 'PUT', body: JSON.stringify({ action: 'discount', tab_id: tabId, discount_type: discountType, discount_value: discountValue, reason }) }),
  transfer: (tabId, data) => request('bar-tabs.php', { method: 'PUT', body: JSON.stringify({ action: 'transfer', tab_id: tabId, ...data }) }),
  merge: (sourceTabId, targetTabId) => request('bar-tabs.php', { method: 'PUT', body: JSON.stringify({ action: 'merge', source_tab_id: sourceTabId, target_tab_id: targetTabId }) }),
  split: (tabId, lineIds, guestName, covers) => request('bar-tabs.php', { method: 'PUT', body: JSON.stringify({ action: 'split', tab_id: tabId, line_ids: lineIds, guest_name: guestName, covers }) }),
  complimentary: (lineId, reason) => request('bar-tabs.php', { method: 'PUT', body: JSON.stringify({ action: 'complimentary', line_id: lineId, reason }) }),
}

// ── Bar Shifts ───────────────────────────────────────
export const barShifts = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`bar-shifts.php${qs ? `?${qs}` : ''}`)
  },
  get: (id) => request(`bar-shifts.php?id=${id}`),
  open: (openingFloat) => request('bar-shifts.php', { method: 'POST', body: JSON.stringify({ action: 'open', opening_float: openingFloat }) }),
  cashEntry: (shiftId, entryType, amount, reason) => request('bar-shifts.php', { method: 'POST', body: JSON.stringify({ action: 'cash_entry', shift_id: shiftId, entry_type: entryType, amount, reason }) }),
  close: (id, closingCash, notes) => request('bar-shifts.php', { method: 'PUT', body: JSON.stringify({ id, closing_cash: closingCash, notes }) }),
}

// ── Bar Reports ──────────────────────────────────────
export const barReports = {
  topSelling: (params = {}) => {
    const qs = new URLSearchParams({ type: 'top_selling', ...params }).toString()
    return request(`bar-reports.php?${qs}`)
  },
  profitability: (params = {}) => {
    const qs = new URLSearchParams({ type: 'profitability', ...params }).toString()
    return request(`bar-reports.php?${qs}`)
  },
  serverPerformance: (params = {}) => {
    const qs = new URLSearchParams({ type: 'server_performance', ...params }).toString()
    return request(`bar-reports.php?${qs}`)
  },
  hourly: (params = {}) => {
    const qs = new URLSearchParams({ type: 'hourly', ...params }).toString()
    return request(`bar-reports.php?${qs}`)
  },
  dailySummary: (params = {}) => {
    const qs = new URLSearchParams({ type: 'daily_summary', ...params }).toString()
    return request(`bar-reports.php?${qs}`)
  },
  paymentMethods: (params = {}) => {
    const qs = new URLSearchParams({ type: 'payment_methods', ...params }).toString()
    return request(`bar-reports.php?${qs}`)
  },
}

// ── Kitchen Store Orders ─────────────────────────────
export const kitchenStoreOrders = {
  list: (status, kitchenId) => {
    const params = new URLSearchParams({ action: 'list' })
    if (status) params.set('status', status)
    if (kitchenId) params.set('kitchen_id', kitchenId)
    return request(`kitchen-store-orders.php?${params}`)
  },
  get: (id) => request(`kitchen-store-orders.php?action=get&id=${id}`),
  markSent: (orderId, lines) => request('kitchen-store-orders.php?action=mark_sent', { method: 'POST', body: JSON.stringify({ order_id: orderId, lines }) }),
  addNotes: (orderId, notes) => request('kitchen-store-orders.php?action=add_notes', { method: 'POST', body: JSON.stringify({ order_id: orderId, notes }) }),
  getDaily: (date, kitchenId) => request(`kitchen-store-orders.php?action=get_daily&date=${date || ''}&kitchen_id=${kitchenId || ''}`),
  submitOrder: (data) => request('kitchen-store-orders.php?action=submit_order', { method: 'POST', body: JSON.stringify(data) }),
  confirmReceipt: (orderId, lines) => request('kitchen-store-orders.php?action=confirm_receipt', { method: 'POST', body: JSON.stringify({ order_id: orderId, lines }) }),
  searchItems: (q) => request(`kitchen-store-orders.php?action=search_items&q=${encodeURIComponent(q)}`),
}
