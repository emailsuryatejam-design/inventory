import { Link } from 'react-router-dom'
import { Clock, AlertTriangle } from 'lucide-react'
import { useTenant } from '../../context/AppContext'

/**
 * Thin banner below TopBar for trial tenants.
 * - Active trial: amber banner with days remaining
 * - Expired trial: red banner with upgrade prompt
 * - Hidden for non-trial or null tenant
 */
export default function TrialBanner() {
  const tenant = useTenant()

  if (!tenant || tenant.plan !== 'trial') return null
  if (tenant.status === 'active' && tenant.plan !== 'trial') return null

  const now = new Date()
  const trialEnd = new Date(tenant.trial_end)
  const diffMs = trialEnd - now
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
  const isExpired = daysLeft <= 0

  if (isExpired) {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-center gap-2 text-sm">
        <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
        <span className="text-red-700 font-medium">Your trial has expired.</span>
        <Link to="/pricing" className="text-red-600 font-semibold underline underline-offset-2 hover:text-red-800 ml-1">
          Upgrade to continue →
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-center gap-2 text-sm">
      <Clock size={15} className="text-amber-500 flex-shrink-0" />
      <span className="text-amber-800">
        <span className="font-medium">{daysLeft} day{daysLeft !== 1 ? 's' : ''}</span> left on your free trial
      </span>
      <Link to="/pricing" className="text-amber-600 font-semibold underline underline-offset-2 hover:text-amber-800 ml-1">
        View Plans
      </Link>
    </div>
  )
}
