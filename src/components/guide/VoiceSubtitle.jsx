import { useState, useEffect, useRef } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

/**
 * Subtitle overlay for auto-demo narration.
 * Always shows text in auto mode (like movie subtitles).
 * Indicates whether voice is playing or muted.
 */
export default function VoiceSubtitle({ text, isSpeaking, voiceEnabled }) {
  const [visible, setVisible] = useState(false)
  const [displayText, setDisplayText] = useState('')
  const prevTextRef = useRef('')
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (text && text !== prevTextRef.current) {
      // New text arrived — show subtitle
      prevTextRef.current = text
      setDisplayText(text)
      setVisible(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      // Auto-hide after a readable duration (if voice is off or finishes)
      // ~150ms per word = reasonable reading speed
      const words = text.split(/\s+/).length
      const readingTime = Math.max(4000, words * 150)
      timeoutRef.current = setTimeout(() => {
        if (!isSpeaking) setVisible(false)
      }, readingTime)
    } else if (!text) {
      // Text cleared (guide ended)
      setVisible(false)
      prevTextRef.current = ''
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [text])

  // Keep visible while voice is speaking
  useEffect(() => {
    if (isSpeaking && displayText) {
      setVisible(true)
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    } else if (!isSpeaking && visible && displayText) {
      // Linger 2s after speech ends
      timeoutRef.current = setTimeout(() => setVisible(false), 2000)
    }
  }, [isSpeaking])

  if (!visible || !displayText) return null

  const isActive = isSpeaking || !voiceEnabled // show as "active" when voice muted too (subtitle-only mode)

  return (
    <div
      className="fixed z-[10003] left-1/2 -translate-x-1/2 pointer-events-none"
      style={{
        bottom: 36,
        maxWidth: 'min(640px, calc(100vw - 32px))',
        animation: 'guide-fade-in 0.3s ease forwards',
      }}
    >
      <div className="flex items-start gap-2.5 px-5 py-3.5 rounded-2xl bg-gray-900/90 backdrop-blur-md shadow-2xl border border-white/10">
        {/* Voice status icon */}
        <div className="flex-shrink-0 mt-0.5">
          {voiceEnabled ? (
            <Volume2
              size={16}
              className="text-green-400"
              style={isSpeaking ? { animation: 'guide-coaching-dot 1s ease-in-out infinite' } : { opacity: 0.5 }}
            />
          ) : (
            <VolumeX size={16} className="text-gray-500" />
          )}
        </div>
        {/* Subtitle text */}
        <p className="text-[13px] text-white/95 leading-relaxed font-medium tracking-wide">
          {displayText}
        </p>
      </div>
    </div>
  )
}
