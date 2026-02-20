# KCL Stores — Karibu Camps Operations Platform
## Master Development Plan

---

## The Operational Flow (How The System Should Work)

```
                         ┌──────────────┐
                         │  HEAD OFFICE  │
                         │  Reordering   │
                         │  Procurement  │
                         │  Projections  │
                         └──────┬───────┘
                                │ supplies based on
                                │ reordering reports
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                        STORES                                │
│  Central stock for all departments                           │
│  Reorder sheet auto-updates as goods are issued              │
│  Stores can also add items to reorder sheet manually         │
│  Bed-night data drives projections                           │
└─────┬──────────┬──────────┬──────────┬──────────┬───────────┘
      │          │          │          │          │
      ▼          ▼          ▼          ▼          ▼
  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
  │KITCHEN │ │HOUSE-  │ │ FUEL   │ │ MISC   │ │UTENSIL │
  │Daily & │ │KEEPING │ │Monitor │ │Sudden  │ │& LINEN │
  │Weekly  │ │Per-room│ │Diesel  │ │needs   │ │Replace- │
  │Orders  │ │Invent. │ │Petrol  │ │        │ │ment    │
  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

---

## Department Workflows In Detail

### 1. KITCHEN (Chef)

**Daily Groceries Flow:**
1. Chef sees the **global item list** and picks which items appear on the **daily** list vs **weekly** list (one-time setup per camp, editable anytime)
2. Each day, chef opens Daily Groceries → sees items with current stock from kitchen store
3. Chef enters the **order qty** for what they need from stores
4. This becomes a **kitchen requisition** sent to stores
5. Storekeeper fulfills it → issues goods → stock moves from stores to kitchen
6. After cooking, chef updates **balance remaining** (what's left unused)
7. This balance either:
   - **Carries forward** to next day (reduces next day's order automatically)
   - **Returns to stores** (requires both chef + storekeeper approval)

**Weekly Groceries Flow:**
1. Same concept but for bulk/staple items ordered weekly
2. Chef orders weekly → stores fulfills → chef tracks usage across the week
3. End of week: remaining stock carries forward or returns

**Key principle:** Kitchen has its own sub-inventory. Stores issues to kitchen, kitchen tracks its own consumption. The reorder sheet at stores level auto-updates when goods are issued.

### 2. HOUSEKEEPING (Per-Room Inventory)

**Setup:**
- Each room/tent has a **standard inventory template** (linens, towels, amenities, minibar)
- Template defines: item, standard qty, replacement cycle

**Workflow Options (system should support all):**
1. **Clean + Restock Together**: Housekeeper cleans room and restocks in one pass. Reports what was used/replaced.
2. **Clean First, Restock Later**: Housekeeper cleans and reports what needs restocking. Storekeeper issues later.
3. **Scheduled Restocking**: Automatic requisition based on occupancy schedule + template
4. **On-Demand**: Housekeeper requests specific items for specific rooms

**Each workflow produces:**
- An issue voucher from stores
- Stock movement records
- Updates to the reorder sheet

**Linen Tracking:**
- Linens have a **wash cycle counter** (e.g., max 200 washes)
- System tracks washes per linen set
- Alerts when linens approach end-of-life for replacement ordering

### 3. FUEL MONITORING

**Tracked fuel types:** Diesel, Petrol, Kerosene, Gas

**Flow:**
1. Daily fuel reading (dip-stick or meter) logged per tank/vehicle
2. Fuel issues logged per vehicle/generator/pump with odometer/hour reading
3. Consumption calculations: liters per km, liters per hour
4. Anomaly detection: unexpected consumption spikes
5. Reorder triggers based on tank levels and lead time

### 4. MISCELLANEOUS / SUDDEN REQUIREMENTS

**For items that don't fit regular categories:**
- Ad-hoc requisition from any department
- Approval workflow (camp manager signs off)
- Issues through stores → recorded on reorder sheet
- History tracking for pattern detection

### 5. UTENSILS & LINEN REPLACEMENT

**Tracked assets with lifecycle:**
- Crockery, cutlery, glassware, cookware (breakage/damage tracking)
- Linens: towels, bed sheets, tablecloths (wash cycle tracking)
- Each item has expected lifespan (number of washes, months, uses)
- System tracks usage/washes and projects replacement dates
- Auto-generates replacement orders when items near end-of-life

### 6. STORES (Central Hub)

**The Reorder Sheet:**
- Lives at stores level, one per camp
- Auto-populated based on:
  - PAR levels vs current stock (`stock_balances.par_level`, `min_level`)
  - Avg daily usage (`stock_balances.avg_daily_usage`)
  - Lead time from suppliers
  - Upcoming bed-nights (occupancy forecast)
- Auto-updates as goods are **issued** (not just ordered)
- Storekeeper can manually add/remove/adjust items
- Becomes the basis for the order to Head Office

**Issue Flow:**
- When any department (kitchen/housekeeping/fuel/misc) requisitions
- Storekeeper reviews → approves → issues → stock deducted
- Reorder sheet recalculates automatically
- If stock drops below `min_level` → item highlighted on reorder sheet

### 7. HEAD OFFICE

**Depends on camp reorder reports:**
- Sees consolidated reorder sheets from all camps
- Historical comparison: this week vs last week vs same week last year
- Bed-night projections drive expected consumption
- Procurement officer processes orders → dispatches to camps
- Reporting: cost per bed-night, camp comparison, supplier performance

**Bed-Night Data:**
- Manually entered per camp per day (from reservations)
- Drives all projections and per-guest-night cost calculations
- Historical bed-nights stored for trend analysis

---

## System-Wide Principles

1. **Reordering is automated but editable** — system projects needs, humans approve/adjust
2. **Every issue updates the reorder sheet** — not just kitchen, all departments
3. **Bed-nights drive everything** — projections, cost per guest, forecasting
4. **Approval workflows everywhere** — requisition → approval → issue → confirm
5. **Balance returns need dual approval** — department head + storekeeper
6. **Historical data powers projections** — "last time we had 20 guests on a Thursday, we used X"

---

## Phase 1: UI Overhaul + Design System (Week 1-2)

**Goal**: Modern, polished UI — not old school. Premium SaaS feel.

### 1.1 Design System Foundation
- [ ] Design tokens in CSS custom properties (colors, spacing, shadows, radii, typography)
- [ ] Color palette:
  - Dark sidebar (`slate-900`) with colored accent highlights per section
  - Clean white/`slate-50` content area
  - Department colors: Emerald (Kitchen), Purple (Housekeeping), Amber (Fuel), Blue (Stores), Rose (Alerts)
- [ ] Typography: Inter for UI text, tabular numbers for data columns
- [ ] 4px spacing grid, consistent shadow scale
- [ ] Skeleton loaders instead of spinners

### 1.2 Layout Redesign
- [ ] **Dark collapsible sidebar**: logo top, grouped sections with dividers, active = left accent border + bg highlight, collapsed = icons with tooltips, user/role at bottom
- [ ] **Top bar**: Breadcrumbs, global search (Cmd+K), notification bell (count badge), camp selector (managers), user dropdown
- [ ] **Mobile**: Bottom sheet nav (not tab bar), pull-to-refresh, swipe date navigation
- [ ] **Content**: Max-width 1280px, responsive padding, card-based sections

### 1.3 Component Library
- [ ] **DataTable**: Sortable, sticky headers, inline edit, row select, bulk actions, export button
- [ ] **StatCard**: Big number + trend arrow + sparkline + drill-down click
- [ ] **Charts**: Recharts — bar, line, donut, area, sparklines
- [ ] **Drawer**: Right-side slide-in for detail views
- [ ] **Modal**: Centered with backdrop for confirmations
- [ ] **Toast**: Bottom-right notification stack with auto-dismiss
- [ ] **CommandPalette**: Cmd+K global search across items, orders, rooms
- [ ] **DateRangePicker**: Preset ranges + custom
- [ ] **Skeleton**: Content-shaped loading placeholders
- [ ] **Tabs**: Underlined style for section switching
- [ ] **Avatar**: User initials with role-colored ring
- [ ] **StatusBadge**: Unified status indicators across all entities

### 1.4 Animations
- [ ] Page transitions (fade + subtle slide)
- [ ] Card hover lift, button press scale
- [ ] Number count-up animation on dashboard load
- [ ] Smooth expand/collapse for accordion sections

### 1.5 Navigation Restructure (by department)
```
STORES
  Dashboard
  Reorder Sheet        ← NEW (the central reorder mechanism)
  Stock Levels
  Issue Goods          ← replaces current Issue page
  Receive Goods
  Orders (to HO)
  Items Catalog

