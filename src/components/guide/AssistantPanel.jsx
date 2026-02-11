import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Search, X, Clock, CheckCircle2, ChevronRight, AlertCircle,
  LayoutDashboard, ShoppingCart, Truck, Boxes, Package,
  PackageCheck, FileOutput, Wine, GlassWater, Sparkles,
  Bell, BarChart3, Users, Play
} from 'lucide-react'
import useGuide from '../../hooks/useGuide'
import { allGuides, searchGuides, getGuidesByCategory } from '../../data/guides'

const ICON_MAP = {
  LayoutDashboard, ShoppingCart, Truck, Boxes, Package,
  PackageCheck, FileOutput, Wine, GlassWater, Sparkles,
  Bell, BarChart3, Users,
}

const SUGGESTIONS = [
  'How do I create an order?',
  'Where can I check stock levels?',
  'How to use the bar menu?',
  'How do I approve an order?',
  'How to create an issue voucher?',
  'Where are the stock alerts?',
  'How to make a POS sale?',
  'How to generate a report?',
]

export default function AssistantPanel() {
  const { isPanelOpen, closePanel, startGuide, completedGuides, openReport } = useGuide()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [placeholderIdx, setPlaceholderIdx] = useState(0)

  // Rotate placeholder suggestions
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(prev => (prev + 1) % SUGGESTIONS.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Search results
  const results = useMemo(() => {
    if (query.trim()) {
      return searchGuides(query)
    }
    return null
  }, [query])

  // Grouped guides (when no search)
  const grouped = useMemo(() => getGuidesByCategory(), [])

  // Current page guides shown first
  const currentCategory = useMemo(() => {
    const path = location.pathname
    if (path.includes('order')) return 'Orders'
    if (path.includes('dispatch')) return 'Dispatch & Receive'
    if (path.includes('stock') || path.includes('items')) return 'Stock & Items'
    if (path.includes('pos')) return 'POS & Bar Menu'
    if (path.includes('bar-menu')) return 'POS & Bar Menu'
    if (path.includes('issue')) return 'Issue Vouchers'
    if (path.includes('alert')) return 'Stock & Items'
    if (path.includes('report') || path.includes('user')) return 'Admin'
    if (path.includes('recipe')) return 'Recipes'
    return 'Navigation'
  }, [location])

  function handleSelect(guide) {
    setQuery('')
    startGuide(guide)
  }

  function highlightMatch(text, q) {
    if (!q.trim()) return text
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-green-100 text-green-800 rounded px-0.5">{part}</mark> : part
    )
  }

  if (!isPanelOpen) return null

  const isMobile = window.innerWidth <= 768

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-[9994]"
        onClick={closePanel}
        style={{ animation: 'guide-fade-in 0.2s ease' }}
      />

      {/* Panel */}
      <div
        className={`fixed bg-white z-[9995] flex flex-col overflow-hidden ${
          isMobile
            ? 'inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh]'
            : 'right-0 top-0 bottom-0 w-96 border-l border-gray-200'
        }`}
        style={{
          animation: isMobile ? 'guide-slide-up 0.3s ease-out' : 'guide-slide-right 0.3s ease-out',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
        }}
      >
        {/* Handle bar (mobile) */}
        {isMobile && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
        )}

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">How can we help?</h2>
            <button
              onClick={closePanel}
              className="compact-btn flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 transition"
              style={{ minHeight: 'auto' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Search with rotating placeholder */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={SUGGESTIONS[placeholderIdx]}
              className="w-full pl-9 pr-8 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 compact-btn"
                style={{ minHeight: 'auto', minWidth: 'auto' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* Search results */}
          {results !== null ? (
            results.length > 0 ? (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </p>
                {results.map(guide => (
                  <GuideCard
                    key={guide.id}
                    guide={guide}
                    completed={completedGuides.includes(guide.id)}
                    onSelect={handleSelect}
                    highlightQuery={query}
                    highlightMatch={highlightMatch}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 mb-1">No guides found</p>
                <p className="text-xs text-gray-400 mb-4">Try different keywords</p>
                <button
                  onClick={() => { setQuery(''); openReport() }}
                  className="text-xs text-green-600 hover:text-green-700 font-semibold underline compact-btn"
                  style={{ minHeight: 'auto' }}
                >
                  Can't find help? Report it
                </button>
              </div>
            )
          ) : (
            /* Categorized guide list */
            <>
              {/* Current page guides first */}
              {grouped[currentCategory] && (
                <div className="mb-4">
                  <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-2">
                    For this page
                  </p>
                  {grouped[currentCategory].map(guide => (
                    <GuideCard
                      key={guide.id}
                      guide={guide}
                      completed={completedGuides.includes(guide.id)}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              )}

              {/* All other categories */}
              {Object.entries(grouped).filter(([cat]) => cat !== currentCategory).map(([category, guides]) => (
                <div key={category} className="mb-4">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {category}
                  </p>
                  {guides.map(guide => (
                    <GuideCard
                      key={guide.id}
                      guide={guide}
                      completed={completedGuides.includes(guide.id)}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer: Report link */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={openReport}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-gray-600 hover:text-green-700 font-medium transition compact-btn"
            style={{ minHeight: 'auto' }}
          >
            <AlertCircle size={15} />
            Can't find what you need? Report it
          </button>
        </div>
      </div>
    </>
  )
}

// ── Guide Card ────────────────────────────────────
function GuideCard({ guide, completed, onSelect, highlightQuery, highlightMatch }) {
  const IconComp = ICON_MAP[guide.icon] || Package

  return (
    <button
      onClick={() => onSelect(guide)}
      className="w-full flex items-center gap-3 p-3 mb-1.5 rounded-xl hover:bg-green-50 transition text-left group compact-btn"
      style={{ minHeight: 'auto' }}
    >
      <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
        completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500 group-hover:bg-green-100 group-hover:text-green-600'
      }`}>
        {completed ? <CheckCircle2 size={18} /> : <IconComp size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {highlightMatch ? highlightMatch(guide.title, highlightQuery || '') : guide.title}
        </p>
        <p className="text-[11px] text-gray-500 truncate">
          {highlightMatch ? highlightMatch(guide.description, highlightQuery || '') : guide.description}
        </p>
      </div>
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
          <Clock size={10} />
          {guide.estimatedTime}
        </span>
        <Play size={14} className="text-gray-300 group-hover:text-green-500 transition" />
      </div>
    </button>
  )
}
