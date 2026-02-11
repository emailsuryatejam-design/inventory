/**
 * Animated fake cursor that glides to target elements.
 * On mobile, shows a pulsing tap ring instead of cursor arrow.
 */
export default function AnimatedCursor({ position, visible, clicking }) {
  const isMobile = window.innerWidth <= 768

  if (!visible) return null

  // Mobile: pulsing tap indicator
  if (isMobile) {
    return (
      <div
        className="fixed pointer-events-none"
        style={{
          left: position.x - 24,
          top: position.y - 24,
          zIndex: 10000,
          transition: 'left 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Outer pulsing ring */}
        <div
          className="absolute inset-0 rounded-full bg-green-500/20"
          style={{
            width: 48, height: 48,
            animation: 'guide-tap-ring 1.5s ease-out infinite',
          }}
        />
        {/* Inner dot */}
        <div
          className="absolute rounded-full bg-green-500"
          style={{
            width: 16, height: 16,
            left: 16, top: 16,
            boxShadow: '0 0 8px rgba(22,163,74,0.5)',
          }}
        />
        {/* "Tap here" label */}
        <span
          className="absolute text-[10px] font-bold text-green-700 whitespace-nowrap"
          style={{ left: 52, top: 14 }}
        >
          Tap here
        </span>
      </div>
    )
  }

  // Desktop: pointer cursor arrow
  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        zIndex: 10000,
        transition: 'left 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        animation: clicking ? 'guide-cursor-click 0.3s ease' : undefined,
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
        <path
          d="M5.5 2L20 12.5L12.5 13.5L9 21L5.5 2Z"
          fill="#16a34a"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
