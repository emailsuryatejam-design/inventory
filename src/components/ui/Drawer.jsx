import { useEffect } from 'react'
import { X } from 'lucide-react'
import { lockScroll, unlockScroll } from '../../utils/scrollLock'

// Right-side slide-in drawer for detail views
// Usage: <Drawer open={open} onClose={fn} title="Detail"> ...content... </Drawer>

export default function Drawer({ open, onClose, title, children, width = '420px' }) {
  useEffect(() => {
    if (open) {
      lockScroll()
      return () => unlockScroll()
    }
  }, [open])

  // ESC key to close
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 animate-backdrop-in"
        style={{ backgroundColor: 'var(--surface-overlay)', zIndex: 'var(--z-drawer)' }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="fixed top-0 right-0 bottom-0 bg-white animate-slide-in-right overflow-hidden flex flex-col"
        style={{
          width: `min(${width}, 100vw)`,
          boxShadow: 'var(--shadow-xl)',
          zIndex: 'calc(var(--z-drawer) + 1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 h-[56px] shrink-0"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition compact-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 scroll-touch">
          {children}
        </div>
      </div>
    </>
  )
}
