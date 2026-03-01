import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useUser } from './context/AppContext'
import RouteGuard from './components/layout/RouteGuard'
import LoadingSpinner from './components/ui/LoadingSpinner'
import { GuideProvider } from './context/GuideContext'
import AssistantButton from './components/guide/AssistantButton'
import AssistantPanel from './components/guide/AssistantPanel'
import GuideOverlay from './components/guide/GuideOverlay'
import ReportForm from './components/guide/ReportForm'

// Eager — critical path (login, dashboard, layout, landing)
import Login from './pages/Login'
import PinLogin from './pages/PinLogin'
import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import AppLayout from './components/layout/AppLayout'

// Lazy — loaded on demand
const Register = lazy(() => import('./pages/Register'))
const Pricing = lazy(() => import('./pages/Pricing'))
const GlobalAdmin = lazy(() => import('./pages/GlobalAdmin'))
const Items = lazy(() => import('./pages/Items'))
const ItemDetail = lazy(() => import('./pages/ItemDetail'))
const ItemNew = lazy(() => import('./pages/ItemNew'))
const Stock = lazy(() => import('./pages/Stock'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderNew = lazy(() => import('./pages/OrderNew'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const Dispatch = lazy(() => import('./pages/Dispatch'))
const DispatchDetail = lazy(() => import('./pages/DispatchDetail'))
const Receive = lazy(() => import('./pages/Receive'))
const ReceiveDetail = lazy(() => import('./pages/ReceiveDetail'))
const Issue = lazy(() => import('./pages/Issue'))
const IssueNew = lazy(() => import('./pages/IssueNew'))
const Alerts = lazy(() => import('./pages/Alerts'))
const Reports = lazy(() => import('./pages/Reports'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const Settings = lazy(() => import('./pages/Settings'))
const POS = lazy(() => import('./pages/POS'))
const BarMenu = lazy(() => import('./pages/BarMenu'))
const Recipes = lazy(() => import('./pages/Recipes'))
const DailyOverview = lazy(() => import('./pages/DailyOverview'))
const MenuPlan = lazy(() => import('./pages/MenuPlan'))
const DailyGroceries = lazy(() => import('./pages/DailyGroceries'))
const WeeklyGroceries = lazy(() => import('./pages/WeeklyGroceries'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const SupplierNew = lazy(() => import('./pages/SupplierNew'))
const SupplierDetail = lazy(() => import('./pages/SupplierDetail'))
const StockAdjustments = lazy(() => import('./pages/StockAdjustments'))
const StockAdjustmentNew = lazy(() => import('./pages/StockAdjustmentNew'))
const StockAdjustmentDetail = lazy(() => import('./pages/StockAdjustmentDetail'))
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'))
const PurchaseOrderNew = lazy(() => import('./pages/PurchaseOrderNew'))
const PurchaseOrderDetail = lazy(() => import('./pages/PurchaseOrderDetail'))
const GRNList = lazy(() => import('./pages/GRN'))
const GRNNew = lazy(() => import('./pages/GRNNew'))
const GRNDetail = lazy(() => import('./pages/GRNDetail'))

const CHEF_ONLY = ['chef']
const KITCHEN_ROLES = ['chef', 'camp_manager', 'admin', 'director']
const ADMIN_ROLES = ['admin', 'director', 'stores_manager']
const PROCUREMENT_ROLES = ['procurement_officer', 'stores_manager', 'admin', 'director']
const GRN_ROLES = ['procurement_officer', 'stores_manager', 'camp_storekeeper', 'admin', 'director']

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

function LazyFallback() {
  return <LoadingSpinner message="Loading..." />
}

export default function App() {
  return (
    <GuideProvider>
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<RedirectIfAuth><Register /></RedirectIfAuth>} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/global-admin" element={<GlobalAdmin />} />
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

            {/* ── Procurement module ── */}
            <Route path="purchase-orders" element={<RouteGuard module="stores" roles={PROCUREMENT_ROLES}><PurchaseOrders /></RouteGuard>} />
            <Route path="purchase-orders/new" element={<RouteGuard module="stores" roles={PROCUREMENT_ROLES}><PurchaseOrderNew /></RouteGuard>} />
            <Route path="purchase-orders/:id" element={<RouteGuard module="stores" roles={PROCUREMENT_ROLES}><PurchaseOrderDetail /></RouteGuard>} />
            <Route path="grn" element={<RouteGuard module="stores" roles={GRN_ROLES}><GRNList /></RouteGuard>} />
            <Route path="grn/new" element={<RouteGuard module="stores" roles={GRN_ROLES}><GRNNew /></RouteGuard>} />
            <Route path="grn/:id" element={<RouteGuard module="stores" roles={GRN_ROLES}><GRNDetail /></RouteGuard>} />

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Global guide UI — available on all pages including login */}
      <AssistantButton />
      <AssistantPanel />
      <GuideOverlay />
      <ReportForm />
    </GuideProvider>
  )
}
