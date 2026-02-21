/**
 * Filter Persistence — saves/restores page filters to sessionStorage
 * so users don't lose their filter state when navigating away and back.
 */

const PREFIX = 'ws_filters_'

export function saveFilters(pageKey, filters) {
  try {
    sessionStorage.setItem(PREFIX + pageKey, JSON.stringify(filters))
  } catch (e) {
    // Ignore storage errors
  }
}

export function loadFilters(pageKey, defaults = {}) {
  try {
    const saved = sessionStorage.getItem(PREFIX + pageKey)
    if (saved) {
      return { ...defaults, ...JSON.parse(saved) }
    }
  } catch (e) {
    // Ignore parse errors
  }
  return defaults
}

export function clearFilters(pageKey) {
  sessionStorage.removeItem(PREFIX + pageKey)
}
