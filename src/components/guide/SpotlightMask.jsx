import { useEffect, useState } from 'react'

/**
 * SVG-based spotlight overlay with animated cutout around target element.
 * Dark overlay covers the screen; a rounded-rect hole reveals the target.
 */
export default function SpotlightMask({ targetRect, padding = 8, onClick }) {
  const [animRect, setAnimRect] = useState(targetRect)

  useEffect(() => {
    if (targetRect) {
      // Small delay so the CSS transition can animate
      requestAnimationFrame(() => setAnimRect(targetRect))
    }
  }, [targetRect])

  if (!animRect) return null

  const x = animRect.left - padding
  const y = animRect.top - padding
  const w = animRect.width + padding * 2
  const h = animRect.height + padding * 2

  return (
    <div className="fixed inset-0" style={{ zIndex: 9997 }}>
      {/* SVG mask overlay */}
      <svg className="absolute inset-0 w-full h-full">
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
          fill="rgba(0,0,0,0.55)"
          mask="url(#guide-spotlight-mask)"
          onClick={onClick}
          style={{ cursor: 'pointer' }}
        />
      </svg>

      {/* Pulsing ring around the target */}
      <div
        className="absolute rounded-lg pointer-events-none"
        style={{
          left: x,
          top: y,
          width: w,
          height: h,
          border: '2px solid rgba(22, 163, 74, 0.6)',
          animation: 'guide-spotlight-pulse 2s ease-in-out infinite',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  )
}
