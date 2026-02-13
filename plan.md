# Kitchen Menu Planning — Implementation Plan

## Overview
A new "Menu Plan" page for chefs to plan daily lunch/dinner menus. Chef picks a meal (lunch/dinner), adds courses (appetizer, main course, dessert), writes dish names, and Gemini AI suggests main ingredients. Chef sets portions count and the system calculates required quantities. Every action is logged for full audit trail.

---

## 1. New Database Tables

### `kitchen_menu_plans`
| Column | Type | Purpose |
|--------|------|---------|
| id | INT PK | |
| camp_id | INT | Which camp |
| plan_date | DATE | Which day |
| meal_type | ENUM('lunch','dinner') | Meal |
| portions | INT | Number of servings |
| status | ENUM('draft','confirmed','issued') | Workflow |
| created_by | INT | Chef user ID |
| confirmed_at | TIMESTAMP | When confirmed |
| notes | TEXT | Chef notes |
| created_at / updated_at | TIMESTAMP | |

### `kitchen_menu_dishes`
| Column | Type | Purpose |
|--------|------|---------|
| id | INT PK | |
| menu_plan_id | INT FK | Parent plan |
| course | ENUM('appetizer','main_course','dessert','soup','salad','side','beverage') | Course type |
| dish_name | VARCHAR(200) | e.g. "Grilled Chicken with Herb Butter" |
| sort_order | INT | Ordering within course |
| created_at | TIMESTAMP | |

### `kitchen_menu_ingredients`
| Column | Type | Purpose |
|--------|------|---------|
| id | INT PK | |
| dish_id | INT FK | Parent dish |
| item_id | INT FK | Stock item |
| suggested_qty | DECIMAL | AI-suggested qty for portions |
| final_qty | DECIMAL | Chef's adjusted qty |
| source | ENUM('ai_suggested','manual','modified') | How it got added |
| is_removed | TINYINT | Chef removed this suggestion |
| removed_reason | VARCHAR(200) | Why removed |
| created_at / updated_at | TIMESTAMP | |

### `kitchen_menu_audit_log`
| Column | Type | Purpose |
|--------|------|---------|
| id | INT PK | |
| menu_plan_id | INT FK | Which plan |
| dish_id | INT FK NULL | Which dish (if applicable) |
| ingredient_id | INT FK NULL | Which ingredient (if applicable) |
| user_id | INT | Who did it |
| action | ENUM('create_plan','add_dish','remove_dish','add_ingredient','remove_ingredient','modify_qty','change_portions','confirm','ai_suggest','manual_add') | |
| old_value | JSON | Before state |
| new_value | JSON | After state |
| created_at | TIMESTAMP | |

---

## 2. New Backend API — `api/kitchen-menu.php`

### GET Endpoints
- `?action=plan&date=YYYY-MM-DD&meal=lunch` — Get menu plan for date/meal
- `?action=plans&month=YYYY-MM` — List all plans for a month (calendar view)
- `?action=audit&plan_id=X` — Get full audit trail for a plan
- `?action=suggest_ingredients&dish=Grilled+Chicken&portions=20` — Gemini suggests ingredients with quantities

### POST Endpoints
- `action=create_plan` — Create new plan (date, meal_type, portions)
- `action=add_dish` — Add dish to a course
- `action=remove_dish` — Remove dish
- `action=accept_suggestions` — Accept AI ingredient suggestions
- `action=add_ingredient` — Manually add an ingredient
- `action=remove_ingredient` — Remove an ingredient (logs reason)
- `action=update_qty` — Adjust ingredient quantity
- `action=update_portions` — Change portions (recalculates all qtys)
- `action=confirm_plan` — Confirm the plan (locks it)

### Gemini AI Prompt Design
When chef types dish name (e.g. "Grilled Chicken with Herb Butter") + portions (e.g. 20):
- Send available stock list from camp
- Ask Gemini for main ingredients with quantities for N portions
- Return structured JSON: `[{name, qty, uom, is_primary, reason}]`
- Match to real stock items by fuzzy name

---

## 3. New Frontend Page — `src/pages/MenuPlan.jsx`

### Layout (Mobile-first)
```
┌─────────────────────────────┐
│ 📅 Today's Menu Plan        │  ← Date picker + Lunch/Dinner toggle
│ [< Feb 12] [Lunch|Dinner]  │
│ Portions: [20] 👤           │
├─────────────────────────────┤
│ 🥗 APPETIZER          [+ Add]│
│ ┌─────────────────────────┐ │
│ │ Tomato Bruschetta    ✕  │ │  ← Dish card
│ │ 🤖 4 ingredients • ✓    │ │  ← AI suggested count
│ │ + Tomatoes (2kg) ✓      │ │  ← Ingredients expandable
│ │ + Olive Oil (0.5L) ✓    │ │
│ │ + Basil (50g) ✓         │ │
│ │ + Bread (20pcs) ✓       │ │
│ │ [+ Add Ingredient]      │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Caesar Salad         ✕  │ │
│ │ ...                     │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ 🍖 MAIN COURSE       [+ Add]│
│ ┌─────────────────────────┐ │
│ │ Grilled Chicken      ✕  │ │
│ │ ...                     │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ 🍰 DESSERT           [+ Add]│
│ ...                         │
├─────────────────────────────┤
│ [Confirm Menu Plan]         │  ← Saves & locks
└─────────────────────────────┘
```

### User Flow
1. Chef picks date (default: today) + meal (lunch/dinner)
2. Sets portions count (e.g. 20 guests)
3. Taps "+ Add" on Appetizer section
4. Types dish name → "Tomato Bruschetta"
5. System calls Gemini with dish name + portions + available stock
6. AI returns suggested ingredients with quantities → shown with checkmarks
7. Chef can: accept all, remove some, adjust quantities, add manual ingredients
8. Repeat for more dishes in appetizer, then main course, dessert
9. "Confirm Menu Plan" locks the plan

### Audit View
- When viewing a past date, show read-only plan with audit trail
- Each ingredient shows: AI suggested ✨ / Manual ✋ / Modified 📝 / Removed ❌
- Expandable audit log showing every action with timestamps

---

## 4. Frontend API Service Addition — `src/services/api.js`

Add `kitchenMenu` export with methods for all endpoints above.

---

## 5. Route + Nav Changes

### App.jsx
- Add route: `<Route path="menu-plan" element={<MenuPlan />} />`

### Sidebar.jsx + MobileNav.jsx
- Add nav item: `{ path: '/app/menu-plan', icon: ChefHat, label: 'Menu Plan', roles: ['chef', 'camp_manager', 'admin'] }`
- This restricts the page to chefs and managers only

---

## 6. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `api/kitchen-menu.php` | CREATE | Full backend API |
| `database/kitchen_menu_migration.sql` | CREATE | DB tables |
| `src/pages/MenuPlan.jsx` | CREATE | Main page component |
| `src/services/api.js` | MODIFY | Add kitchenMenu API methods |
| `src/App.jsx` | MODIFY | Add route |
| `src/components/layout/Sidebar.jsx` | MODIFY | Add nav item |
| `src/components/layout/MobileNav.jsx` | MODIFY | Add nav item |

---

## 7. Build Order
1. Database migration SQL
2. Backend API (kitchen-menu.php)
3. Frontend API service methods
4. MenuPlan.jsx page
5. Route + nav integration
6. Build + test
7. Push both repos (frontend + API)
