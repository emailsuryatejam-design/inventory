import { useRef, useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Check, MousePointerClick, Zap, SkipForward } from 'lucide-react'
import GuideProgress from './GuideProgress'

/**
 * Positioned tooltip showing step instructions.
 * Auto-positions relative to target, flips if near viewport edge.
 *
 * Features:
 * - Section badge (amber) when step has a section
 * - Typing indicator (animated dots) during typewriter
 * - Coaching hints for type/select steps ("Type: admin", "Select: kitchen")
 * - "Skip Section" button to skip entire section groups
 * - Auto-mode "Auto-advancing..." indicator
 * - Coaching mode "Go ahead, click it!" prompt
 */
export default function GuideTooltip({
  step,
  targetRect,
  currentIndex,
  totalSteps,
  onNext,
  onPrev,
  onEnd,
  onSkipSection,
  isFirst,
  isLast,
  coaching = false,
  isAutoMode = false,
  isTyping = false,
  currentSection = null,
}) {
  const tooltipRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, arrowSide: 'top', arrowOffset: '50%' })

  useEffect(() => {
    if (!targetRect || !tooltipRef.current) return

    const tt = tooltipRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gap = 14
    const margin = 16
    const placement = step?.placement || 'bottom'

    let top, left, arrowSide

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

    if (top + tt.height > vh - margin && arrowSide === 'top') {
      const flipped = targetRect.top - tt.height - gap
      if (flipped >= margin) { top = flipped; arrowSide = 'bottom' }
    } else if (top < margin && arrowSide === 'bottom') {
      const flipped = targetRect.bottom + gap
      if (flipped + tt.height <= vh - margin) { top = flipped; arrowSide = 'top' }
    }

    top = Math.max(margin, Math.min(top, vh - tt.height - margin))
    left = Math.max(margin, Math.min(left, vw - tt.width - margin))

    let arrowOffset = '50%'
    if (arrowSide === 'top' || arrowSide === 'bottom') {
      const targetCenterX = targetRect.left + targetRect.width / 2
      const offsetPx = Math.max(16, Math.min(targetCenterX - left, tt.width - 16))
      arrowOffset = `${offsetPx}px`
    }

    setPos({ top, left, arrowSide, arrowOffset })
  }, [targetRect, step])

  if (!step || !targetRect) return null

  const action = step.action || (step.advanceOn === 'click' ? 'click' : 'observe')

  return (
    <div
      ref={tooltipRef}
      key={`tooltip-step-${currentIndex}`}
      className="fixed bg-white rounded-xl shadow-xl border border-gray-200 w-72 max-w-[calc(100vw-32px)]"
      style={{
        top: pos.top,
        left: pos.left,
        zIndex: 10001,
        animation: 'guide-tooltip-enter 0.3s ease-out forwards',
        transition: 'top 0.5s ease, left 0.5s ease',
        touchAction: 'manipulation',
        pointerEvents: 'auto',
      }}
    >
      {/* Step progress bar at top */}
      <div className="w-full h-1 bg-gray-100 rounded-t-xl overflow-hidden">
        <div
          className="h-full rounded-t-xl transition-all duration-500 ease-out"
          style={{
            width: `${totalSteps > 0 ? ((currentIndex + 1) / totalSteps) * 100 : 0}%`,
            backgroundColor: '#f59e0b',
          }}
        />
      </div>

      {/* Arrow indicator */}
      <div
        className="absolute w-3 h-3 bg-white border-gray-200 rotate-45"
        style={{
          ...(pos.arrowSide === 'top' && { top: -6, left: pos.arrowOffset, marginLeft: -6, borderTop: '1px solid', borderLeft: '1px solid' }),
          ...(pos.arrowSide === 'bottom' && { bottom: -6, left: pos.arrowOffset, marginLeft: -6, borderBottom: '1px solid', borderRight: '1px solid' }),
          ...(pos.arrowSide === 'left' && { left: -6, top: '50%', marginTop: -6, borderBottom: '1px solid', borderLeft: '1px solid' }),
          ...(pos.arrowSide === 'right' && { right: -6, top: '50%', marginTop: -6, borderTop: '1px solid', borderRight: '1px solid' }),
        }}
      />

      {/* Content */}
      <div className="p-4">
        {/* Section badge */}
        {currentSection && (
          <div className="mb-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {currentSection}
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 pr-4">
            {coaching && (
              <div
                className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center"
                style={{ animation: 'guide-coaching-icon 1.5s ease-in-out infinite' }}
              >
                <MousePointerClick size={11} className="text-green-600" />
              </div>
            )}
            <h4 className="text-sm font-bold text-gray-900">{step.title}</h4>
          </div>
          <button
            onClick={onEnd}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition compact-btn"
            style={{ minHeight: 'auto' }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed mb-3">{step.description}</p>

        {/* Typing indicator (auto mode, during typewriter) */}
        {isAutoMode && isTyping && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-blue-50 border border-blue-100">
            <div className="flex gap-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" style={{ animation: 'guide-coaching-dot 0.6s ease-in-out infinite' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" style={{ animation: 'guide-coaching-dot 0.6s ease-in-out 0.2s infinite' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" style={{ animation: 'guide-coaching-dot 0.6s ease-in-out 0.4s infinite' }} />
            </div>
            <span className="text-[11px] font-semibold text-blue-700">Typing...</span>
          </div>
        )}

        {/* Auto-mode prompt (non-typing) */}
        {isAutoMode && !isTyping && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-amber-50 border border-amber-100">
            <Zap size={12} className="text-amber-500 flex-shrink-0" style={{ animation: 'guide-coaching-dot 1s ease-in-out infinite' }} />
            <span className="text-[11px] font-semibold text-amber-700">Auto-advancing...</span>
          </div>
        )}

        {/* Coaching: click prompt */}
        {coaching && !isAutoMode && action === 'click' && (
          <div
            className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-green-50 border border-green-100"
            style={{ animation: 'guide-coaching-prompt 2s ease-in-out infinite' }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" style={{ animation: 'guide-coaching-dot 1s ease-in-out infinite' }} />
            <span className="text-[11px] font-semibold text-green-700">Go ahead, click it!</span>
          </div>
        )}

        {/* Coaching: type instruction */}
        {!isAutoMode && (action === 'type' || action === 'clear-and-type') && step.typeText && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-blue-50 border border-blue-100">
            <span className="text-[11px] font-semibold text-blue-700">
              Type: <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900 text-[10px]">{step.typeText}</code>
            </span>
          </div>
        )}

        {/* Coaching: select instruction */}
        {!isAutoMode && action === 'select' && step.selectValue && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-purple-50 border border-purple-100">
            <span className="text-[11px] font-semibold text-purple-700">
              Select: <code className="bg-purple-100 px-1.5 py-0.5 rounded text-purple-900 text-[10px]">{step.selectValue}</code>
            </span>
          </div>
        )}

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

            {/* Skip Section button */}
            {currentSection && !isLast && onSkipSection && (
              <button
                onClick={onSkipSection}
                className="compact-btn flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-600 text-[10px] font-medium transition border border-amber-200"
                style={{ minHeight: 'auto' }}
                title={`Skip "${currentSection}" section`}
              >
                <SkipForward size={10} />
                Skip
              </button>
            )}

            {coaching && action === 'click' ? (
              !isLast && (
                <button
                  onClick={onNext}
                  className="compact-btn flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs font-medium transition"
                  style={{ minHeight: 'auto' }}
                >
                  Skip
                  <ChevronRight size={12} />
                </button>
              )
            ) : (
              <button
                onClick={onNext}
                className="compact-btn flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition"
                style={{ minHeight: 'auto' }}
              >
                {isLast ? (
                  <><Check size={12} /> Done</>
                ) : (
                  <>Next <ChevronRight size={12} /></>
                )}
              </button>
            )}

            {coaching && action === 'click' && isLast && (
              <button
                onClick={onEnd}
                className="compact-btn flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition"
                style={{ minHeight: 'auto' }}
              >
                <Check size={12} /> Done
              </button>
            )}
          </div>
        </div>

        {/* Step counter */}
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          Step {currentIndex + 1} of {totalSteps}
          {isAutoMode && <span className="ml-1 text-amber-500">- auto demo</span>}
          {coaching && !isAutoMode && <span className="ml-1 text-green-500">- watching your action</span>}
        </p>
      </div>
    </div>
  )
}
