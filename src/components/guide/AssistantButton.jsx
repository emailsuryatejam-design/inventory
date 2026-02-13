import { HelpCircle, X } from 'lucide-react'
import useGuide from '../../hooks/useGuide'
import { useUser } from '../../context/AppContext'

/**
 * Floating "?" help button — always visible in the bottom-right corner.
 * When a guide is running, shows an X to exit the guide.
 * Hidden for chef role — they don't need the guide system.
 */
export default function AssistantButton() {
  const { isRunning, isPanelOpen, togglePanel, endGuide } = useGuide()
  const user = useUser()

  // Hide guide button for chef role
  if (user?.role === 'chef') return null

  if (isRunning) {
    // Show exit button during guide
    return (
      <button
        onClick={endGuide}
        className="fixed z-[9996] flex items-center justify-center w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transition-all compact-btn"
        style={{ bottom: 88, right: 20, minHeight: 'auto' }}
        title="Exit guide"
      >
        <X size={22} />
      </button>
    )
  }

  return (
    <button
      onClick={togglePanel}
      className="fixed z-[9996] flex items-center justify-center w-12 h-12 rounded-full text-white shadow-lg transition-all compact-btn"
      style={{
        bottom: 88,
        right: 20,
        minHeight: 'auto',
        backgroundColor: isPanelOpen ? '#15803d' : '#16a34a',
        animation: isPanelOpen ? 'none' : 'guide-fab-pulse 3s ease-in-out infinite',
      }}
      title="Help & Guides"
    >
      {isPanelOpen ? <X size={22} /> : <HelpCircle size={22} />}
    </button>
  )
}
