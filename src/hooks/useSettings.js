import { useState, useEffect } from 'react'

// In-memory cache shared across all hook instances
let settingsCache = null
let fetchPromise = null

/**
 * Fetches settings from the API.
 * Uses dynamic import to avoid circular dependency with api.js
 */
async function fetchSettings(keys) {
  const { rawRequest } = await import('../services/api')
  const qs = keys.length ? `?keys=${keys.join(',')}` : ''
  const res = await rawRequest(`settings.php${qs}`)
  return res.settings || {}
}

/**
 * Hook: read settings by key(s).
 * First call fetches from API, subsequent calls return from memory.
 */
export function useSettings(keys = []) {
  const [values, setValues] = useState(settingsCache || {})
  const [loading, setLoading] = useState(!settingsCache)

  useEffect(() => {
    if (settingsCache) {
      setValues(settingsCache)
      setLoading(false)
      return
    }

    // Deduplicate concurrent fetches
    if (!fetchPromise) {
      fetchPromise = fetchSettings(keys)
        .then(s => { settingsCache = s; return s })
        .catch(() => ({}))
        .finally(() => { fetchPromise = null })
    }

    fetchPromise.then(s => {
      setValues(s)
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { settings: values, loading }
}

/**
 * Invalidate the settings cache (call after saving new settings)
 */
export function invalidateSettingsCache() {
  settingsCache = null
}

/**
 * Convenience hook for printer configuration
 */
export function usePrinterConfig() {
  const { settings, loading } = useSettings([
    'printer_type', 'printer_endpoint', 'printer_width',
    'receipt_header', 'receipt_footer', 'receipt_show_logo',
  ])

  return {
    loading,
    type: settings.printer_type || 'browser',
    endpoint: settings.printer_endpoint || '',
    width: parseInt(settings.printer_width) || 80,
    headerText: settings.receipt_header || '',
    footerText: settings.receipt_footer || 'Thank you for visiting!',
    showLogo: settings.receipt_show_logo !== '0',
  }
}
