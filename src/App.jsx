import { Routes, Route, Navigate } from 'react-router-dom'
import { useUser } from './context/AppContext'
import Login from './pages/Login'
import PinLogin from './pages/PinLogin'
import Dashboard from './pages/Dashboard'
import Items from './pages/Items'
import ItemDetail from './pages/ItemDetail'
import Stock from './pages/Stock'
import Orders from './pages/Orders'
import OrderNew from './pages/OrderNew'
import OrderDetail from './pages/OrderDetail'
import Receive from './pages/Receive'
import ReceiveDetail from './pages/ReceiveDetail'
import Issue from './pages/Issue'
import IssueNew from './pages/IssueNew'
import Settings from './pages/Settings'
import AppLayout from './components/layout/AppLayout'

function RequireAuth({ children }) {
  const user = useUser()
  if (!user) return <Navigate to="/login" replace />
  return children
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

      {/* Protected routes — with layout */}
      <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="items" element={<Items />} />
        <Route path="items/:id" element={<ItemDetail />} />
        <Route path="stock" element={<Stock />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/new" element={<OrderNew />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="receive" element={<Receive />} />
        <Route path="receive/:id" element={<ReceiveDetail />} />
        <Route path="issue" element={<Issue />} />
        <Route path="issue/new" element={<IssueNew />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
