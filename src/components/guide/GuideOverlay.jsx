import { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import useGuide from '../../hooks/useGuide'
import SpotlightMask from './SpotlightMask'
import AnimatedCursor from './AnimatedCursor'
import GuideTooltip from './GuideTooltip'

/**
 * Real-time coaching overlay that guides users through actual task performance:
 *
 * - Navigates to the step's route if needed
 * - Finds the target element via CSS selector
 * - Scrolls it into view, measures its rect
 * - Animates the cursor to the target
 * - Shows spotlight + tooltip with coaching prompts
 *
 * For advanceOn: 'click' steps:
 *   - Overlay becomes click-through (pointer-events: none)
 *   - Watches for real user clicks on the target element
 *   - Monitors route changes after navigation-type clicks
 *   - Auto-advances when the user performs the expected action
 *
 * For advanceOn: 'next-button' steps:
 *   - Traditional mode — user reads info and clicks Next
 *
 * Fixes:
 * - Scroll/resize listeners cleaned up properly (single memoized handler)
 * - Longer polling timeout (5s) with user feedback
 * - Scroll lock during guide (overflow:hidden, not touch-action:none)
 * - Passive scroll listeners
 * - ResizeObserver cleaned up per step
 * - Abort flag for async runStep
 */
export default function GuideOverlay() {
  const {
    isRunning,
    activeGuide,
    currentStepIndex,
    currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    targetRect,
    cursorPosition,
    cursorVisible,
    nextStep,
    prevStep,
    endGuide,
    setTargetRect,
    setCursor,
    hideCursor,
  } = useGuide()

  const navigate = useNavigate()
  const location = useLocation()
  const pollRef = useRef(null)
  const clickHandlerRef = useRef(null)
  const resizeObsRef = useRef(null)
  const routeWatchRef = useRef(null)
  const advancePendingRef = useRef(false)
  const stepRef = useRef(null)
  const abortRef = useRef(false) // abort flag for async runStep

  // Track whether current step is coaching mode (click-through)
  const isCoachingStep = currentStep?.advanceOn === 'click'

  // Keep stepRef current
  useEffect(() => {
    stepRef.current = currentStep
  }, [currentStep])

  // Cleanup function
  const cleanup = useCallback(() => {
    abortRef.current = true
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
    if (clickHandlerRef.current) {
      clickHandlerRef.current.el?.removeEventListener('click', clickHandlerRef.current.fn, true)
      clickHandlerRef.current = null
    }
    if (resizeObsRef.current) {
      resizeObsRef.current.disconnect()
      resizeObsRef.current = null
    }
    if (routeWatchRef.current) {
      clearInterval(routeWatchRef.current)
      routeWatchRef.current = null
    }
    advancePendingRef.current = false
  }, [])

  // Lock body scroll while guide is running
  // NOTE: We use overflow:hidden instead of lockScroll() because
  // lockScroll() sets touch-action:none which blocks tap events on the
  // spotlight target elements. We only need to prevent background scrolling.
  useEffect(() => {
    if (isRunning) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isRunning])

  // Run step logic whenever the step changes
  useEffect(() => {
    if (!isRunning || !currentStep) return

    cleanup()
    abortRef.current = false
    runStep(currentStep)

    return cleanup
  }, [isRunning, currentStepIndex, activeGuide?.id])

  // Watch for route changes to auto-advance coaching steps
  // (user clicked a nav link → route changes → advance to next step)
  useEffect(() => {
    if (!isRunning || !advancePendingRef.current) return

    // The route changed, and we had a pending advance — trigger it
    const step = stepRef.current
    if (step?.advanceOn === 'click' && step?.route) {
      // Check if the new route matches what the next step expects
      const nextStepData = activeGuide?.steps?.[currentStepIndex + 1]
      if (nextStepData?.route && location.pathname === nextStepData.route) {
        // Route matches next step's expected route — advance!
        advancePendingRef.current = false
        cleanup()
        nextStep()
        return
      }
      // Also advance if route changed away from current step's route
      if (location.pathname !== step.route) {
        advancePendingRef.current = false
        cleanup()
        nextStep()
        return
      }
    }
  }, [location.pathname, isRunning])

  // Re-measure on scroll/resize (single memoized handler)
  useEffect(() => {
    if (!isRunning || !currentStep) return

    function remeasure() {
      const el = document.querySelector(currentStep.target)
      if (el) {
        const rect = el.getBoundingClientRect()
        setTargetRect({
          top: rect.top, left: rect.left,
          width: rect.width, height: rect.height,
          bottom: rect.bottom, right: rect.right,
        })
      }
    }

    window.addEventListener('scroll', remeasure, { capture: true, passive: true })
    window.addEventListener('resize', remeasure, { passive: true })
    return () => {
      window.removeEventListener('scroll', remeasure, { capture: true })
      window.removeEventListener('resize', remeasure)
    }
  }, [isRunning, currentStepIndex])

  async function runStep(step) {
    // 1. Navigate to route if needed
    if (step.route) {
      const currentPath = location.pathname
      if (currentPath !== step.route) {
        navigate(step.route)
        await wait(500) // wait for route change render
        if (abortRef.current) return
      }
    }

    // 2. Find target element (poll up to 5s)
    const el = await findElement(step.target, 5000)
    if (abortRef.current) return
    if (!el) {
      console.warn(`Guide target not found: ${step.target}`)
      // Auto-skip to next step if target missing
      if (!isLastStep) {
        nextStep()
      }
      return
    }

    // 3. Scroll into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    await wait(400)
    if (abortRef.current) return

    // 4. Measure target rect
    const rect = el.getBoundingClientRect()
    setTargetRect({
      top: rect.top, left: rect.left,
      width: rect.width, height: rect.height,
      bottom: rect.bottom, right: rect.right,
    })

    // 5. Animate cursor to target center
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    setCursor({ x: cx, y: cy })

    // 6. Set up ResizeObserver to track target position changes
    if (window.ResizeObserver) {
      resizeObsRef.current = new ResizeObserver(() => {
        if (abortRef.current) return
        const r = el.getBoundingClientRect()
        setTargetRect({
          top: r.top, left: r.left,
          width: r.width, height: r.height,
          bottom: r.bottom, right: r.right,
        })
      })
      resizeObsRef.current.observe(el)
    }

    // 7. Set up advance trigger based on step type
    if (step.advanceOn === 'click') {
      setupCoachingAdvance(el, step)
    }
    // For 'next-button' — user clicks Next in tooltip (default behavior)
  }

  /**
   * Real-time coaching: watch for the user's actual click on the target
   * and auto-advance. The overlay is click-through so clicks reach the target.
   */
  function setupCoachingAdvance(el, step) {
    // Use capture phase to detect the click BEFORE it triggers navigation
    const handler = (e) => {
      // Mark that we're expecting a route change after this click
      advancePendingRef.current = true

      // Small delay to let the click event propagate and trigger navigation/action
      setTimeout(() => {
        // If route hasn't changed yet (non-navigation click), advance immediately
        if (advancePendingRef.current) {
          advancePendingRef.current = false
          cleanup()
          nextStep()
        }
      }, 600)
    }

    // Listen on capture phase so we catch it before React handles navigation
    el.addEventListener('click', handler, { capture: true, once: true })
    clickHandlerRef.current = { el, fn: handler }

    // Backup: watch for route changes via polling (for hash router edge cases)
    if (step.route) {
      const startPath = window.location.hash || window.location.pathname
      routeWatchRef.current = setInterval(() => {
        const currentPath = window.location.hash || window.location.pathname
        if (currentPath !== startPath) {
          clearInterval(routeWatchRef.current)
          routeWatchRef.current = null
          if (advancePendingRef.current) {
            advancePendingRef.current = false
            cleanup()
            nextStep()
          }
        }
      }, 200)
    }
  }

  function findElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const start = Date.now()
      function poll() {
        if (abortRef.current) return resolve(null)
        const el = document.querySelector(selector)
        if (el) return resolve(el)
        if (Date.now() - start > timeout) return resolve(null)
        pollRef.current = setTimeout(poll, 150)
      }
      poll()
    })
  }

  function wait(ms) {
    return new Promise(resolve => { pollRef.current = setTimeout(resolve, ms) })
  }

  function handleNext() {
    cleanup()
    if (isLastStep) {
      endGuide()
    } else {
      nextStep()
    }
  }

  function handlePrev() {
    cleanup()
    prevStep()
  }

  function handleEnd() {
    cleanup()
    endGuide()
  }

  if (!isRunning || !activeGuide) return null

  return createPortal(
    <>
      <SpotlightMask
        targetRect={targetRect}
        onClick={handleEnd}
        clickThrough={isCoachingStep}
      />
      <AnimatedCursor
        position={cursorPosition}
        visible={cursorVisible}
        coaching={isCoachingStep}
      />
      <GuideTooltip
        step={currentStep}
        targetRect={targetRect}
        currentIndex={currentStepIndex}
        totalSteps={totalSteps}
        onNext={handleNext}
        onPrev={handlePrev}
        onEnd={handleEnd}
        isFirst={isFirstStep}
        isLast={isLastStep}
        coaching={isCoachingStep}
      />
    </>,
    document.body
  )
}
