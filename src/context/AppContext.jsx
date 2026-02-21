import { createContext, useContext, useReducer, useEffect } from 'react'

const AppContext = createContext(null)

const STORAGE_KEY = 'ws_state'

// Load persisted state
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch (e) {
    console.error('Failed to load state:', e)
  }
  return null
}

const initialState = {
  user: null,         // { id, name, username, role, camp_id, camp_code, camp_name, token }
  selectedCampId: null, // For managers who can switch camp views
  camps: [],          // All camps list
  modules: [],        // Enabled module IDs for user's camp: ['stores', 'kitchen', ...]
  permissions: {},    // Per-module permissions: { stores: ['view', 'create'], ... }
  notifications: [],
  isLoading: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        user: action.payload.user,
        camps: action.payload.camps || state.camps,
        modules: action.payload.modules || [],
        permissions: action.payload.permissions || {},
        selectedCampId: action.payload.user.camp_id || null,
      }

    case 'LOGOUT':
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem('ws_token')
      return { ...initialState }

    case 'SET_CAMPS':
      return { ...state, camps: action.payload }

    case 'SELECT_CAMP':
      return { ...state, selectedCampId: action.payload }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications].slice(0, 50),
      }

    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload ? { ...n, is_read: true } : n
        ),
      }

    case 'RESTORE_STATE':
      return { ...state, ...action.payload }

    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Restore state on mount
  useEffect(() => {
    const saved = loadState()
    if (saved?.user) {
      dispatch({ type: 'RESTORE_STATE', payload: saved })
    }
  }, [])

  // Persist state on change
  useEffect(() => {
    if (state.user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        user: state.user,
        selectedCampId: state.selectedCampId,
        camps: state.camps,
        modules: state.modules,
        permissions: state.permissions,
      }))
    }
  }, [state.user, state.selectedCampId, state.camps])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}

// Convenience hooks
export function useUser() {
  const { state } = useApp()
  return state.user
}

export function useSelectedCamp() {
  const { state } = useApp()
  const campId = state.selectedCampId
  const camp = state.camps.find(c => c.id === campId)
  return { campId, camp, camps: state.camps }
}

export function isManager(role) {
  return ['stores_manager', 'procurement_officer', 'director', 'admin'].includes(role)
}

export function isCampStaff(role) {
  return ['camp_storekeeper', 'chef', 'housekeeping', 'camp_manager'].includes(role)
}
