import { Loader2 } from 'lucide-react'

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 size={32} className="animate-spin text-green-600 mb-3" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}
