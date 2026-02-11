import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import TopBar from './TopBar'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="lg:ml-64">
        <TopBar />
        <main className="p-4 lg:p-6 pb-24 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}
