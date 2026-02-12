# KCL Stores — Karibu Camps SAP Simplification Platform

## Project Overview

KCL Stores is a full-stack inventory management platform built for **Karibu Camps**, a safari lodge operator in Tanzania with 5 camps + head office. It replaces complex SAP workflows with a simplified, mobile-first web/Android app designed for staff with low technical literacy.

**App ID:** `com.karibucamps.stores`
**Production API:** `https://darkblue-goshawk-672880.hostingersite.com`
**Project Path:** `/Users/suryateja/Projects/karibu/sap-platform/v5`

---

## Tech Stack

### Frontend
- **Framework:** React 19.2 with Vite 7.3
- **Routing:** react-router-dom 7.13 (HashRouter for Capacitor compatibility)
- **Styling:** Tailwind CSS 4.1 (via @tailwindcss/vite plugin)
- **Icons:** lucide-react 0.563
- **Mobile:** Capacitor 8 (Android builds)
- **State:** React Context + useReducer (no Redux)
- **Build:** `vite build` → `dist/`

### Backend
- **Language:** PHP (plain, no framework)
- **Database:** MySQL (hosted on Hostinger)
- **Auth:** JWT (Bearer token in Authorization header)
- **AI:** Google Gemini 2.0 Flash (recipe suggestions)
- **Hosting:** Hostinger (PHP + MySQL)

### Development
- **Dev server:** `vite` on port 5173
- **API proxy:** `/api` → `localhost:8000` (PHP built-in server)
- **Android build:** `npm run apk` (vite build → cap sync → gradle assembleDebug)
- **Lint:** ESLint 9

---

## Project Structure

