import { Routes, Route, Navigate } from 'react-router-dom'
import { useUser } from './context/AppContext'
import RouteGuard from './components/layout/RouteGuard'
import Login from './pages/Login'
import PinLogin from './pages/PinLogin'
import Dashboard from './pages/Dashboard'
import Items from './pages/Items'
import ItemDetail from './pages/ItemDetail'
import Stock from './pages/Stock'
import Orders from './pages/Orders'
import OrderNew from './pages/OrderNew'
import OrderDetail from './pages/OrderDetail'
import Dispatch from './pages/Dispatch'
import DispatchDetail from './pages/DispatchDetail'
import Receive from './pages/Receive'
import ReceiveDetail from './pages/ReceiveDetail'
import Issue from './pages/Issue'
import IssueNew from './pages/IssueNew'
import Alerts from './pages/Alerts'
import Reports from './pages/Reports'
import UserManagement from './pages/UserManagement'
import Settings from './pages/Settings'
import POS from './pages/POS'
import BarMenu from './pages/BarMenu'
import Recipes from './pages/Recipes'
import DailyOverview from './pages/DailyOverview'
import MenuPlan from './pages/MenuPlan'
import DailyGroceries from './pages/DailyGroceries'
import WeeklyGroceries from './pages/WeeklyGroceries'
import ItemNew from './pages/ItemNew'
import Suppliers from './pages/Suppliers'
import SupplierNew from './pages/SupplierNew'
import SupplierDetail from './pages/SupplierDetail'
import StockAdjustments from './pages/StockAdjustments'
import StockAdjustmentNew from './pages/StockAdjustmentNew'
import StockAdjustmentDetail from './pages/StockAdjustmentDetail'
import AppLayout from './components/layout/AppLayout'

const CHEF_ONLY = ['chef']
const KITCHEN_ROLES = ['chef', 'camp_manager', 'admin', 'director']
const ADMIN_ROLES = ['admin', 'director', 'stores_manager']

function RequireAuth({ children }) {
  const user = useUser()
  if (!user) return <Navigate to="/login" replace />
  return children
}

/** Role-based smart home — each role lands on their primary workflow */
function SmartHome() {
  const user = useUser()
  switch (user?.role) {
    case 'chef':                return <Navigate to="/app/menu-plan" replace />
    case 'housekeeping':        return <Navigate to="/app/issue" replace />
    case 'stores_manager':
    case 'procurement_officer': return <Navigate to="/app/orders" replace />
    default:                    return <Dashboard />
  }
}

function RedirectIfAuth({ children }) {
  const user = useUser()
  if (user) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<RedirectIfAuth><Login /></RedirectIfAuth>} />
      <Route path="/pin-login" element={<RedirectIfAuth><PinLogin /></RedirectIfAuth>} />

      {/* Protected routes — with layout + route guards */}
      <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<SmartHome />} />

        {/* ── Stores module ── */}
        <Route path="items" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><Items /></RouteGuard>} />
        <Route path="items/new" element={<RouteGuard module="stores" access="manager"><ItemNew /></RouteGuard>} />
        <Route path="items/:id" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><ItemDetail /></RouteGuard>} />
        <Route path="stock" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><Stock /></RouteGuard>} />
        <Route path="orders" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><Orders /></RouteGuard>} />
        <Route path="orders/new" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><OrderNew /></RouteGuard>} />
        <Route path="orders/:id" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><OrderDetail /></RouteGuard>} />
        <Route path="dispatch" element={<RouteGuard module="stores" access="manager"><Dispatch /></RouteGuard>} />
        <Route path="dispatch/:id" element={<RouteGuard module="stores" access="manager"><DispatchDetail /></RouteGuard>} />
        <Route path="receive" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><Receive /></RouteGuard>} />
        <Route path="receive/:id" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><ReceiveDetail /></RouteGuard>} />
        <Route path="issue" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><Issue /></RouteGuard>} />
        <Route path="issue/new" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><IssueNew /></RouteGuard>} />
        <Route path="suppliers" element={<RouteGuard module="stores" access="manager"><Suppliers /></RouteGuard>} />
        <Route path="suppliers/new" element={<RouteGuard module="stores" access="manager"><SupplierNew /></RouteGuard>} />
        <Route path="suppliers/:id" element={<RouteGuard module="stores" access="manager"><SupplierDetail /></RouteGuard>} />
        <Route path="stock-adjustments" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><StockAdjustments /></RouteGuard>} />
        <Route path="stock-adjustments/new" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><StockAdjustmentNew /></RouteGuard>} />
        <Route path="stock-adjustments/:id" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><StockAdjustmentDetail /></RouteGuard>} />
        <Route path="daily" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><DailyOverview /></RouteGuard>} />
        <Route path="alerts" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><Alerts /></RouteGuard>} />

        {/* ── Kitchen module ── */}
        <Route path="menu-plan" element={<RouteGuard module="kitchen" roles={KITCHEN_ROLES}><MenuPlan /></RouteGuard>} />
        <Route path="daily-groceries" element={<RouteGuard module="kitchen" roles={KITCHEN_ROLES}><DailyGroceries /></RouteGuard>} />
        <Route path="weekly-groceries" element={<RouteGuard module="kitchen" roles={KITCHEN_ROLES}><WeeklyGroceries /></RouteGuard>} />
        <Route path="recipes" element={<RouteGuard module="kitchen"><Recipes /></RouteGuard>} />

        {/* ── Bar & POS module ── */}
        <Route path="pos" element={<RouteGuard module="bar" exclude={CHEF_ONLY}><POS /></RouteGuard>} />
        <Route path="bar-menu" element={<RouteGuard module="bar" exclude={CHEF_ONLY}><BarMenu /></RouteGuard>} />

        {/* ── Admin module ── */}
        <Route path="reports" element={<RouteGuard module="reports" access="manager"><Reports /></RouteGuard>} />
        <Route path="users" element={<RouteGuard module="admin" roles={ADMIN_ROLES}><UserManagement /></RouteGuard>} />
        <Route path="settings" element={<RouteGuard module="admin" access="manager"><Settings /></RouteGuard>} />
      </Route>

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
