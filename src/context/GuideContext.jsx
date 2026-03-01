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
  // Guide mode: 'coaching' (user clicks) or 'auto' (auto-advance)
  guideMode: 'coaching',
  // Target tracking
  targetRect: null,
  // Cursor
  cursorPosition: getSafeCenter(),
  cursorVisible: false,
  // Report form
  isReportFormOpen: false,
  // Section skip tracking
  skippedSections: [],
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
        skippedSections: [],
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

    case 'SKIP_SECTION': {
      const currentSection = state.activeGuide?.steps?.[state.currentStepIndex]?.section
      if (!currentSection || !state.activeGuide) return state
      const steps = state.activeGuide.steps
      let nextSectionIndex = -1
      for (let i = state.currentStepIndex + 1; i < steps.length; i++) {
        if (steps[i].section !== currentSection) {
          nextSectionIndex = i
          break
        }
      }
      if (nextSectionIndex === -1) {
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
          skippedSections: [...state.skippedSections, currentSection],
        }
      }
      return {
        ...state,
        currentStepIndex: nextSectionIndex,
        cursorVisible: false,
        targetRect: null,
        skippedSections: [...state.skippedSections, currentSection],
      }
    }

    case 'GO_TO_SECTION': {
      const sectionName = action.payload
      if (!state.activeGuide) return state
      const idx = state.activeGuide.steps.findIndex(s => s.section === sectionName)
      if (idx === -1) return state
      return {
        ...state,
        currentStepIndex: idx,
        cursorVisible: false,
        targetRect: null,
      }
    }

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
        skippedSections: [],
        completedGuides: completed && state.activeGuide
          ? [...new Set([...state.completedGuides, state.activeGuide.id])]
          : state.completedGuides,
      }
    }

    case 'SET_GUIDE_MODE':
      return { ...state, guideMode: action.payload }

    case 'COMPLETE_GUIDE':
      return {
        ...state,
        completedGuides: [...new Set([...state.completedGuides, action.payload])],
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
        guideMode: action.payload.guideMode || 'coaching',
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
        guideMode: state.guideMode,
      }))
    } catch { /* ignore */ }
  }, [state.completedGuides, state.reports, state.guideMode])

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
