import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title = 'No data', message = '', action }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
        <Icon size={28} className="text-gray-400" />
      </div>
      <h3 className="text-gray-900 font-medium mb-1">{title}</h3>
      {message && <p className="text-sm text-gray-500 mb-4">{message}</p>}
      {action}
    </div>
  )
}
