// Content-shaped loading placeholder
// Usage: <Skeleton className="h-4 w-32" /> or <Skeleton variant="card" />

export default function Skeleton({ className = '', variant, count = 1 }) {
  if (variant === 'card') {
    return (
      <div className="bg-white rounded-xl p-5 border border-gray-100" style={{ boxShadow: 'var(--shadow-xs)' }}>
        <div className="animate-skeleton bg-gray-100 rounded-lg h-4 w-24 mb-3" />
        <div className="animate-skeleton bg-gray-100 rounded-lg h-8 w-20 mb-2" />
        <div className="animate-skeleton bg-gray-100 rounded-lg h-3 w-32" />
      </div>
    )
  }

  if (variant === 'table-row') {
    return (
      <div className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-50">
        <div className="animate-skeleton bg-gray-100 rounded h-4 w-40" />
        <div className="animate-skeleton bg-gray-100 rounded h-4 w-20 ml-auto" />
        <div className="animate-skeleton bg-gray-100 rounded h-4 w-16" />
        <div className="animate-skeleton bg-gray-100 rounded-full h-6 w-16" />
      </div>
    )
  }

  if (variant === 'list') {
    return Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
        <div className="animate-skeleton bg-gray-100 rounded-full h-8 w-8 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="animate-skeleton bg-gray-100 rounded h-3.5 w-3/4" />
          <div className="animate-skeleton bg-gray-100 rounded h-3 w-1/2" />
        </div>
      </div>
    ))
  }

  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className={`animate-skeleton bg-gray-100 rounded-lg ${className}`} />
  ))
}
