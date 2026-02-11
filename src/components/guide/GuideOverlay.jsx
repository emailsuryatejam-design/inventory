import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import useGuide from '../../hooks/useGuide'
import SpotlightMask from './SpotlightMask'
import AnimatedCursor from './AnimatedCursor'
import GuideTooltip from './GuideTooltip'

/**
 * Master overlay that orchestrates the guide walkthrough:
 * - Navigates to the step's route if needed
 * - Finds the target element via CSS selector
 * - Scrolls it into view, measures its rect
 * - Animates the cursor to the target
 * - Shows spotlight + tooltip
 * - Listens for advance trigger (click on target or Next button)
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

  // Cleanup function
  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
    if (clickHandlerRef.current) {
      clickHandlerRef.current.el?.removeEventListener('click', clickHandlerRef.current.fn)
      clickHandlerRef.current = null
    }
    if (resizeObsRef.current) {
      resizeObsRef.current.disconnect()
      resizeObsRef.current = null
    }
  }, [])

  // Run step logic whenever the step changes
  useEffect(() => {
    if (!isRunning || !currentStep) return

    cleanup()
    runStep(currentStep)

    return cleanup
  }, [isRunning, currentStepIndex, activeGuide?.id])

  // Re-measure on scroll/resize
  useEffect(() => {
    if (!isRunning) return

    function remeasure() {
      if (!currentStep) return
      const el = document.querySelector(currentStep.target)
      if (el) {
        const rect = el.getBoundingClientRect()
        setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right })
      }
    }

    window.addEventListener('scroll', remeasure, true)
    window.addEventListener('resize', remeasure)
    return () => {
      window.removeEventListener('scroll', remeasure, true)
      window.removeEventListener('resize', remeasure)
    }
  }, [isRunning, currentStep])

  async function runStep(step) {
    // 1. Navigate to route if needed
    if (step.route) {
      const currentPath = location.pathname
      if (currentPath !== step.route) {
        navigate(step.route)
        await wait(400) // wait for route change render
      }
    }

    // 2. Find target element (poll up to 3s)
    const el = await findElement(step.target, 3000)
    if (!el) {
      // Target not found — skip or show error
      console.warn(`Guide target not found: ${step.target}`)
      return
    }

    // 3. Scroll into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    await wait(350)

    // 4. Measure target rect
    const rect = el.getBoundingClientRect()
    const targetData = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    }
    setTargetRect(targetData)

    // 5. Animate cursor to target center
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    setCursor({ x: cx, y: cy })

    // 6. Set up ResizeObserver to track target
    if (window.ResizeObserver) {
      resizeObsRef.current = new ResizeObserver(() => {
        const r = el.getBoundingClientRect()
        setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right })
      })
      resizeObsRef.current.observe(el)
    }

    // 7. Set up advance trigger
    if (step.advanceOn === 'click') {
      const handler = () => {
        cleanup()
        nextStep()
      }
      el.addEventListener('click', handler, { once: true })
      clickHandlerRef.current = { el, fn: handler }
    }
    // For 'next-button' or default — user clicks Next in tooltip
  }

  function findElement(selector, timeout = 3000) {
    return new Promise((resolve) => {
      const start = Date.now()
      function poll() {
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
      <SpotlightMask targetRect={targetRect} onClick={handleEnd} />
      <AnimatedCursor position={cursorPosition} visible={cursorVisible} />
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
      />
    </>,
    document.body
  )
}
