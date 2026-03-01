/**
 * Circular countdown indicator for auto-advance mode.
 * Shows near the target element during the auto-advance delay.
 * Uses a CSS animation to fill a circular progress ring over the duration.
 */
export default function AutoCountdown({ targetRect, duration = 2 }) {
  if (!targetRect) return null

  // Position near the top-right of the target element
  const size = 32
  const x = targetRect.right + 8
  const y = targetRect.top - 4

  // SVG circle params
  const radius = 12
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className="fixed flex items-center justify-center"
      style={{
        top: y,
        left: x,
        width: size,
        height: size,
        zIndex: 10002,
        pointerEvents: 'none',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="rgba(255,255,255,0.9)"
          stroke="#e5e7eb"
          strokeWidth="2.5"
        />
        {/* Animated progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={{
            animation: `guide-auto-countdown ${duration}s linear forwards`,
            transformOrigin: 'center',
            transform: 'rotate(-90deg)',
          }}
        />
      </svg>
      {/* Zap icon in center */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    </div>
  )
}
