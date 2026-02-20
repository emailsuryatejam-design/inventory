import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react'

// ── Toast Context ─────────────────────────
const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
}

const COLORS = {
  success: { bg: '#ecfdf5', border: '#a7f3d0', icon: '#059669', text: '#065f46' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '#d97706', text: '#92400e' },
  error: { bg: '#fef2f2', border: '#fecaca', icon: '#dc2626', text: '#991b1b' },
  info: { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb', text: '#1e40af' },
}

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type, exiting: false }])

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 200)
  }, [])

  const toast = useMemo(() => ({
    success: (msg, dur) => addToast(msg, 'success', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  }), [addToast])

  // Expose toast globally for non-component usage
  useEffect(() => {
    window.__kcl_toast = toast
  }, [toast])

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast stack — bottom-right on desktop, top-center on mobile */}
      <div
        className="fixed z-[100] pointer-events-none"
        style={{
          bottom: '80px',
          right: '16px',
          left: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
        }}
      >
        {toasts.map(t => {
          const Icon = ICONS[t.type]
          const c = COLORS[t.type]
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium max-w-[360px] w-full sm:w-auto ${
                t.exiting ? 'animate-toast-out' : 'animate-toast-in'
              }`}
              style={{
                backgroundColor: c.bg,
                border: `1px solid ${c.border}`,
                color: c.text,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <Icon size={18} style={{ color: c.icon }} className="shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                className="p-0.5 rounded opacity-60 hover:opacity-100 transition compact-btn"
                style={{ minHeight: 'auto' }}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
