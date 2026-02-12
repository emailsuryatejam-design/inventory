import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768

/**
 * Responsive hook that tracks mobile vs desktop.
 * Subscribes to resize events so components re-render on breakpoint change.
 * Uses matchMedia for efficient, debounced updates.
 */
export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false
  )

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)

    function onChange(e) {
      setIsMobile(e.matches)
    }

    // Modern browsers
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange)
    } else {
      // Safari < 14
      mql.addListener(onChange)
    }

    // Sync initial state
    setIsMobile(mql.matches)

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', onChange)
      } else {
        mql.removeListener(onChange)
      }
    }
  }, [])

  return isMobile
}
