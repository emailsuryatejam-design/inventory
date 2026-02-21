import { Printer } from 'lucide-react'

/**
 * PrintButton — reusable print trigger button.
 *
 * @param {function} onClick - print handler
 * @param {string} label - button text
 * @param {string} variant - 'primary' | 'secondary' | 'icon'
 * @param {string} className - additional classes
 */
export default function PrintButton({ onClick, label = 'Print', variant = 'secondary', className = '' }) {
  const base = 'inline-flex items-center gap-2 font-semibold text-sm rounded-xl transition'

  const variants = {
    primary: `${base} bg-green-600 text-white py-3 px-5 hover:bg-green-700`,
    secondary: `${base} bg-gray-100 text-gray-700 py-3 px-5 hover:bg-gray-200`,
    icon: `${base} p-2.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg`,
  }

  return (
    <button onClick={onClick} className={`${variants[variant] || variants.secondary} ${className}`}>
      <Printer size={variant === 'icon' ? 18 : 16} />
      {variant !== 'icon' && <span>{label}</span>}
    </button>
  )
}
