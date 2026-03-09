import { useRef, useCallback, useEffect, useState } from 'react'

/**
 * Voice narration hook for guide auto-demo mode.
 * Uses Web Speech API SpeechSynthesis with a female voice.
 *
 * Returns:
 *  speak(text)   — queues text to be spoken
 *  stop()        — cancels current speech
 *  isSpeaking    — whether audio is playing
 *  voiceEnabled  — whether voice narration is on
 *  toggleVoice() — enable/disable voice
 */
const STORAGE_KEY = 'karibu_guide_voice'

export default function useVoiceGuide() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  const voiceRef = useRef(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved !== null ? saved === 'true' : true // default ON
    } catch { return true }
  })

  // Pick a female voice once voices load
  useEffect(() => {
    if (!synth) return

    function pickVoice() {
      const voices = synth.getVoices()
      if (!voices.length) return

      // Prefer: English female voices, prioritising natural/premium ones
      const preferred = [
        // Common high-quality female voices
        v => /samantha/i.test(v.name),                      // macOS
        v => /karen/i.test(v.name),                          // macOS AU
        v => /victoria/i.test(v.name),                       // macOS
        v => /zira/i.test(v.name),                           // Windows
        v => /hazel/i.test(v.name),                          // Windows UK
        v => /google.*female/i.test(v.name),                 // Chrome
        v => /google uk english female/i.test(v.name),       // Chrome UK
        v => /female/i.test(v.name) && /en/i.test(v.lang),  // any English female
        v => /en[-_]/.test(v.lang) && /woman|female|fiona|moira|tessa|kate|susan/i.test(v.name),
      ]

      for (const test of preferred) {
        const match = voices.find(test)
        if (match) { voiceRef.current = match; return }
      }

      // Fallback: any English voice
      const english = voices.find(v => /^en/i.test(v.lang))
      if (english) voiceRef.current = english
      else voiceRef.current = voices[0]
    }

    pickVoice()
    synth.addEventListener('voiceschanged', pickVoice)
    return () => synth.removeEventListener('voiceschanged', pickVoice)
  }, [synth])

  // Persist preference
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(voiceEnabled)) } catch {}
  }, [voiceEnabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (synth) synth.cancel() }
  }, [synth])

  const speak = useCallback((text) => {
    if (!synth || !voiceEnabled || !text) return

    // Cancel any ongoing speech
    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    if (voiceRef.current) utterance.voice = voiceRef.current
    utterance.rate = 0.95
    utterance.pitch = 1.1
    utterance.volume = 0.9

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    synth.speak(utterance)
  }, [synth, voiceEnabled])

  const stop = useCallback(() => {
    if (!synth) return
    synth.cancel()
    setIsSpeaking(false)
  }, [synth])

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      if (prev && synth) synth.cancel()
      return !prev
    })
  }, [synth])

  return { speak, stop, isSpeaking, voiceEnabled, toggleVoice }
}
