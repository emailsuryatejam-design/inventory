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

// Service Worker is registered automatically by vite-plugin-pwa (registerType: 'autoUpdate')
// On Capacitor, SW is not generated — assets are bundled natively
// Safety: unregister any stale SW on Capacitor
const isCapacitor = window.Capacitor?.isNativePlatform?.() || false
if (isCapacitor && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister())
  }).catch(() => {})
}