KITCHEN (Chef view)
  Menu Plan
  Daily Groceries      ← order from stores + track balance
  Weekly Groceries     ← order from stores + track balance
  Recipes
  Kitchen Stock        ← NEW (what's in the kitchen right now)

HOUSEKEEPING
  Room Inventory       ← NEW
  Requisitions         ← NEW
  Linen Tracker        ← NEW

FUEL
  Fuel Monitor         ← NEW
  Consumption Log      ← NEW

MISC
  Ad-hoc Requests      ← NEW

ADMIN
  Users
  Suppliers            ← NEW
  Item Master          ← NEW
  Camp Settings        ← NEW
  Audit Log            ← NEW

HEAD OFFICE
  All-Camp Dashboard   ← NEW
  Consolidated Reorder ← NEW
  Procurement          ← NEW
  Bed Nights Entry     ← NEW
  Reports & Analytics  ← enhanced
```

---

## Phase 2: Core Workflow — Kitchen + Stores Issue Flow (Week 2-3)

**Goal**: Get the chef → stores → reorder loop working end-to-end.

### 2.1 Item Classification (Daily vs Weekly)
- [ ] New table: `kitchen_item_preferences` (camp_id, item_id, list_type ENUM('daily','weekly','none'), added_by, created_at)
- [ ] Chef can browse global items catalog and assign each to daily/weekly/neither
- [ ] Daily Groceries page only shows items marked `daily`
- [ ] Weekly Groceries page only shows items marked `weekly`
- [ ] Search + add new items to either list

### 2.2 Kitchen Requisition Flow
- [ ] Chef enters order qty on Daily/Weekly Groceries page
- [ ] "Submit to Stores" button creates a **kitchen requisition** (new status on issue_vouchers or new table)
- [ ] Storekeeper sees pending kitchen requisitions
- [ ] Storekeeper can approve/adjust/reject each line
- [ ] On approval: auto-create issue voucher → deduct from stores stock → add to kitchen sub-inventory
- [ ] Notification to chef when fulfilled

### 2.3 Kitchen Balance Tracking
- [ ] After service, chef enters "remaining qty" per item
- [ ] System calculates consumed = issued - remaining
- [ ] Remaining balance options:
  - **Carry forward**: stored as opening balance for next day's Daily Groceries
  - **Return to stores**: creates a return voucher (needs chef + storekeeper approval)
- [ ] Next day's order auto-suggests: `par_level - carry_forward_balance`

### 2.4 Reorder Sheet (Stores)
- [ ] New page: `/app/reorder` — the central reorder mechanism
- [ ] Table: `reorder_sheet` (camp_id, item_id, current_stock, par_level, min_level, avg_daily_usage, projected_need, suggested_order_qty, manual_override_qty, last_issued_date, status ENUM('auto','manual','locked'))
- [ ] Auto-recalculates when:
  - Goods are **issued** to any department
  - Goods are **received** from HO/suppliers
  - Stock count adjustments
  - Bed-night data changes
- [ ] Suggested order qty formula: `MAX(0, par_level - current_stock + (avg_daily_usage * lead_time_days) + safety_stock - pending_receipts)`
- [ ] Storekeeper can manually add items, override quantities, lock lines
- [ ] "Generate Order" button → creates a stores order to Head Office from the reorder sheet
- [ ] Color coding: red (below min), amber (below par), green (OK), blue (excess)

### 2.5 Bed-Night Entry
- [ ] New page: `/app/bed-nights`
- [ ] Simple calendar grid: enter bed-night count per day per camp
- [ ] Can enter future projections (from booking data)
- [ ] Historical data stored for comparison
- [ ] Used by reorder sheet projections and cost-per-guest calculations

### 2.6 New DB Tables Needed
```sql
-- Chef's item list preferences (which items show on daily vs weekly)
CREATE TABLE kitchen_item_preferences (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  camp_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  list_type ENUM('daily','weekly') NOT NULL,
  added_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (camp_id, item_id),
  FOREIGN KEY (camp_id) REFERENCES camps(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

-- Kitchen sub-inventory (what's physically in the kitchen)
CREATE TABLE kitchen_stock (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  camp_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  current_qty DECIMAL(12,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY (camp_id, item_id),
  FOREIGN KEY (camp_id) REFERENCES camps(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

-- Kitchen requisitions (chef orders from stores)
CREATE TABLE kitchen_requisitions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  requisition_number VARCHAR(25) NOT NULL UNIQUE,
  camp_id INT UNSIGNED NOT NULL,
  req_type ENUM('daily','weekly') NOT NULL,
  req_date DATE NOT NULL,
  meal_type ENUM('lunch','dinner') DEFAULT NULL,
  requested_by INT UNSIGNED NOT NULL,
  status ENUM('draft','submitted','partial','fulfilled','cancelled') NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMP NULL,
  fulfilled_at TIMESTAMP NULL,
  fulfilled_by INT UNSIGNED DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (camp_id) REFERENCES camps(id),
  FOREIGN KEY (requested_by) REFERENCES users(id)
);

CREATE TABLE kitchen_requisition_lines (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  requisition_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  requested_qty DECIMAL(12,3) NOT NULL,
  approved_qty DECIMAL(12,3) DEFAULT NULL,
  issued_qty DECIMAL(12,3) DEFAULT NULL,
  status ENUM('pending','approved','adjusted','rejected','issued') NOT NULL DEFAULT 'pending',
  storekeeper_note VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (requisition_id) REFERENCES kitchen_requisitions(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

-- Kitchen balance returns (leftover returns to stores)
CREATE TABLE kitchen_returns (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_number VARCHAR(25) NOT NULL UNIQUE,
  camp_id INT UNSIGNED NOT NULL,
  return_date DATE NOT NULL,
  initiated_by INT UNSIGNED NOT NULL,
  chef_approved TINYINT(1) DEFAULT 0,
  storekeeper_approved TINYINT(1) DEFAULT 0,
  status ENUM('pending','chef_approved','storekeeper_approved','completed','cancelled') NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (camp_id) REFERENCES camps(id)
);

CREATE TABLE kitchen_return_lines (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  return_qty DECIMAL(12,3) NOT NULL,
  FOREIGN KEY (return_id) REFERENCES kitchen_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

-- Bed nights (occupancy data driving projections)
CREATE TABLE bed_nights (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  camp_id INT UNSIGNED NOT NULL,
  night_date DATE NOT NULL,
  actual_guests INT UNSIGNED DEFAULT NULL,
  projected_guests INT UNSIGNED DEFAULT NULL,
  entered_by INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY (camp_id, night_date),
  FOREIGN KEY (camp_id) REFERENCES camps(id)
);
```

---

## Phase 3: Housekeeping Module (Week 3-4)

**Goal**: Per-room inventory tracking with flexible restocking workflows.

### 3.1 Room Setup
- [ ] New table: `rooms` (camp_id, room_number, room_type, is_active)
- [ ] New table: `room_inventory_templates` (room_type, item_id, standard_qty, replacement_cycle_days)
- [ ] Admin sets up room types (Standard Tent, Luxury Suite, etc.) with standard inventory

### 3.2 Room Inventory Tracking
- [ ] Each room has current inventory state: `room_inventory` (room_id, item_id, current_qty, last_restocked, condition)
- [ ] Housekeeper can view any room's inventory vs template (what should be there vs what is)
- [ ] Deficit items highlighted for restocking

### 3.3 Restocking Workflows
- [ ] **Workflow A — Combined Clean + Restock**:
  - Housekeeper selects room → marks as "cleaning"
  - Scans/enters items used → auto-generates requisition to stores
  - Storekeeper issues → housekeeper confirms restock
  - Room marked "ready"
- [ ] **Workflow B — Clean First, Restock Later**:
  - Housekeeper cleans → reports deficits
  - System queues restocking list
  - Storekeeper issues in bulk for multiple rooms
  - Housekeeper confirms restock per room
- [ ] **Workflow C — Scheduled Auto-Restock**:
  - Based on occupancy calendar + template → system auto-generates daily requisition
  - Storekeeper prepares in advance
  - Housekeeper confirms placement
- [ ] **Workflow D — On-Demand**:
  - Guest requests extra towels/amenities
  - Housekeeper creates ad-hoc requisition
  - Storekeeper issues → housekeeper delivers

### 3.4 Linen Lifecycle Tracking
- [ ] New table: `linen_tracking` (item_id, camp_id, linen_set_id, wash_count, max_washes, condition, in_service_date)
- [ ] Each wash increments the counter
- [ ] Alert when wash_count approaches max_washes (e.g., at 80%)
- [ ] Auto-adds replacement to reorder sheet when end-of-life reached

### 3.5 New DB Tables
```sql
CREATE TABLE rooms (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  camp_id INT UNSIGNED NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  room_type VARCHAR(50) NOT NULL,
  floor_wing VARCHAR(50) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY (camp_id, room_number),
  FOREIGN KEY (camp_id) REFERENCES camps(id)
);

CREATE TABLE room_inventory_templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  camp_id INT UNSIGNED DEFAULT NULL,
  room_type VARCHAR(50) NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  standard_qty DECIMAL(10,2) NOT NULL,
  replacement_cycle_days INT UNSIGNED DEFAULT NULL,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE room_inventory (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  current_qty DECIMAL(10,2) NOT NULL DEFAULT 0,
  last_restocked TIMESTAMP NULL,
  condition ENUM('good','fair','replace') NOT NULL DEFAULT 'good',
  UNIQUE KEY (room_id, item_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE housekeeping_tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  camp_id INT UNSIGNED NOT NULL,
  room_id INT UNSIGNED NOT NULL,
  task_date DATE NOT NULL,
  workflow_type ENUM('combined','clean_first','scheduled','on_demand') NOT NULL,
  status ENUM('pending','cleaning','needs_restock','restocking','completed') NOT NULL DEFAULT 'pending',
  assigned_to INT UNSIGNED DEFAULT NULL,
  completed_at TIMESTAMP NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE linen_tracking (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  camp_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  linen_set_id VARCHAR(50) NOT NULL,
  wash_count INT UNSIGNED NOT NULL DEFAULT 0,
  max_washes INT UNSIGNED NOT NULL DEFAULT 200,
  condition ENUM('new','good','fair','worn','retired') NOT NULL DEFAULT 'new',
  in_service_date DATE NOT NULL,
  retired_date DATE DEFAULT NULL,
  FOREIGN KEY (camp_id) REFERENCES camps(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);
```

---

## Phase 4: Fuel + Miscellaneous + Utensils (Week 4-5)

### 4.1 Fuel Monitoring
- [ ] New page: `/app/fuel`
- [ ] Register fuel tanks (camp_id, fuel_type, capacity, location)
- [ ] Register vehicles/generators (name, fuel_type, camp_id)
- [ ] Daily tank reading entry (date, tank_id, reading_liters)
- [ ] Fuel issue log: tank/vehicle, liters, odometer/hours reading, purpose
- [ ] Consumption calculations: L/100km (vehicles), L/hour (generators)
- [ ] Anomaly alerts: spike in consumption vs rolling average
- [ ] Reorder trigger: when tank level drops below threshold

### 4.2 Miscellaneous / Ad-Hoc Requisitions
- [ ] New page: `/app/requisitions`
- [ ] Any department can create an ad-hoc requisition
- [ ] Camp manager approval required (above certain value threshold)
- [ ] Storekeeper fulfills → issue voucher created
- [ ] History + pattern detection: "this misc item has been requested 3 times this month → add to regular stock?"

### 4.3 Utensil & Linen Replacement Planning
- [ ] Asset register: crockery, cutlery, glassware, cookware, linens
- [ ] Each has: expected_lifespan (months or uses), in_service_date, current_condition
- [ ] Breakage/damage log: date, item, qty broken, reason
- [ ] System projects replacement needs based on:
  - Wash cycle tracking (linens)
  - Breakage rate (crockery)
  - Age-based depreciation
- [ ] Auto-adds projected replacements to reorder sheet
- [ ] Monthly replacement report for Head Office

### 4.4 New DB Tables
```sql
CREATE TABLE fuel_tanks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  camp_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  fuel_type ENUM('diesel','petrol','kerosene','gas') NOT NULL,
  capacity_liters DECIMAL(10,2) NOT NULL,
  min_level_liters DECIMAL(10,2) DEFAULT NULL,
  location VARCHAR(100) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (camp_id) REFERENCES camps(id)
);

CREATE TABLE fuel_readings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tank_id INT UNSIGNED NOT NULL,
  reading_date DATE NOT NULL,
  level_liters DECIMAL(10,2) NOT NULL,
  logged_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tank_id) REFERENCES fuel_tanks(id)
);

CREATE TABLE fuel_vehicles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  camp_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  registration VARCHAR(20) DEFAULT NULL,
  fuel_type ENUM('diesel','petrol') NOT NULL,
  vehicle_type ENUM('game_drive','transfer','service','generator','pump') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (camp_id) REFERENCES camps(id)
);

CREATE TABLE fuel_issues (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  camp_id INT UNSIGNED NOT NULL,
  tank_id INT UNSIGNED DEFAULT NULL,
  vehicle_id INT UNSIGNED DEFAULT NULL,
  issue_date DATE NOT NULL,
  liters DECIMAL(10,2) NOT NULL,
  odometer_km DECIMAL(10,1) DEFAULT NULL,
  hours_reading DECIMAL(10,1) DEFAULT NULL,
  purpose VARCHAR(200) DEFAULT NULL,
  issued_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (camp_id) REFERENCES camps(id),
  FOREIGN KEY (tank_id) REFERENCES fuel_tanks(id),
  FOREIGN KEY (vehicle_id) REFERENCES fuel_vehicles(id)
);

CREATE TABLE asset_register (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  camp_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  asset_type ENUM('crockery','cutlery','glassware','cookware','linen','equipment','other') NOT NULL,
  qty_in_service INT UNSIGNED NOT NULL DEFAULT 0,
  expected_lifespan_months INT UNSIGNED DEFAULT NULL,
  in_service_date DATE NOT NULL,
  condition ENUM('new','good','fair','worn','replace') NOT NULL DEFAULT 'new',
  FOREIGN KEY (camp_id) REFERENCES camps(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE asset_damage_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id INT UNSIGNED DEFAULT NULL,
  camp_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  damage_date DATE NOT NULL,
  qty_damaged INT UNSIGNED NOT NULL DEFAULT 1,
  damage_type ENUM('broken','chipped','torn','stained','worn','lost','other') NOT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  reported_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (camp_id) REFERENCES camps(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);
```

---

## Phase 5: Head Office + Admin Panel (Week 5-6)

### 5.1 Admin Panel
- [ ] Item Master CRUD (replace Python import scripts)
- [ ] Supplier management with item-supplier links
- [ ] Camp settings (PAR levels, room setup, fuel tanks)
- [ ] User management (existing, enhance)
- [ ] Audit log viewer
- [ ] Default menu template editor
- [ ] System settings (approval limits, cost targets)

### 5.2 Head Office Dashboard
- [ ] All-camp summary: stock value, pending orders, bed-nights, alerts per camp
- [ ] Consolidated reorder view: see all camps' reorder sheets in one place
- [ ] Procurement processing: approve camp orders → generate POs to suppliers
- [ ] Dispatch tracking: what's been sent, what's in transit, what's delivered

### 5.3 Bed-Night Driven Projections
- [ ] Input: bed-night actuals + forecasts per camp per day
- [ ] Output: projected consumption per item based on historical usage-per-guest
- [ ] Comparison: projected vs actual consumption → variance reports
- [ ] Cost per bed-night per department (F&B, housekeeping, fuel)
- [ ] Seasonal pattern recognition

### 5.4 Consolidated Reporting
- [ ] Reorder report: all camps, filterable, exportable (PDF/Excel)
- [ ] Consumption report: by department, by camp, by period
- [ ] Cost analysis: per bed-night, per department, trend over time
- [ ] Supplier performance: delivery time, quality, price trends
- [ ] Waste report: kitchen waste, expired stock, breakage losses
- [ ] Stock valuation: current value by camp, by group
- [ ] Historical comparison: this month vs last month vs same month last year

---

## Phase 6: Analytics + Charts Dashboard (Week 6-7)

### 6.1 Executive Dashboard
- [ ] KPI cards: Total Stock Value, Pending Orders, Today's Bed-Nights, F&B Cost %, Low Stock Items, Orders in Transit
- [ ] Stock value trend (area chart, 30 days)
- [ ] Order volume by camp (bar chart)
- [ ] Issue breakdown by department (donut: Kitchen/Rooms/Fuel/Misc)
- [ ] Top 10 fast-moving items
- [ ] Consumption vs bed-nights correlation chart
- [ ] Alert summary with severity grouping

### 6.2 Kitchen Analytics
- [ ] F&B cost per bed-night trend
- [ ] Cost per meal breakdown
- [ ] Top 10 most expensive dishes
- [ ] Waste percentage tracking with targets
- [ ] Menu engineering matrix (star/plowhorse/puzzle/dog)
- [ ] Recipe costing based on current prices

### 6.3 Inventory Health
- [ ] Stock status donut (OK/Low/Critical/Out/Excess)
- [ ] Days of stock remaining per item
- [ ] Dead stock detection (no movement in X days)
- [ ] Turnover ratio by category
- [ ] Shrinkage report (expected vs actual)
- [ ] PAR compliance percentage

### 6.4 Report Exports
- [ ] PDF export (jsPDF + autoTable, or server-side DOMPDF)
- [ ] Excel export (SheetJS/xlsx)
- [ ] Print-optimized layouts
- [ ] Custom date range for all reports

---

## Phase 7: Performance + Offline + Advanced (Week 7-8+)

### 7.1 Cloudflare CDN
- [ ] Static assets cached at edge
- [ ] API GET responses cached with short TTL
- [ ] TTFB reduction from ~1.3s to ~300ms

### 7.2 Code Splitting
- [ ] React.lazy per page
- [ ] Separate vendor chunk
- [ ] Preload critical routes

### 7.3 Offline Enhancement
- [ ] Service worker with Workbox
- [ ] Full offline read (cached items, stock, orders)
- [ ] Offline write queue (requisitions, stock counts, fuel readings)
- [ ] Delta sync when reconnected

### 7.4 AI Features (Gemini)
- [ ] Smart reorder suggestions based on bed-night forecast + historical usage
- [ ] Waste prediction per dish/ingredient
- [ ] Price anomaly detection (supplier prices vs historical)
- [ ] Natural language search: "What did Serengeti kitchen use last Tuesday?"

---

## Tech Stack

### Keep
- React 19 + Vite 7 + Tailwind CSS 4
- Capacitor 8 for Android
- PHP (no framework) + MySQL on Hostinger
- Google Gemini 2.0 Flash for AI

### Add
- **Recharts** — charts and data visualization
- **date-fns** — date manipulation (replace manual date math)
- **jsPDF + autoTable** — client-side PDF export
- **xlsx (SheetJS)** — client-side Excel export
- **Cloudflare** — CDN/proxy (free tier)
- **Workbox** — service worker management

### Database
- Existing v3 schema covers ~70% of needs
- New tables needed for: kitchen_stock, kitchen_requisitions, rooms, housekeeping, fuel, assets, bed_nights, linen_tracking
- No migration tool needed — direct SQL scripts via setup endpoints

---

## Priority If Time-Constrained

| Priority | Phase | Why |
|----------|-------|-----|
| 1 | Phase 1 (UI) | Everything looks and feels premium immediately |
| 2 | Phase 2 (Kitchen + Stores + Reorder) | The core operational loop that drives everything |
| 3 | Phase 5.2 (HO Dashboard + Reorder Reports) | HO needs visibility into camp operations |
| 4 | Phase 3 (Housekeeping) | Second-largest department workflow |
| 5 | Phase 6 (Analytics) | Makes data actionable |
| 6 | Phase 4 (Fuel + Misc + Utensils) | Important but lower volume than kitchen/HK |
| 7 | Phase 5.1 (Admin Panel) | Currently managed via scripts, can wait |
| 8 | Phase 7 (Performance + Offline + AI) | Polish and optimization |

---

*Each phase delivers a working, deployable improvement. No big-bang rewrites. Ship early, iterate fast.*