```
v5/
├── api/                          # PHP backend (each file = one endpoint)
│   ├── config.php                # DB connection, helpers (getDB, jsonResponse, jsonError)
│   ├── middleware.php             # Auth middleware (requireAuth, getJsonInput)
│   ├── helpers.php               # Shared utilities
│   ├── setup.php                 # DB schema setup/migration
│   ├── auth-login.php            # POST - Username/password login
│   ├── auth-pin-login.php        # POST - PIN-based login
│   ├── auth-me.php               # GET - Current user info
│   ├── dashboard.php             # GET - Dashboard stats
│   ├── items.php                 # GET - Items catalog list
│   ├── items-detail.php          # GET - Single item detail
│   ├── stock.php                 # GET - Stock levels
│   ├── stock-camp.php            # GET - Camp-specific stock
│   ├── orders.php                # GET/POST - Order list & create
│   ├── orders-detail.php         # GET/PUT - Order detail & update
│   ├── orders-approve.php        # PUT - Approve order lines
│   ├── orders-reject.php         # PUT - Reject order
│   ├── orders-query.php          # POST - Send query message
│   ├── dispatch.php              # GET/POST - Dispatch list & create
│   ├── dispatch-detail.php       # GET/PUT - Dispatch detail
│   ├── receive.php               # GET/POST - Receipt list & create
│   ├── receive-detail.php        # GET/PUT - Receipt confirmation
│   ├── issue.php                 # GET/POST - Issue vouchers
│   ├── issue-detail.php          # GET - Issue detail
│   ├── pos.php                   # GET/POST - POS transactions
│   ├── menu.php                  # GET/POST - Bar menu & orders
│   ├── alerts.php                # GET - Stock alerts (low/dead/excess/projections)
│   ├── reports.php               # GET - Business reports
│   ├── recipes.php               # GET/POST - Gemini AI recipe suggestions
│   ├── daily-overview.php        # GET - Daily activity overview
│   ├── users.php                 # GET/POST/PUT - User management
│   ├── health.php                # GET - Health check
│   └── debug-schema.php          # GET - Schema debug tool
├── src/
│   ├── main.jsx                  # Entry point (StrictMode + HashRouter + AppProvider)
│   ├── App.jsx                   # Route definitions
│   ├── index.css                 # Global CSS (Tailwind + KCL color vars + guide animations)
│   ├── context/
│   │   ├── AppContext.jsx         # Global state (user, camps, selectedCampId, notifications)
│   │   └── GuideContext.jsx       # Guide/walkthrough state (active guide, steps, cursor)
│   ├── services/
│   │   └── api.js                # API client (all HTTP requests, token handling, 401 redirect)
│   ├── hooks/
│   │   └── useGuide.js           # Guide system hook (actions + computed state)
│   ├── data/
│   │   └── guides/               # Interactive walkthrough definitions
│   │       ├── index.js           # Guide registry + search
│   │       ├── navigationGuides.js
│   │       ├── operationsGuides.js
│   │       ├── ordersGuides.js
│   │       ├── posGuides.js
│   │       └── stockGuides.js
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.jsx      # Root layout (sidebar + topbar + nav + guide system)
│   │   │   ├── Sidebar.jsx        # Desktop nav (role-based menu filtering)
│   │   │   ├── TopBar.jsx         # Header (camp selector, notifications)
│   │   │   └── MobileNav.jsx      # Bottom nav bar (5 tabs)
│   │   ├── guide/
│   │   │   ├── AssistantButton.jsx # Floating help FAB
│   │   │   ├── AssistantPanel.jsx  # Help panel (search + categorized guides)
│   │   │   ├── GuideOverlay.jsx    # Step orchestrator (navigate, find target, animate)
│   │   │   ├── GuideTooltip.jsx    # Positioned instruction tooltip
│   │   │   ├── GuideProgress.jsx   # Step dots
│   │   │   ├── SpotlightMask.jsx   # Dark overlay with cutout
│   │   │   ├── AnimatedCursor.jsx  # Desktop arrow / mobile tap ring
│   │   │   └── ReportForm.jsx      # Bug/feature report modal
│   │   └── ui/
│   │       ├── Badge.jsx           # 68 status variants (stock, order, ABC, storage, etc.)
│   │       ├── Card.jsx            # White rounded container
│   │       ├── EmptyState.jsx      # No-data placeholder
│   │       ├── LoadingSpinner.jsx  # Green spinner
│   │       ├── Pagination.jsx      # Page nav controls
│   │       └── SearchInput.jsx     # Debounced search field (300ms)
│   └── pages/
│       ├── Login.jsx               # Manager login (username/password)
│       ├── PinLogin.jsx            # Camp staff login (staff picker + PIN pad)
│       ├── Dashboard.jsx           # Executive overview + stats + alerts
│       ├── DailyOverview.jsx       # Daily activity (5-column: stock/ordered/received/bar/kitchen)
│       ├── Items.jsx               # Item catalog browsing + filtering
│       ├── ItemDetail.jsx          # Full item view (units, pricing, storage, suppliers)
│       ├── Stock.jsx               # Stock levels with status cards + filtering
│       ├── Orders.jsx              # Order list with status tabs
│       ├── OrderNew.jsx            # Create order (search items + stepper qty)
│       ├── OrderDetail.jsx         # Order review/approve/reject workflow
│       ├── Dispatch.jsx            # Dispatch tracking list
│       ├── DispatchDetail.jsx      # Dispatch detail with line items
│       ├── Receive.jsx             # Receipt tracking list
│       ├── ReceiveDetail.jsx       # Receipt confirmation (qty steppers + condition)
│       ├── Issue.jsx               # Issue voucher list (type tabs)
│       ├── IssueNew.jsx            # Create issue (dynamic fields by type)
│       ├── POS.jsx                 # Point of sale (service→categories→items→cart→receipt)
│       ├── BarMenu.jsx             # Bar menu ordering + stock status alerts
│       ├── Recipes.jsx             # AI recipe generator (Gemini)
│       ├── Alerts.jsx              # Stock alerts (low/dead/excess/projections)
│       ├── Reports.jsx             # Business reports generator
│       ├── UserManagement.jsx      # User CRUD (admin only)
│       └── Settings.jsx            # Profile + camp switcher + logout
├── android/                        # Capacitor Android project
├── capacitor.config.json           # Capacitor config (appId, webDir)
├── package.json                    # Dependencies & scripts
├── vite.config.js                  # Vite config (react, tailwind, proxy)
└── index.html                      # Entry HTML
```

---

## Routes

