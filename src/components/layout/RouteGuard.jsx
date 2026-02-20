import { useUser, isManager } from '../../context/AppContext'
import { useCanAccess } from '../../hooks/usePermissions'
import AccessDenied from '../../pages/AccessDenied'

/**
 * RouteGuard — wraps protected routes with role + module checks.
 *
 * Props:
 *   access   — 'all' (any logged-in user) | 'manager' (managers only)
 *   roles    — Array of specific roles allowed (overrides access)
 *   exclude  — Array of roles explicitly denied
 *   module   — Module ID — checked against camp's enabled modules
 *   children — The page component to render if allowed
 */
export default function RouteGuard({ children, access = 'all', roles, exclude, module }) {
  const user = useUser()
  const moduleEnabled = useCanAccess(module)

  if (!user) return null // RequireAuth handles redirect

  const role = user.role

  // Check module availability for camp
  if (module && !moduleEnabled) {
    return <AccessDenied message="This module is not enabled for your camp. Contact your administrator." />
  }

  // Check exclusions
  if (exclude && exclude.includes(role)) {
    return <AccessDenied />
  }

  // Check specific roles list
  if (roles) {
    if (!roles.includes(role)) {
      return <AccessDenied />
    }
    return children
  }

  // Check access level
  if (access === 'manager' && !isManager(role)) {
    return <AccessDenied />
  }

  return children
}
