import { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useGuideContext } from '../context/GuideContext'

export default function useGuide() {
  const { state, dispatch } = useGuideContext()
  const navigate = useNavigate()
  const location = useLocation()

  const openPanel = useCallback(() => dispatch({ type: 'OPEN_PANEL' }), [dispatch])
  const closePanel = useCallback(() => dispatch({ type: 'CLOSE_PANEL' }), [dispatch])
  const togglePanel = useCallback(() => dispatch({ type: 'TOGGLE_PANEL' }), [dispatch])

  const startGuide = useCallback((guide) => {
    dispatch({ type: 'START_GUIDE', payload: guide })
  }, [dispatch])

  const nextStep = useCallback(() => dispatch({ type: 'NEXT_STEP' }), [dispatch])
  const prevStep = useCallback(() => dispatch({ type: 'PREV_STEP' }), [dispatch])
  const endGuide = useCallback(() => dispatch({ type: 'END_GUIDE' }), [dispatch])

  const setTargetRect = useCallback((rect) => {
    dispatch({ type: 'SET_TARGET_RECT', payload: rect })
  }, [dispatch])

  const setCursor = useCallback((pos) => {
    dispatch({ type: 'SET_CURSOR', payload: pos })
  }, [dispatch])

  const hideCursor = useCallback(() => dispatch({ type: 'HIDE_CURSOR' }), [dispatch])

  const openReport = useCallback(() => dispatch({ type: 'OPEN_REPORT' }), [dispatch])
  const closeReport = useCallback(() => dispatch({ type: 'CLOSE_REPORT' }), [dispatch])

  const addReport = useCallback((report) => {
    dispatch({
      type: 'ADD_REPORT',
      payload: {
        ...report,
        id: Date.now(),
        timestamp: new Date().toISOString(),
        page: location.pathname,
      },
    })
  }, [dispatch, location])

  const navigateToRoute = useCallback((route) => {
    const currentPath = location.pathname
    if (currentPath !== route) {
      navigate(route)
    }
  }, [navigate, location])

  const currentStep = state.activeGuide?.steps?.[state.currentStepIndex] || null
  const totalSteps = state.activeGuide?.steps?.length || 0
  const isLastStep = state.currentStepIndex >= totalSteps - 1
  const isFirstStep = state.currentStepIndex === 0

  return {
    // State
    ...state,
    currentStep,
    totalSteps,
    isLastStep,
    isFirstStep,

    // Actions
    openPanel,
    closePanel,
    togglePanel,
    startGuide,
    nextStep,
    prevStep,
    endGuide,
    setTargetRect,
    setCursor,
    hideCursor,
    openReport,
    closeReport,
    addReport,
    navigateToRoute,
  }
}
