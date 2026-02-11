import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, Boxes, Wine, GlassWater } from 'lucide-react'

const tabs = [
  { path: '/app', icon: LayoutDashboard, label: 'Home', end: true },
  { path: '/app/orders', icon: ShoppingCart, label: 'Orders' },
  { path: '/app/pos', icon: Wine, label: 'POS' },
  { path: '/app/bar-menu', icon: GlassWater, label: 'Bar Menu' },
  { path: '/app/stock', icon: Boxes, label: 'Stock' },
]

export default function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map(tab => (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg min-w-[56px] transition ${
                isActive
                  ? 'text-green-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            <tab.icon size={22} />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
