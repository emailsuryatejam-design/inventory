import { Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import TopBar from './TopBar'
import TrialBanner from './TrialBanner'
import OfflineBanner from '../ui/OfflineBanner'
import ErrorBoundary from '../ui/ErrorBoundary'
import { ToastProvider } from '../ui/Toast'

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem('ws_sidebar_collapsed') === 'true'
  )

  // Listen for sidebar toggle events
  useEffect(() => {
    function handleToggle(e) {
      setSidebarCollapsed(e.detail.collapsed)
    }
    window.addEventListener('sidebar-toggle', handleToggle)
    return () => window.removeEventListener('sidebar-toggle', handleToggle)
  }, [])

  return (
    <ToastProvider>
      <div className="min-h-screen" style={{ backgroundColor: 'var(--surface-bg)' }}>
        {/* Desktop sidebar */}
        <Sidebar />

        {/* Main content area — offset by sidebar width on desktop */}
        <div
          className="lg:transition-all lg:duration-200 lg:ease-out"
          style={{ '--sidebar-w': sidebarCollapsed ? '68px' : '260px' }}
        >
          <style>{`
            @media (min-width: 1024px) {
              .main-content { margin-left: var(--sidebar-w); }
            }
          `}</style>
          <div className="main-content">
            <TopBar />
            <TrialBanner />
            <OfflineBanner />
            <main className="p-4 lg:p-6 pb-24 lg:pb-6 max-w-[1400px]">
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </main>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <MobileNav />
      </div>
    </ToastProvider>
  )
}
