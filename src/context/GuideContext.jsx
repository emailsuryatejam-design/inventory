import { createContext, useContext, useReducer, useEffect } from 'react'

const GuideContext = createContext(null)

const STORAGE_KEY = 'karibu_guide_data'

// Safe center — avoids SSR/early-mount issues
function getSafeCenter() {
  if (typeof window === 'undefined') return { x: 200, y: 400 }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

const initialState = {
  // Panel
  isPanelOpen: false,
  // Active walkthrough
  activeGuide: null,
  currentStepIndex: 0,
  isRunning: false,
  // Target tracking
  targetRect: null,
  // Cursor
  cursorPosition: getSafeCenter(),
  cursorVisible: false,
  // Report form
  isReportFormOpen: false,
  // Persistence
  completedGuides: [],
  reports: [],
}

function guideReducer(state, action) {
  switch (action.type) {
    case 'OPEN_PANEL':
      return { ...state, isPanelOpen: true }
    case 'CLOSE_PANEL':
      return { ...state, isPanelOpen: false }
    case 'TOGGLE_PANEL':
      return { ...state, isPanelOpen: !state.isPanelOpen }

    case 'START_GUIDE':
      return {
        ...state,
        activeGuide: action.payload,
        currentStepIndex: 0,
        isRunning: true,
        isPanelOpen: false,
        cursorVisible: false,
        targetRect: null,
        cursorPosition: getSafeCenter(),
      }
    case 'NEXT_STEP': {
      const nextIndex = state.currentStepIndex + 1
      const totalSteps = state.activeGuide?.steps?.length || 0
      if (nextIndex >= totalSteps) {
        // Guide complete
        return {
          ...state,
          activeGuide: null,
          currentStepIndex: 0,
          isRunning: false,
          targetRect: null,
          cursorVisible: false,
          cursorPosition: getSafeCenter(),
          completedGuides: state.activeGuide
            ? [...new Set([...state.completedGuides, state.activeGuide.id])]
            : state.completedGuides,
        }
      }
      return {
        ...state,
        currentStepIndex: nextIndex,
        cursorVisible: false,
        targetRect: null,
      }
    }
    case 'PREV_STEP':
      return {
        ...state,
        currentStepIndex: Math.max(0, state.currentStepIndex - 1),
        cursorVisible: false,
        targetRect: null,
      }
    case 'GO_TO_STEP':
      return { ...state, currentStepIndex: action.payload, cursorVisible: false, targetRect: null }

    case 'SET_TARGET_RECT':
      return { ...state, targetRect: action.payload }
    case 'SET_CURSOR':
      return {
        ...state,
        cursorPosition: action.payload,
        cursorVisible: true,
      }
    case 'HIDE_CURSOR':
      return { ...state, cursorVisible: false }

    case 'END_GUIDE': {
      const completed = state.activeGuide && state.currentStepIndex >= (state.activeGuide.steps?.length || 0) - 1
      return {
        ...state,
        activeGuide: null,
        currentStepIndex: 0,
        isRunning: false,
        targetRect: null,
        cursorVisible: false,
        cursorPosition: getSafeCenter(),
        completedGuides: completed && state.activeGuide
          ? [...new Set([...state.completedGuides, state.activeGuide.id])]
          : state.completedGuides,
      }
    }

    case 'OPEN_REPORT':
      return { ...state, isReportFormOpen: true }
    case 'CLOSE_REPORT':
      return { ...state, isReportFormOpen: false }
    case 'ADD_REPORT':
      return { ...state, reports: [...state.reports, action.payload], isReportFormOpen: false }

    case 'LOAD_PERSISTED':
      return {
        ...state,
        completedGuides: action.payload.completedGuides || [],
        reports: action.payload.reports || [],
      }

    default:
      return state
  }
}

export function GuideProvider({ children }) {
  const [state, dispatch] = useReducer(guideReducer, initialState)

  // Load persisted data on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        dispatch({ type: 'LOAD_PERSISTED', payload: JSON.parse(saved) })
      }
    } catch { /* ignore */ }
  }, [])

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        completedGuides: state.completedGuides,
        reports: state.reports,
      }))
    } catch { /* ignore */ }
  }, [state.completedGuides, state.reports])

  return (
    <GuideContext.Provider value={{ state, dispatch }}>
      {children}
    </GuideContext.Provider>
  )
}

export function useGuideContext() {
  const ctx = useContext(GuideContext)
  if (!ctx) throw new Error('useGuideContext must be used within GuideProvider')
  return ctx
}

export default GuideContext
