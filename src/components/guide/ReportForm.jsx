import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, Bug, Lightbulb, HelpCircle, CheckCircle } from 'lucide-react'
import useGuide from '../../hooks/useGuide'
import { lockScroll, unlockScroll } from '../../utils/scrollLock'

const REPORT_TYPES = [
  { key: 'bug', label: 'Bug Report', icon: Bug, color: 'text-red-500 bg-red-50' },
  { key: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'text-amber-500 bg-amber-50' },
  { key: 'help', label: 'Help Not Found', icon: HelpCircle, color: 'text-blue-500 bg-blue-50' },
]

export default function ReportForm() {
  const { isReportFormOpen, closeReport, addReport } = useGuide()
  const [type, setType] = useState('help')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const timerRef = useRef(null)

  // Scroll lock when form is open
  useEffect(() => {
    if (isReportFormOpen) {
      lockScroll()
      return () => unlockScroll()
    }
  }, [isReportFormOpen])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || submitted) return

    addReport({ type, title: title.trim(), description: description.trim() })
    setSubmitted(true)
    timerRef.current = setTimeout(() => {
      setSubmitted(false)
      setType('help')
      setTitle('')
      setDescription('')
      closeReport()
    }, 1800)
  }

  function handleClose() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSubmitted(false)
    setType('help')
    setTitle('')
    setDescription('')
    closeReport()
  }

  if (!isReportFormOpen) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[10010]"
        onClick={handleClose}
        style={{ animation: 'guide-fade-in 0.2s ease forwards' }}
      />

      {/* Modal */}
      <div
        className="fixed z-[10011] bg-white rounded-2xl shadow-2xl w-[90vw] max-w-md max-h-[85dvh] overflow-y-auto scroll-touch"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'guide-tooltip-enter 0.3s ease-out forwards',
        }}
      >
        {submitted ? (
          /* Success state */
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <CheckCircle size={48} className="text-green-500 mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">Thank you!</h3>
            <p className="text-sm text-gray-500 text-center">
              Your report has been saved. We'll look into it.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-lg font-bold text-gray-900">Report an Issue</h3>
              <button
                type="button"
                onClick={handleClose}
                className="compact-btn flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 transition"
                style={{ minHeight: 'auto' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {/* Type selector */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                  Type
                </label>
                <div className="flex gap-2">
                  {REPORT_TYPES.map(rt => {
                    const Icon = rt.icon
                    return (
                      <button
                        key={rt.key}
                        type="button"
                        onClick={() => setType(rt.key)}
                        className={`flex-1 flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition border compact-btn ${
                          type === rt.key
                            ? `${rt.color} border-current`
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`}
                        style={{ minHeight: 'auto' }}
                      >
                        <Icon size={14} />
                        {rt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Brief summary of the issue..."
                  required
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe what you were trying to do and what went wrong..."
                  rows={4}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!title.trim() || submitted}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg text-sm font-semibold transition"
              >
                <Send size={16} />
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </>,
    document.body
  )
}
