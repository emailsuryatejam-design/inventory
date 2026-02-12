import useIsMobile from '../../hooks/useIsMobile'

/**
 * Animated fake cursor that glides to target elements.
 * On mobile, shows a pulsing tap ring instead of cursor arrow.
 * Uses useIsMobile() hook so it responds to orientation changes.
 * Timing synced with GuideTooltip (0.5s for both).
 *
 * In coaching mode, the cursor has a more prominent "click here" animation
 * to make it clear the user should actually click the target.
 */
export default function AnimatedCursor({ position, visible, clicking, coaching = false }) {
  const isMobile = useIsMobile()

  if (!visible) return null

  const MOVE_DURATION = '0.5s'
  const MOVE_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

  // Mobile: pulsing tap indicator
  if (isMobile) {
    return (
      <div
        className="fixed pointer-events-none"
        style={{
          left: position.x - 24,
          top: position.y - 24,
          zIndex: 10000,
          transition: `left ${MOVE_DURATION} ${MOVE_EASING}, top ${MOVE_DURATION} ${MOVE_EASING}`,
          animation: 'guide-cursor-fade-in 0.3s ease-out forwards',
          willChange: 'left, top',
        }}
      >
        {/* Outer pulsing ring */}
        <div
          className="absolute inset-0 rounded-full bg-green-500/20"
          style={{
            width: 48, height: 48,
            animation: coaching
              ? 'guide-coaching-tap-ring 1.2s ease-out infinite'
              : 'guide-tap-ring 1.5s ease-out infinite',
            animationFillMode: 'both',
          }}
        />
        {/* Inner dot */}
        <div
          className="absolute rounded-full bg-green-500"
          style={{
            width: 16, height: 16,
            left: 16, top: 16,
            boxShadow: coaching
              ? '0 0 12px rgba(22,163,74,0.6)'
              : '0 0 8px rgba(22,163,74,0.5)',
          }}
        />
        {/* Label */}
        <span
          className="absolute text-[10px] font-bold text-green-700 whitespace-nowrap"
          style={{ left: 52, top: 14, animation: coaching ? 'guide-coaching-dot 1s ease-in-out infinite' : undefined }}
        >
          {coaching ? 'Tap here!' : 'Tap here'}
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
        transition: `left ${MOVE_DURATION} ${MOVE_EASING}, top ${MOVE_DURATION} ${MOVE_EASING}`,
        animation: clicking
          ? 'guide-cursor-click 0.3s ease forwards'
          : coaching
            ? 'guide-coaching-cursor-bounce 1.8s ease-in-out infinite'
            : 'guide-cursor-fade-in 0.3s ease-out forwards',
        willChange: 'left, top',
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
      {/* Coaching click ripple underneath cursor */}
      {coaching && (
        <div
          className="absolute rounded-full"
          style={{
            width: 20, height: 20,
            left: -3, top: -3,
            animation: 'guide-coaching-click-ripple 1.8s ease-out infinite',
            border: '2px solid rgba(22, 163, 74, 0.5)',
          }}
        />
      )}
    </div>
  )
}
