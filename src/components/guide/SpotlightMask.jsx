import { useEffect, useState } from 'react'

/**
 * SVG-based spotlight overlay with animated cutout around target element.
 * Dark overlay covers the screen; a rounded-rect hole reveals the target.
 *
 * When clickThrough is true (real-time coaching mode), the entire overlay
 * becomes pointer-events:none so user clicks pass through to the actual
 * target element underneath. The dark mask is purely visual.
 */
export default function SpotlightMask({ targetRect, padding = 8, onClick, clickThrough = false }) {
  const [animRect, setAnimRect] = useState(targetRect)

  useEffect(() => {
    if (targetRect) {
      requestAnimationFrame(() => setAnimRect(targetRect))
    }
  }, [targetRect])

  if (!animRect) return null

  const x = animRect.left - padding
  const y = animRect.top - padding
  const w = animRect.width + padding * 2
  const h = animRect.height + padding * 2

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 9997, pointerEvents: clickThrough ? 'none' : 'auto' }}
    >
      {/* SVG mask overlay */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: clickThrough ? 'none' : 'auto' }}>
        <defs>
          <mask id="guide-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={x} y={y} width={w} height={h}
              rx="8" ry="8"
              fill="black"
              style={{ transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          </mask>
        </defs>
        <rect
          width="100%" height="100%"
          fill="rgba(0,0,0,0.5)"
          mask="url(#guide-spotlight-mask)"
          onClick={clickThrough ? undefined : onClick}
          style={{ cursor: clickThrough ? 'default' : 'pointer' }}
        />
      </svg>

      {/* Pulsing ring around the target — more prominent in coaching mode */}
      <div
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
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: clickThrough
            ? '0 0 0 4px rgba(22, 163, 74, 0.15), inset 0 0 12px rgba(22, 163, 74, 0.08)'
            : 'none',
        }}
      />
    </div>
  )
}