| Route | Page | Access |
|-------|------|--------|
| `/login` | Login.jsx | Public |
| `/pin-login` | PinLogin.jsx | Public |
| `/app` | Dashboard.jsx | Auth required |
| `/app/daily` | DailyOverview.jsx | Auth required |
| `/app/items` | Items.jsx | Auth required |
| `/app/items/:id` | ItemDetail.jsx | Auth required |
| `/app/stock` | Stock.jsx | Auth required |
| `/app/orders` | Orders.jsx | Auth required |
| `/app/orders/new` | OrderNew.jsx | Auth required |
| `/app/orders/:id` | OrderDetail.jsx | Auth required |
| `/app/dispatch` | Dispatch.jsx | Auth required |
| `/app/dispatch/:id` | DispatchDetail.jsx | Auth required |
| `/app/receive` | Receive.jsx | Auth required |
| `/app/receive/:id` | ReceiveDetail.jsx | Auth required |
| `/app/issue` | Issue.jsx | Auth required |
| `/app/issue/new` | IssueNew.jsx | Auth required |
| `/app/pos` | POS.jsx | Auth required |
| `/app/bar-menu` | BarMenu.jsx | Auth required |
| `/app/recipes` | Recipes.jsx | Auth required |
| `/app/alerts` | Alerts.jsx | Auth required |
| `/app/reports` | Reports.jsx | Manager+ |
| `/app/users` | UserManagement.jsx | Admin |
| `/app/settings` | Settings.jsx | Auth required |

---

## User Roles & Access

| Role | Scope | Key Permissions |
|------|-------|-----------------|
| `camp_storekeeper` | Own camp only | Create orders, confirm receipts, create issues, use POS |
| `camp_manager` | Own camp only | View orders/reports, manage recipes |
| `chef` | Own camp only | View kitchen stock, log consumption |
| `housekeeping` | Own camp only | Log amenity issues |
| `stores_manager` | All camps | Review/approve/reject orders, manage dispatches |
| `procurement_officer` | All camps | Process procurement, manage dispatches |
| `accountant` | All camps | View reports |
| `director` | All camps | Full read access, override approvals |
| `admin` | All camps | Full access, user management |

**Role helpers:**
- `isManager(role)` → stores_manager, procurement_officer, director, admin
- `isCampStaff(role)` → camp_storekeeper, chef, housekeeping, camp_manager

---

## State Management

### AppContext (global)
```js
{
  user: { id, name, username, role, camp_id, camp_code, camp_name, token },
  selectedCampId: number | null,   // Managers can switch camp views
  camps: [],                       // All camps list
  notifications: [],
  isLoading: false
}
```
- Persisted to `localStorage` key `kcl_stores`
- Token stored separately as `kcl_token`
- Actions: LOGIN, LOGOUT, SET_CAMPS, SELECT_CAMP, SET_LOADING, ADD_NOTIFICATION, RESTORE_STATE

### GuideContext (walkthrough system)
- Tracks active guide, step index, cursor position, spotlight target
- Persisted: completedGuides[], reports[]
- Storage key: `karibu_guide_data`

---

## API Client Pattern

All API calls go through `src/services/api.js`:
- Base URL: `/api` (dev, proxied) or production URL
- Auth: Bearer token from localStorage
- Auto-redirect on 401 (token expired)
- Graceful error handling (network errors, non-JSON responses)

**API modules:** auth, dashboard, items, stock, orders, dispatch, receive, issue, pos, recipes, menu, dailyOverview, alerts, reports, users, health

---

## Database Tables (MySQL)

**Core:** camps, users, items, categories, sub_categories, suppliers, item_suppliers
**Stock:** camp_stock (per-camp), ho_stock (head office), stock_balances, stock_movements
**Orders flow:** orders → order_lines → order_queries
**Procurement:** procurement_reports → procurement_lines
**Logistics:** dispatches → dispatch_lines → receipts → receipt_lines
**POS:** pos_transactions → pos_transaction_items, issue_vouchers → issue_lines
**Bar:** menu_items, menu_categories (linked to items for stock tracking)
**System:** notifications, audit_log, app_settings, units_of_measure, cost_centers, item_groups

**Key auto-numbers:** ORD-YYYY-NNNN, DSP-YYYY-NNNN, REC-YYYY-NNNN, PR-YYYY-NNNN

---

## Key Design Patterns

### UI/UX Principles
1. **No text input where possible** — Use pickers, dropdowns, steppers, PIN pads instead of typing
2. **Mobile-first responsive** — Dual rendering: desktop tables + mobile cards
3. **48px touch targets** — Minimum touch size enforced via CSS (override with `.compact-btn`)
4. **Status color system** — Consistent across app:
   - Red: critical/out of stock/rejected
   - Amber: low stock/warning/queried
   - Green: ok/approved/active
   - Blue: excess/info
   - Gray: unknown/inactive/default

