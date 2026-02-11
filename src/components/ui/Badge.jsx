const variants = {
  // Stock status
  out: 'bg-red-100 text-red-700',
  critical: 'bg-red-100 text-red-700',
  low: 'bg-amber-100 text-amber-700',
  ok: 'bg-green-100 text-green-700',
  excess: 'bg-blue-100 text-blue-700',

  // ABC class
  A: 'bg-red-100 text-red-700',
  B: 'bg-amber-100 text-amber-700',
  C: 'bg-gray-100 text-gray-600',

  // Storage type
  ambient: 'bg-gray-100 text-gray-600',
  chilled: 'bg-blue-100 text-blue-700',
  frozen: 'bg-cyan-100 text-cyan-700',
  hazardous: 'bg-red-100 text-red-700',

  // Order status
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  pending_review: 'bg-amber-100 text-amber-700',
  queried: 'bg-orange-100 text-orange-700',
  stores_approved: 'bg-green-100 text-green-700',
  stores_partial: 'bg-yellow-100 text-yellow-700',
  stores_rejected: 'bg-red-100 text-red-700',
  procurement_ready: 'bg-indigo-100 text-indigo-700',
  dispatching: 'bg-purple-100 text-purple-700',
  in_transit: 'bg-violet-100 text-violet-700',
  delivered: 'bg-teal-100 text-teal-700',
  received: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',

  // HACCP
  high_risk: 'bg-red-100 text-red-700',
  medium_risk: 'bg-amber-100 text-amber-700',
  low_risk: 'bg-green-100 text-green-700',
  non_food: 'bg-gray-100 text-gray-600',

  // Receipt / Issue status
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',

  // Issue types
  kitchen: 'bg-orange-100 text-orange-700',
  housekeeping: 'bg-violet-100 text-violet-700',
  bar: 'bg-pink-100 text-pink-700',
  maintenance: 'bg-slate-100 text-slate-700',
  guest: 'bg-teal-100 text-teal-700',
  office: 'bg-sky-100 text-sky-700',
  other: 'bg-gray-100 text-gray-600',

  // Condition
  good: 'bg-green-100 text-green-700',
  damaged: 'bg-red-100 text-red-700',
  short: 'bg-amber-100 text-amber-700',

  // Generic
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  default: 'bg-gray-100 text-gray-600',
}

const labels = {
  pending_review: 'Pending Review',
  stores_approved: 'Approved',
  stores_partial: 'Partial',
  stores_rejected: 'Rejected',
  procurement_ready: 'Procurement',
  in_transit: 'In Transit',
  high_risk: 'High Risk',
  medium_risk: 'Medium Risk',
  low_risk: 'Low Risk',
  non_food: 'Non-Food',
}

export default function Badge({ variant = 'default', children, className = '' }) {
  const colorClass = variants[variant] || variants.default
  const text = children || labels[variant] || variant?.replace(/_/g, ' ')

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colorClass} ${className}`}>
      {text}
    </span>
  )
}
