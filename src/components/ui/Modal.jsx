import { useEffect } from 'react'
import { X } from 'lucide-react'
import { lockScroll, unlockScroll } from '../../utils/scrollLock'

// Centered modal for confirmations and forms
// Usage: <Modal open={open} onClose={fn} title="Confirm"> ...content... </Modal>

export default function Modal({ open, onClose, title, children, maxWidth = '480px' }) {
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
        className="fixed inset-0 animate-backdrop-in flex items-center justify-center p-4"
        style={{ backgroundColor: 'var(--surface-overlay)', zIndex: 'var(--z-modal)' }}
        onClick={onClose}
      >
        {/* Modal panel */}
        <div
          className="bg-white rounded-2xl overflow-hidden animate-fade-in-up w-full"
          style={{
            maxWidth,
            boxShadow: 'var(--shadow-xl)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          {title && (
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border-light)' }}
            >
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition compact-btn"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Content */}
          <div className="p-5">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
