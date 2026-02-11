import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

export default function SearchInput({ value = '', onChange, placeholder = 'Search...', debounce = 300 }) {
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef(null)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  function handleChange(e) {
    const val = e.target.value
    setLocalValue(val)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onChange(val)
    }, debounce)
  }

  function handleClear() {
    setLocalValue('')
    onChange('')
  }

  return (
    <div className="relative">
      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
