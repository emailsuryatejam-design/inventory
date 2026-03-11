import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useUser } from './context/AppContext'
import RouteGuard from './components/layout/RouteGuard'
import LoadingSpinner from './components/ui/LoadingSpinner'
import { GuideProvider } from './context/GuideContext'
import AppGuideUI from './components/guide/AppGuideUI'

// Eager — critical path (login, dashboard, layout, landing)
import Login from './pages/Login'
import PinLogin from './pages/PinLogin'
import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import AppLayout from './components/layout/AppLayout'
import HomeLauncher from './pages/HomeLauncher'

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
const BarTabs = lazy(() => import('./pages/BarTabs'))
const BarTabDetail = lazy(() => import('./pages/BarTabDetail'))
const BarShifts = lazy(() => import('./pages/BarShifts'))
const BarReports = lazy(() => import('./pages/BarReports'))
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

// Payroll & HR
const PayrollDashboard = lazy(() => import('./pages/PayrollDashboard'))
const Departments = lazy(() => import('./pages/Departments'))
const JobGrades = lazy(() => import('./pages/JobGrades'))
const HREmployees = lazy(() => import('./pages/HREmployees'))
const HREmployeeNew = lazy(() => import('./pages/HREmployeeNew'))
const HREmployeeDetail = lazy(() => import('./pages/HREmployeeDetail'))
const PayrollPeriods = lazy(() => import('./pages/PayrollPeriods'))
const PayrollRuns = lazy(() => import('./pages/PayrollRuns'))
const PayrollRunNew = lazy(() => import('./pages/PayrollRunNew'))
const PayrollRunDetail = lazy(() => import('./pages/PayrollRunDetail'))
const LeaveManagement = lazy(() => import('./pages/LeaveManagement'))
const AttendanceGrid = lazy(() => import('./pages/AttendanceGrid'))
const HRLoans = lazy(() => import('./pages/HRLoans'))
const SalaryAdvances = lazy(() => import('./pages/SalaryAdvances'))
const ExpenseClaims = lazy(() => import('./pages/ExpenseClaims'))
const PayrollReports = lazy(() => import('./pages/PayrollReports'))
const PayrollReportView = lazy(() => import('./pages/PayrollReportView'))
const Shifts = lazy(() => import('./pages/Shifts'))
const HRRegions = lazy(() => import('./pages/HRRegions'))
const FieldTracking = lazy(() => import('./pages/FieldTracking'))
const Contracts = lazy(() => import('./pages/Contracts'))
const ApprovalWorkflows = lazy(() => import('./pages/ApprovalWorkflows'))
const PayrollAuditLog = lazy(() => import('./pages/PayrollAuditLog'))
const IDCards = lazy(() => import('./pages/IDCards'))
const IntroLetters = lazy(() => import('./pages/IntroLetters'))
const PayslipTemplates = lazy(() => import('./pages/PayslipTemplates'))
const BankExport = lazy(() => import('./pages/BankExport'))

// Employee Self-Service
const MyDashboard = lazy(() => import('./pages/MyDashboard'))
const MyPayslips = lazy(() => import('./pages/MyPayslips'))
const MyLeave = lazy(() => import('./pages/MyLeave'))
const MyLoans = lazy(() => import('./pages/MyLoans'))
const MyAttendance = lazy(() => import('./pages/MyAttendance'))
const MyAllowances = lazy(() => import('./pages/MyAllowances'))
const MyProfile = lazy(() => import('./pages/MyProfile'))
const MyDocuments = lazy(() => import('./pages/MyDocuments'))
const MyIdCard = lazy(() => import('./pages/MyIdCard'))
const MyIntroLetter = lazy(() => import('./pages/MyIntroLetter'))
const MyFieldWork = lazy(() => import('./pages/MyFieldWork'))

// Kitchen Admin + Requisitions
const KitchenAdmin = lazy(() => import('./pages/KitchenAdmin'))
const RequisitionTypes = lazy(() => import('./pages/RequisitionTypes'))
const SetMenus = lazy(() => import('./pages/SetMenus'))
const KitchenRequisition = lazy(() => import('./pages/KitchenRequisition'))
const KitchenStoreDashboard = lazy(() => import('./pages/KitchenStoreDashboard'))
const KitchenStoreOrders = lazy(() => import('./pages/KitchenStoreOrders'))
const KitchenDayClose = lazy(() => import('./pages/KitchenDayClose'))
const KitchenReports = lazy(() => import('./pages/KitchenReports'))
const KitchenReceiveSupply = lazy(() => import('./pages/KitchenReceiveSupply'))

