import { useRef, useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import GuideProgress from './GuideProgress'

/**
 * Positioned tooltip showing step instructions.
 * Auto-positions relative to target, flips if near viewport edge.
 */
export default function GuideTooltip({
  step,
  targetRect,
  currentIndex,
  totalSteps,
  onNext,
  onPrev,
  onEnd,
  isFirst,
  isLast,
}) {
  const tooltipRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, arrowSide: 'top' })

  useEffect(() => {
    if (!targetRect || !tooltipRef.current) return

    const tt = tooltipRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gap = 14
    const placement = step.placement || 'bottom'

    let top, left, arrowSide

    // Calculate preferred position
    if (placement === 'bottom' || placement === 'top') {
      left = targetRect.left + targetRect.width / 2 - tt.width / 2
      if (placement === 'bottom') {
        top = targetRect.bottom + gap
        arrowSide = 'top'
      } else {
        top = targetRect.top - tt.height - gap
        arrowSide = 'bottom'
      }
    } else if (placement === 'right') {
      left = targetRect.right + gap
      top = targetRect.top + targetRect.height / 2 - tt.height / 2
      arrowSide = 'left'
    } else {
      left = targetRect.left - tt.width - gap
      top = targetRect.top + targetRect.height / 2 - tt.height / 2
      arrowSide = 'right'
    }

    // Flip if out of viewport
    if (top + tt.height > vh - 20) {
      top = targetRect.top - tt.height - gap
      arrowSide = 'bottom'
    }
    if (top < 20) {
      top = targetRect.bottom + gap
      arrowSide = 'top'
    }
    if (left + tt.width > vw - 20) {
      left = vw - tt.width - 20
    }
    if (left < 20) {
      left = 20
    }

    setPos({ top, left, arrowSide })
  }, [targetRect, step])

  if (!step || !targetRect) return null

  return (
    <div
      ref={tooltipRef}
      className="fixed bg-white rounded-xl shadow-xl border border-gray-200 w-72 max-w-[calc(100vw-40px)]"
      style={{
        top: pos.top,
        left: pos.left,
        zIndex: 10001,
        animation: 'guide-tooltip-enter 0.3s ease-out',
        transition: 'top 0.35s ease, left 0.35s ease',
      }}
    >
      {/* Arrow indicator */}
      <div
        className="absolute w-3 h-3 bg-white border-gray-200 rotate-45"
        style={{
          ...(pos.arrowSide === 'top' && { top: -6, left: '50%', marginLeft: -6, borderTop: '1px solid', borderLeft: '1px solid' }),
          ...(pos.arrowSide === 'bottom' && { bottom: -6, left: '50%', marginLeft: -6, borderBottom: '1px solid', borderRight: '1px solid' }),
          ...(pos.arrowSide === 'left' && { left: -6, top: '50%', marginTop: -6, borderBottom: '1px solid', borderLeft: '1px solid' }),
          ...(pos.arrowSide === 'right' && { right: -6, top: '50%', marginTop: -6, borderTop: '1px solid', borderRight: '1px solid' }),
        }}
      />

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-sm font-bold text-gray-900 pr-4">{step.title}</h4>
          <button
            onClick={onEnd}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition compact-btn"
            style={{ minHeight: 'auto' }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed mb-3">{step.description}</p>

        {/* Footer: progress + nav */}
        <div className="flex items-center justify-between">
          <GuideProgress current={currentIndex} total={totalSteps} />

          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <button
                onClick={onPrev}
                className="compact-btn flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
                style={{ minHeight: 'auto' }}
              >
                <ChevronLeft size={14} />
              </button>
            )}
            <button
              onClick={onNext}
              className="compact-btn flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition"
              style={{ minHeight: 'auto' }}
            >
              {isLast ? (
                <>
                  <Check size={12} />
                  Done
                </>
              ) : (
                <>
                  Next
                  <ChevronRight size={12} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Step counter */}
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          Step {currentIndex + 1} of {totalSteps}
        </p>
      </div>
    </div>
  )
}
