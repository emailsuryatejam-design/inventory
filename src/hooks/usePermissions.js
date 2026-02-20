/**
 * Module & Permission hooks
 * Usage:
 *   const canView = useCanAccess('kitchen')
 *   const canCreate = useCanAccess('stores', 'create')
 *   const modules = useModules()
 */
import { useApp } from '../context/AppContext'

/**
 * Check if current user can access a module (and optionally a permission)
 * @param {string} module  - Module ID ('stores', 'kitchen', 'bar', etc.)
 * @param {string} [permission='view'] - Permission ('view', 'create', 'edit', 'approve', 'delete', 'export')
 * @returns {boolean}
 */
export function useCanAccess(module, permission = 'view') {
  const { state } = useApp()

  // If modules haven't loaded yet (legacy sessions), allow everything
  if (!state.modules || state.modules.length === 0) return true

  // Check module is enabled for user's camp
  if (!state.modules.includes(module)) return false

  // If no specific permission needed, module access is sufficient
  if (!permission) return true

  // Check permission within module
  return state.permissions?.[module]?.includes(permission) ?? false
}

/**
 * Get list of enabled modules for current user's camp
 * @returns {string[]}
 */
export function useModules() {
  const { state } = useApp()
  return state.modules || []
}

/**
 * Get all permissions for a specific module
 * @param {string} module
 * @returns {string[]}
 */
export function useModulePermissions(module) {
  const { state } = useApp()
  return state.permissions?.[module] || []
}
