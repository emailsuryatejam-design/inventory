import { Link } from 'react-router-dom'
import { ShieldX, ArrowLeft } from 'lucide-react'
import { useUser } from '../context/AppContext'

export default function AccessDenied({ message }) {
  const user = useUser()
  const homePath = getHomePath(user?.role)

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <ShieldX size={32} className="text-red-400" />
      </div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        {message || "You don't have permission to view this page. Contact your administrator if you believe this is an error."}
      </p>
      <Link
        to={homePath}
        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors"
      >
        <ArrowLeft size={16} />
        Go to Home
      </Link>
    </div>
  )
}

function getHomePath(role) {
  switch (role) {
    case 'chef': return '/app/menu-plan'
    case 'housekeeping': return '/app/issue'
    case 'stores_manager':
    case 'procurement_officer': return '/app/orders'
    default: return '/app'
  }
}
