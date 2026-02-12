import { useEffect, useRef, useId } from 'react'

/**
 * SVG-based spotlight overlay with animated cutout around target element.
 * Dark overlay covers the screen; a rounded-rect hole reveals the target.
 *
 * When clickThrough is true (real-time coaching mode), the entire overlay
 * becomes pointer-events:none so user clicks pass through to the actual
 * target element underneath. The dark mask is purely visual.
 *
 * Fixes:
 * - Uses ref-based animation (no state re-render for rect updates)
 * - Specific transition properties (not 'all')
 * - Unique mask ID to avoid SVG conflicts
 * - Single animation source (CSS transition only, no double animation)
 * - pointer-events structure: SVG has none, dark area has auto, target hole passes through
 * - Click-through to target elements works for advanceOn:'click' steps
 */
export default function SpotlightMask({ targetRect, padding = 8, onClick, clickThrough = false }) {
  const rectRef = useRef(null)
  const ringRef = useRef(null)
  const maskId = useId()?.replace(/:/g, '_') || 'guide-mask'

  // Animate via ref (no re-render, no extra frame delay)
  useEffect(() => {
    if (!targetRect) return

    const x = targetRect.left - padding
    const y = targetRect.top - padding
    const w = targetRect.width + padding * 2
    const h = targetRect.height + padding * 2

    if (rectRef.current) {
      rectRef.current.setAttribute('x', x)
      rectRef.current.setAttribute('y', y)
      rectRef.current.setAttribute('width', w)
      rectRef.current.setAttribute('height', h)
    }

    if (ringRef.current) {
      ringRef.current.style.left = `${x}px`
      ringRef.current.style.top = `${y}px`
      ringRef.current.style.width = `${w}px`
      ringRef.current.style.height = `${h}px`
    }
  }, [targetRect, padding])

  if (!targetRect) return null

  const x = targetRect.left - padding
  const y = targetRect.top - padding
  const w = targetRect.width + padding * 2
  const h = targetRect.height + padding * 2

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 9997, pointerEvents: 'none' }}
    >
      {/* SVG mask overlay — dark area is clickable (dismiss), hole passes through */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            <rect
              ref={rectRef}
              x={x} y={y} width={w} height={h}
              rx="8" ry="8"
              fill="black"
              style={{
                transition: 'x 0.4s cubic-bezier(0.4,0,0.2,1), y 0.4s cubic-bezier(0.4,0,0.2,1), width 0.4s cubic-bezier(0.4,0,0.2,1), height 0.4s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          </mask>
        </defs>
        {/* Dark overlay — clicking outside the target dismisses the guide */}
        <rect
          width="100%" height="100%"
          fill="rgba(0,0,0,0.55)"
          mask={`url(#${maskId})`}
          onClick={clickThrough ? undefined : onClick}
          style={{ pointerEvents: clickThrough ? 'none' : 'auto', cursor: clickThrough ? 'default' : 'pointer' }}
        />
      </svg>

      {/* Pulsing ring around the target — more prominent in coaching mode */}
      <div
        ref={ringRef}
        className="absolute rounded-lg pointer-events-none"
        style={{
          left: x,
          top: y,
          width: w,
          height: h,
          border: clickThrough
            ? '2px solid rgba(22, 163, 74, 0.8)'
            : '2px solid rgba(22, 163, 74, 0.6)',
          animation: clickThrough
            ? 'guide-coaching-pulse 1.4s ease-in-out infinite'
            : 'guide-spotlight-pulse 2s ease-in-out infinite',
          animationFillMode: 'both',
          willChange: 'box-shadow',
          boxShadow: clickThrough
            ? '0 0 0 4px rgba(22, 163, 74, 0.15), inset 0 0 12px rgba(22, 163, 74, 0.08)'
            : 'none',
        }}
      />
    </div>
  )
}
