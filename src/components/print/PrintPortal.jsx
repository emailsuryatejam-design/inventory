import { createPortal } from 'react-dom'
import { useEffect, useRef, useCallback } from 'react'

/**
 * PrintPortal — renders children into #print-portal for printing.
 * When `trigger` is true, makes portal visible and calls window.print().
 * After printing, calls onDone() to reset the trigger.
 *
 * @param {string} pageType - 'receipt' | 'report' (sets CSS @page rules)
 * @param {boolean} trigger - when true, initiates print
 * @param {function} onDone - called after print dialog closes
 * @param {React.ReactNode} children - content to print
 */
export default function PrintPortal({ children, pageType = 'receipt', trigger = false, onDone }) {
  const portalEl = useRef(null)

  // Get or create the portal container
  if (!portalEl.current) {
    portalEl.current = document.getElementById('print-portal')
  }

  const handlePrint = useCallback(() => {
    if (!portalEl.current) return

    // Set page type for CSS targeting
    portalEl.current.setAttribute('data-page-type', pageType)
    // Make visible (print CSS shows it, screen CSS hides everything else)
    portalEl.current.style.display = 'block'

    // Small delay to let React render the portal content
    requestAnimationFrame(() => {
      window.print()

      // After print dialog closes (sync in most browsers)
      portalEl.current.style.display = 'none'
      if (onDone) onDone()
    })
  }, [pageType, onDone])

  useEffect(() => {
    if (trigger) handlePrint()
  }, [trigger, handlePrint])

  if (!portalEl.current) return null

  return createPortal(children, portalEl.current)
}
