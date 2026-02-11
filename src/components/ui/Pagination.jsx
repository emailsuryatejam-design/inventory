import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, totalPages, total, perPage, onChange }) {
  if (totalPages <= 1) return null

  const start = (page - 1) * perPage + 1
  const end = Math.min(page * perPage, total)

  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
      <p className="text-sm text-gray-500">
        {start}–{end} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm text-gray-600 px-2">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