### Component Patterns
- **Multi-view pages** — `useState('view')` switches between modes (e.g., service→categories→items→cart→receipt)
- **Tab-based filtering** — Status/category tabs with auto-counted badges
- **Search debouncing** — 300ms delay on item searches (SearchInput component)
- **Stepper controls** — +/- buttons for quantity, not text input
- **Sticky action bars** — Floating submit buttons at bottom of forms
- **Role-based rendering** — Conditional UI based on `isManager()` / `isCampStaff()`
- **Data-guide attributes** — All interactive elements have `data-guide="selector-id"` for walkthrough targeting

### Backend Patterns
- One PHP file per endpoint (no routing framework)
- `requireAuth()` middleware returns decoded JWT user
- `requireMethod('GET'|'POST'|'PUT')` enforces HTTP method
- `getJsonInput()` parses request body
- `jsonResponse()` / `jsonError()` for consistent responses
- PDO prepared statements for all queries
- Stock movements tracked via `stock_movements` table (audit trail)

---

## Interactive Guide System

A fully integrated walkthrough system that provides an animated cursor, spotlight masks, and tooltips to guide users through features.

**Components:** AssistantButton (FAB) → AssistantPanel (search + list) → GuideOverlay (orchestrator) → SpotlightMask + AnimatedCursor + GuideTooltip

**Guide categories:** Navigation, Orders, Dispatch & Receive, Stock & Items, POS & Bar Menu, Issue Vouchers, Admin

**Flow:** User clicks help FAB → searches/selects guide → system navigates to route, finds target element via `data-guide` selector, scrolls into view, animates cursor, shows spotlight + tooltip → user advances via click or Next button

**Total guides:** ~20 covering all major features

---

## Color System (CSS Custom Properties)

```css
--kcl-green: #16a34a      /* Primary brand */
--kcl-green-dark: #15803d
--kcl-green-light: #dcfce7
--kcl-amber: #f59e0b      /* Warnings */
--kcl-amber-light: #fef3c7
--kcl-red: #ef4444        /* Errors/critical */
--kcl-red-light: #fee2e2
--kcl-blue: #3b82f6       /* Info/excess */
--kcl-blue-light: #dbeafe
--kcl-gray: #9ca3af       /* Neutral */
```

---

## Development Commands

```bash
# Frontend dev server (port 5173)
npm run dev

# PHP backend dev server (port 8000)
cd api && php -S localhost:8000

# Build for production
npm run build

# Build Android APK
npm run apk

# Capacitor sync
npm run cap:sync

# Open Android Studio
npm run cap:open

# Lint
npm run lint
```

---

## Business Context

Karibu Camps operates 5 safari lodges in Tanzania. Each camp has a storekeeper who orders supplies from head office. The workflow:

1. **Camp storekeeper** creates an order for needed items
2. **Stores manager** (HO) reviews, approves/adjusts/rejects per line item
3. **Procurement** generates report — dispatch from warehouse or buy from supplier
4. **Dispatch** sends goods from HO to camp with tracking
5. **Camp storekeeper** receives and confirms goods (qty + condition)
6. **Issue vouchers** track daily consumption (kitchen, bar, housekeeping, etc.)
7. **POS** records direct sales/service at camps (bar, restaurant, rooms)
8. **Alerts** monitor stock levels (low, critical, dead stock, excess)
9. **Daily overview** shows all activity for a given date
10. **Recipes** uses Gemini AI to suggest drinks based on available bar stock

Staff have low computer literacy — the UX prioritizes big touch targets, picker-based inputs (no typing), and the interactive guide system for training.

---

## Documentation

Full project documentation available at `/Users/suryateja/Guides/karibu-sap-platform-docs/`:
- 01-project-overview.md
- 02-product-requirements.md
- 03-technical-architecture.md
- 04-module-specifications.md
- 05-user-roles-permissions.md
- 06-data-flow-integration.md
- 07-implementation-roadmap.md
- 08-ui-ux-design-guidelines.md
- 09-ordering-procedure-design.md
- 10-database-schema.md
- 11-revised-architecture.md
- 12-best-practices-gap-analysis.md