const CHEF_ONLY = ['chef']
const KITCHEN_ROLES = ['chef', 'camp_manager', 'admin', 'director']
const STORE_ROLES = ['storekeeper', 'camp_storekeeper', 'stores_manager', 'admin', 'director']
const ADMIN_ROLES = ['admin', 'director', 'stores_manager']
const PROCUREMENT_ROLES = ['procurement_officer', 'stores_manager', 'admin', 'director']
const GRN_ROLES = ['procurement_officer', 'stores_manager', 'camp_storekeeper', 'admin', 'director']

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

          {/* Protected routes */}
          <Route path="/app" element={<RequireAuth><Outlet /></RequireAuth>}>
            {/* Home launcher — standalone, no sidebar */}
            <Route index element={<HomeLauncher />} />

            {/* Interior routes — wrapped with AppLayout (sidebar + topbar) */}
            <Route element={<AppLayout />}>
            <Route path="dashboard" element={<RouteGuard module="stores" exclude={CHEF_ONLY}><Dashboard /></RouteGuard>} />

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
            <Route path="set-menus" element={<RouteGuard module="kitchen" access="manager"><SetMenus /></RouteGuard>} />
            <Route path="kitchen-admin" element={<RouteGuard module="kitchen" access="manager"><KitchenAdmin /></RouteGuard>} />
            <Route path="requisition-types" element={<RouteGuard module="kitchen" access="manager"><RequisitionTypes /></RouteGuard>} />
            <Route path="kitchen-requisition" element={<RouteGuard module="kitchen" roles={KITCHEN_ROLES}><KitchenRequisition /></RouteGuard>} />
            <Route path="kitchen-store" element={<RouteGuard module="kitchen" roles={STORE_ROLES}><KitchenStoreDashboard /></RouteGuard>} />
            <Route path="kitchen-store-orders" element={<RouteGuard module="kitchen" roles={STORE_ROLES}><KitchenStoreOrders /></RouteGuard>} />
            <Route path="kitchen-day-close" element={<RouteGuard module="kitchen" roles={KITCHEN_ROLES}><KitchenDayClose /></RouteGuard>} />
            <Route path="kitchen-reports" element={<RouteGuard module="kitchen" access="manager"><KitchenReports /></RouteGuard>} />
            <Route path="kitchen-receive" element={<RouteGuard module="kitchen" roles={KITCHEN_ROLES}><KitchenReceiveSupply /></RouteGuard>} />

            {/* ── Bar & POS module ── */}
            <Route path="pos" element={<RouteGuard module="bar" exclude={CHEF_ONLY}><POS /></RouteGuard>} />
            <Route path="bar-menu" element={<RouteGuard module="bar" exclude={CHEF_ONLY}><BarMenu /></RouteGuard>} />
            <Route path="bar-tabs" element={<RouteGuard module="bar" exclude={CHEF_ONLY}><BarTabs /></RouteGuard>} />
            <Route path="bar-tab/:id" element={<RouteGuard module="bar" exclude={CHEF_ONLY}><BarTabDetail /></RouteGuard>} />
            <Route path="bar-shifts" element={<RouteGuard module="bar" exclude={CHEF_ONLY}><BarShifts /></RouteGuard>} />
            <Route path="bar-reports" element={<RouteGuard module="bar" access="manager"><BarReports /></RouteGuard>} />

            {/* ── Admin module ── */}
            <Route path="reports" element={<RouteGuard module="reports" access="manager"><Reports /></RouteGuard>} />
            <Route path="users" element={<RouteGuard module="admin" roles={ADMIN_ROLES}><UserManagement /></RouteGuard>} />
            <Route path="settings" element={<RouteGuard module="admin" access="manager"><Settings /></RouteGuard>} />

            {/* ── Payroll & HR module ── */}
            <Route path="payroll" element={<RouteGuard module="payroll" access="manager"><PayrollDashboard /></RouteGuard>} />
            <Route path="departments" element={<RouteGuard module="payroll" access="manager"><Departments /></RouteGuard>} />
            <Route path="job-grades" element={<RouteGuard module="payroll" access="manager"><JobGrades /></RouteGuard>} />
            <Route path="hr-employees" element={<RouteGuard module="payroll" access="manager"><HREmployees /></RouteGuard>} />
            <Route path="hr-employees/new" element={<RouteGuard module="payroll" access="manager"><HREmployeeNew /></RouteGuard>} />
            <Route path="hr-employees/:id" element={<RouteGuard module="payroll" access="manager"><HREmployeeDetail /></RouteGuard>} />
            <Route path="payroll-periods" element={<RouteGuard module="payroll" access="manager"><PayrollPeriods /></RouteGuard>} />
            <Route path="payroll-runs" element={<RouteGuard module="payroll" access="manager"><PayrollRuns /></RouteGuard>} />
            <Route path="payroll-runs/new" element={<RouteGuard module="payroll" access="manager"><PayrollRunNew /></RouteGuard>} />
            <Route path="payroll-runs/:id" element={<RouteGuard module="payroll" access="manager"><PayrollRunDetail /></RouteGuard>} />
            <Route path="leave" element={<RouteGuard module="payroll" access="manager"><LeaveManagement /></RouteGuard>} />
            <Route path="attendance" element={<RouteGuard module="payroll" access="manager"><AttendanceGrid /></RouteGuard>} />
            <Route path="hr-loans" element={<RouteGuard module="payroll" access="manager"><HRLoans /></RouteGuard>} />
            <Route path="salary-advances" element={<RouteGuard module="payroll" access="manager"><SalaryAdvances /></RouteGuard>} />
            <Route path="expense-claims" element={<RouteGuard module="payroll" access="manager"><ExpenseClaims /></RouteGuard>} />
            <Route path="payroll-reports" element={<RouteGuard module="payroll" access="manager"><PayrollReports /></RouteGuard>} />
            <Route path="payroll-reports/:type" element={<RouteGuard module="payroll" access="manager"><PayrollReportView /></RouteGuard>} />
            <Route path="shifts" element={<RouteGuard module="payroll" access="manager"><Shifts /></RouteGuard>} />
            <Route path="hr-regions" element={<RouteGuard module="payroll" access="manager"><HRRegions /></RouteGuard>} />
            <Route path="field-tracking" element={<RouteGuard module="payroll" access="manager"><FieldTracking /></RouteGuard>} />
            <Route path="contracts" element={<RouteGuard module="payroll" access="manager"><Contracts /></RouteGuard>} />
            <Route path="approvals" element={<RouteGuard module="payroll" access="manager"><ApprovalWorkflows /></RouteGuard>} />
            <Route path="payroll-audit" element={<RouteGuard module="payroll" access="manager"><PayrollAuditLog /></RouteGuard>} />
            <Route path="id-cards" element={<RouteGuard module="payroll" access="manager"><IDCards /></RouteGuard>} />
            <Route path="intro-letters" element={<RouteGuard module="payroll" access="manager"><IntroLetters /></RouteGuard>} />
            <Route path="payslip-templates" element={<RouteGuard module="payroll" access="manager"><PayslipTemplates /></RouteGuard>} />
            <Route path="bank-export" element={<RouteGuard module="payroll" access="manager"><BankExport /></RouteGuard>} />

            {/* ── Employee Self-Service ── */}
            <Route path="my-dashboard" element={<RouteGuard module="payroll"><MyDashboard /></RouteGuard>} />
            <Route path="my-payslips" element={<RouteGuard module="payroll"><MyPayslips /></RouteGuard>} />
            <Route path="my-leave" element={<RouteGuard module="payroll"><MyLeave /></RouteGuard>} />
            <Route path="my-loans" element={<RouteGuard module="payroll"><MyLoans /></RouteGuard>} />
            <Route path="my-attendance" element={<RouteGuard module="payroll"><MyAttendance /></RouteGuard>} />
            <Route path="my-allowances" element={<RouteGuard module="payroll"><MyAllowances /></RouteGuard>} />
            <Route path="my-profile" element={<RouteGuard module="payroll"><MyProfile /></RouteGuard>} />
            <Route path="my-documents" element={<RouteGuard module="payroll"><MyDocuments /></RouteGuard>} />
            <Route path="my-id-card" element={<RouteGuard module="payroll"><MyIdCard /></RouteGuard>} />
            <Route path="my-intro-letter" element={<RouteGuard module="payroll"><MyIntroLetter /></RouteGuard>} />
            <Route path="my-field-work" element={<RouteGuard module="payroll"><MyFieldWork /></RouteGuard>} />
            </Route>
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Guide UI — only on authenticated app pages, never on login/public pages */}
      <AppGuideUI />
    </GuideProvider>
  )
}
