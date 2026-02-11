/**
 * KCL Stores — API Client
 * Handles all HTTP requests to the PHP backend
 */

// In dev, Vite proxy forwards /api → localhost:8000
// In production, points to the Hostinger API domain
const BASE_URL = import.meta.env.DEV
  ? '/api'
  : 'https://darkblue-goshawk-672880.hostingersite.com'

function getToken() {
  return localStorage.getItem('kcl_token')
}

async function request(endpoint, options = {}) {
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

  try {
    const response = await fetch(url, config)

    // Handle 401 — token expired
    if (response.status === 401) {
      localStorage.removeItem('kcl_token')
      localStorage.removeItem('kcl_stores')
      window.location.hash = '#/login'
      throw new Error('Session expired. Please login again.')
    }

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed (${response.status})`)
    }

    return data
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection.')
    }
    throw error
  }
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

// ── Health Check ────────────────────────────────────
export const health = {
  check: () => request('health.php'),
}
