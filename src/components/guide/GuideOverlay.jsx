import { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import useGuide from '../../hooks/useGuide'
import SpotlightMask from './SpotlightMask'
import AnimatedCursor from './AnimatedCursor'
import GuideTooltip from './GuideTooltip'
import AutoCountdown from './AutoCountdown'

/**
 * Real-time coaching overlay that guides users through actual task performance:
 *
 * - Navigates to the step's route if needed
 * - Finds the target element via CSS selector
 * - Scrolls it into view, measures its rect
 * - Animates the cursor to the target
 * - Shows spotlight + tooltip with coaching prompts
 *
 * Supports action types: click, type, clear-and-type, select, observe
 * In auto mode: executes actions automatically (typewriter for text, programmatic select/click)
 * In coaching mode: shows instructions for the user to perform manually
 *
 * Section skip: users can skip entire sections of a demo guide.
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
    guideMode,
    nextStep,
    prevStep,
    endGuide,
    setTargetRect,
    setCursor,
    hideCursor,
    skipSection,
    currentSection,
  } = useGuide()

  const navigate = useNavigate()
  const location = useLocation()
  const pollRef = useRef(null)
  const clickHandlerRef = useRef(null)
  const resizeObsRef = useRef(null)
  const routeWatchRef = useRef(null)
  const advancePendingRef = useRef(false)
  const stepRef = useRef(null)
  const abortRef = useRef(false)

  // Determine effective action for current step
  const effectiveAction = currentStep?.action || (currentStep?.advanceOn === 'click' ? 'click' : 'observe')

  // Track whether current step is coaching mode (click-through)
  // Only click actions in coaching mode get click-through overlay
  const isCoachingStep = effectiveAction === 'click' && guideMode !== 'auto'

  // Auto-advance state
  const autoTimerRef = useRef(null)
  const [autoCountdown, setAutoCountdown] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const isAutoMode = guideMode === 'auto'

  useEffect(() => {
    stepRef.current = currentStep
  }, [currentStep])

  const cleanup = useCallback(() => {
    abortRef.current = true
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
    if (clickHandlerRef.current) {
      clickHandlerRef.current.el?.removeEventListener('click', clickHandlerRef.current.fn, true)
      clickHandlerRef.current = null
    }
    if (resizeObsRef.current) { resizeObsRef.current.disconnect(); resizeObsRef.current = null }
    if (routeWatchRef.current) { clearInterval(routeWatchRef.current); routeWatchRef.current = null }
    if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null }
    setAutoCountdown(0)
    setIsTyping(false)
    advancePendingRef.current = false
  }, [])

  // Lock body scroll while guide is running
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
  useEffect(() => {
    if (!isRunning || !advancePendingRef.current) return
    const step = stepRef.current
    if (step?.advanceOn === 'click' && step?.route) {
      const nextStepData = activeGuide?.steps?.[currentStepIndex + 1]
      if (nextStepData?.route && location.pathname === nextStepData.route) {
        advancePendingRef.current = false
        cleanup()
        nextStep()
        return
      }
      if (location.pathname !== step.route) {
        advancePendingRef.current = false
        cleanup()
        nextStep()
        return
      }
    }
  }, [location.pathname, isRunning])

  // Auto-advance effect for 'auto' mode — action-aware
  useEffect(() => {
    if (!isRunning || !isAutoMode || !targetRect || !currentStep) return

    const step = currentStep
    const action = step.action || (step.advanceOn === 'click' ? 'click' : 'observe')
    const delay = step.delay ?? 2000

    // For observe steps, just countdown then advance
    if (action === 'observe') {
      setAutoCountdown(delay / 1000)
      autoTimerRef.current = setTimeout(() => {
        if (abortRef.current) return
        setAutoCountdown(0)
        advanceAfterAction()
      }, delay)
      return cleanupAutoTimer
    }

    // For action steps, brief countdown then execute
    const preDelay = Math.min(delay, 1500)
    setAutoCountdown(preDelay / 1000)
    autoTimerRef.current = setTimeout(async () => {
      if (abortRef.current) return
      setAutoCountdown(0)

      const el = document.querySelector(step.target)
      if (!el) { advanceAfterAction(); return }

      try {
        await executeAction(el, step, action)
      } catch (err) {
        console.warn('Auto-action failed:', err)
      }

      if (abortRef.current) return
      const settleDelay = (action === 'type' || action === 'clear-and-type') ? 300 : 400
      await wait(settleDelay)
      if (abortRef.current) return
      advanceAfterAction()
    }, preDelay)

    return cleanupAutoTimer
  }, [isRunning, isAutoMode, targetRect, currentStepIndex])

  // Re-measure on scroll/resize
  useEffect(() => {
    if (!isRunning || !currentStep) return
    function remeasure() {
      const el = document.querySelector(currentStep.target)
      if (el) {
        const rect = el.getBoundingClientRect()
        setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right })
      }
    }
    window.addEventListener('scroll', remeasure, { capture: true, passive: true })
    window.addEventListener('resize', remeasure, { passive: true })
    return () => {
      window.removeEventListener('scroll', remeasure, { capture: true })
      window.removeEventListener('resize', remeasure)
    }
  }, [isRunning, currentStepIndex])

  // ─── Action Execution Engine ───

  async function executeAction(el, step, action) {
    switch (action) {
      case 'click':
        el.click()
        break

      case 'type':
      case 'clear-and-type': {
        const text = step.typeText || ''
        const speed = step.typeSpeed || 50

        el.focus()
        await wait(200)
        if (abortRef.current) return

        // Clear existing value using native setter for React compatibility
        if (action === 'clear-and-type' || el.value) {
          setNativeValue(el, '')
          el.dispatchEvent(new Event('input', { bubbles: true }))
          await wait(100)
          if (abortRef.current) return
        }

        // Typewriter: type character by character
        setIsTyping(true)
        for (let i = 0; i < text.length; i++) {
          if (abortRef.current) { setIsTyping(false); return }
          setNativeValue(el, text.slice(0, i + 1))
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
          await wait(speed)
        }
        setIsTyping(false)
        break
      }

      case 'select': {
        const value = step.selectValue || ''
        el.focus()
        await wait(200)
        if (abortRef.current) return

        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
        if (nativeSetter) {
          nativeSetter.call(el, value)
        } else {
          el.value = value
        }
        el.dispatchEvent(new Event('change', { bubbles: true }))
        break
      }

      case 'focus':
        el.focus()
        break

      default:
        break
    }
  }

  /** Set input/textarea value using native setter to work with React controlled inputs */
  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) {
      setter.call(el, value)
    } else {
      el.value = value
    }
  }

  function advanceAfterAction() {
    if (isLastStep) {
      endGuide()
    } else {
      if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
      if (clickHandlerRef.current) {
        clickHandlerRef.current.el?.removeEventListener('click', clickHandlerRef.current.fn, true)
        clickHandlerRef.current = null
      }
      if (resizeObsRef.current) { resizeObsRef.current.disconnect(); resizeObsRef.current = null }
      if (routeWatchRef.current) { clearInterval(routeWatchRef.current); routeWatchRef.current = null }
      if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null }
      advancePendingRef.current = false
      nextStep()
    }
  }

  function cleanupAutoTimer() {
    if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null }
    setAutoCountdown(0)
  }

  // ─── Step Runner ───

  async function runStep(step) {
    if (step.route) {
      const currentPath = location.pathname
      if (currentPath !== step.route) {
        navigate(step.route)
        await wait(500)
        if (abortRef.current) return
      }
    }

    const el = await findElement(step.target, 5000)
    if (abortRef.current) return
    if (!el) {
      console.warn(`Guide target not found: ${step.target}`)
      if (!isLastStep) nextStep()
      return
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    await wait(400)
    if (abortRef.current) return

    const rect = el.getBoundingClientRect()
    setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right })

    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    setCursor({ x: cx, y: cy })

    if (window.ResizeObserver) {
      resizeObsRef.current = new ResizeObserver(() => {
        if (abortRef.current) return
        const r = el.getBoundingClientRect()
        setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right })
      })
      resizeObsRef.current.observe(el)
    }

    // For click-type steps in coaching mode, set up click listener
    const action = step.action || (step.advanceOn === 'click' ? 'click' : 'observe')
    if (action === 'click' && guideMode !== 'auto') {
      setupCoachingAdvance(el, step)
    }
  }

  function setupCoachingAdvance(el, step) {
    const handler = () => {
      advancePendingRef.current = true
      setTimeout(() => {
        if (advancePendingRef.current) {
          advancePendingRef.current = false
          cleanup()
          nextStep()
        }
      }, 600)
    }
    el.addEventListener('click', handler, { capture: true, once: true })
    clickHandlerRef.current = { el, fn: handler }

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
    if (isLastStep) endGuide()
    else nextStep()
  }

  function handlePrev() {
    cleanup()
    prevStep()
  }

  function handleEnd() {
    cleanup()
    endGuide()
  }

  function handleSkipSection() {
    cleanup()
    skipSection()
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
        onSkipSection={handleSkipSection}
        isFirst={isFirstStep}
        isLast={isLastStep}
        coaching={isCoachingStep}
        isAutoMode={isAutoMode}
        isTyping={isTyping}
        currentSection={currentSection}
      />
      {isAutoMode && autoCountdown > 0 && targetRect && (
        <AutoCountdown
          targetRect={targetRect}
          duration={autoCountdown}
        />
      )}
    </>,
    document.body
  )
}
