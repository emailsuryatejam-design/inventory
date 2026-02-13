import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { startSyncListener } from './services/offlineSync'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </HashRouter>
  </StrictMode>,
)

// Start offline sync listener (flushes queue when back online)
startSyncListener()

// Register service worker in production (web only, not Capacitor native)
// On Capacitor, assets are already local — SW can cause blank screen by caching stale index.html
const isCapacitor = window.Capacitor?.isNativePlatform?.() || false
if ('serviceWorker' in navigator && import.meta.env.PROD && !isCapacitor) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
} else if (isCapacitor && 'serviceWorker' in navigator) {
  // Unregister any previously registered SW on Capacitor
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister())
  }).catch(() => {})
}
