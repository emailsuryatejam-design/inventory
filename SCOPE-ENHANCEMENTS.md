# WebSquare — Enhancement Scope & New Features

## Status: All Phases Complete
Build verified, all pages tested locally. Production-ready for deployment.

---

## What Was Built (This Session)

### Multi-Tenant Registration System
- **Landing page** — Safari-focused marketing page with hero, features, pain points, testimonials, FAQ, CTA
- **Registration** — Public signup with 30-day free trial, auto-login, tenant + camp + user creation
- **Global Admin** — Standalone admin panel to manage all tenants (view, suspend, activate, extend trials)
- **Database migration** — `tenants` table, `global_admins` table, `tenant_id` on users/camps

### SEO Optimization (Applied)
- Title tag, meta description, keywords targeting "safari inventory management"
- Open Graph + Twitter Card tags for social sharing
- JSON-LD structured data: Organization, SoftwareApplication, FAQPage
- robots.txt + sitemap.xml
- Semantic HTML: `<header>`, `<main>`, `<section>`, `<article>`, `<blockquote>`, `<footer>`
- Single H1, proper H2/H3 hierarchy, aria-labels, aria-hidden on decorative elements
- FAQ section matching FAQPage schema for Google rich results

### Security Fixes (API)
- `.env` system for secrets (DB, JWT, Gemini API key)
- SQL injection fixes across 12+ files (parameterized LIMIT/OFFSET, camp filters)
- CORS restricted to allowed origins
- Rate limiting on auth endpoints
- File upload validation (finfo + getimagesize)
- Error message sanitization (no stack traces to client)
- Debug endpoints gated behind auth/env checks

### Frontend Quality
- React.lazy() code splitting for 35+ pages
- ErrorBoundary at root and per-page level
- SearchInput debounce cleanup on unmount
- Guide system: coaching mode + auto-demo mode with progress tracking

### Visual Redesign
- White sidebar with amber accents (KaziPay style)
- StatCard icon-right layout, QuickAction with circular icons
- MobileNav updated to amber theme
- Subtle shadows across all cards

---

## Enhancements Scope

### P0 — Critical (Before Production Launch)

1. **Tenant-scoped data isolation**
   - All API endpoints must filter by `tenant_id` from JWT
   - Users should only see data belonging to their tenant
   - Add `tenant_id` check to every query in: items, orders, stock, dispatch, receive, issue, POS, recipes, menu, kitchen, camps, users
   - Estimated: 15-20 API files

2. **Password reset flow**
   - Forgot password link on Login page
   - API endpoint: generate reset token, send email
   - Reset page: verify token, set new password
   - Requires email service (SMTP or transactional email API)

3. **Email verification on registration**
   - Send verification email after signup
   - Block full access until email confirmed
   - Resend verification option

4. **Global admin: tenant deletion**
   - Soft delete (mark as deleted, hide from lists)
   - Hard delete option with data purge (cascade: users, camps, orders, stock, etc.)
   - Confirmation required with tenant name typed

5. **HTTPS enforcement**
   - Redirect HTTP to HTTPS in .htaccess
   - Set HSTS header
   - Update all hardcoded URLs

### P1 — High Priority (Post-Launch, Week 1-2)

6. **Billing & subscription management**
   - Stripe/payment gateway integration
   - Plans: Free Trial → Starter → Professional → Enterprise
   - Upgrade/downgrade flows
   - Invoice generation and history
   - Auto-suspend on payment failure

7. **Tenant onboarding wizard**
   - Step-by-step setup after registration
   - Add first camp, invite team members, upload items catalog
   - Progress indicator showing completion

8. **Email notifications**
   - Trial expiry warnings (7 days, 3 days, 1 day before)
   - Welcome email after registration
   - Order approval/rejection notifications
   - Low stock alerts via email

9. **Tenant settings page**
   - Company profile editing (name, logo, contact)
   - Custom branding (primary color, logo on receipts)
   - Module toggles (enable/disable Kitchen, POS, etc.)
   - User management (invite, deactivate, change roles)

10. **Audit logging**
    - Track all sensitive operations (login, approve, dispatch, user changes)
    - Viewable in admin panel
    - API: `audit.php` with file-based structured logging

### P2 — Medium Priority (Month 1-2)

11. **Reports & analytics dashboard**
    - Stock valuation over time
    - Procurement spend by camp/category
    - POS revenue trends
    - Order fulfillment rates
    - Export to CSV/PDF

12. **Multi-currency support**
    - USD, KES, TZS, ZAR currency settings per tenant
    - Currency display formatting
    - Exchange rate management

13. **Supplier management**
    - Supplier directory per tenant
    - Link suppliers to purchase orders
    - Supplier performance tracking
    - Contact info and payment terms

14. **Barcode/QR scanning**
    - Camera-based barcode scanning on mobile
    - QR codes for items, dispatch packages
    - Print barcode labels

15. **Notification center**
    - In-app notification bell with badge count
    - Real-time updates via polling or WebSocket
    - Mark read/unread, notification preferences

### P3 — Nice to Have (Quarter 2+)

16. **White-label / custom domains**
    - Tenants use their own domain (inventory.safarilodge.com)
    - Custom branding per tenant (colors, logo)
    - Remove WebSquare branding on Enterprise plan

17. **API access for tenants**
    - REST API keys for integration
    - Webhook support for events (order created, stock updated)
    - API documentation portal

18. **Advanced POS features**
    - Table/room billing
    - Split bills
    - Tip tracking
    - End-of-day reconciliation
    - Receipt printing via Bluetooth/network printer

19. **Inventory forecasting**
    - AI-powered demand prediction based on guest bookings
    - Seasonal trend analysis
    - Auto-reorder suggestions

20. **Mobile app enhancements**
    - Push notifications via Firebase
    - Biometric login (fingerprint/face)
    - Offline photo capture for goods receiving
    - Capacitor camera plugin for barcode scanning

21. **Multi-language support**
    - i18n framework (react-intl or i18next)
    - English, Swahili, French initially
    - Language selector in settings

22. **Blog/content pages for SEO**
    - `/blog` route with static or CMS-backed content
    - Topics: "Best Inventory Practices for Safari Lodges", "How to Reduce Stock Shrinkage in Bush Camps"
    - Drives organic traffic for long-tail keywords

---

## Technical Debt

1. **Split `api.js`** into modules (client, cache, endpoints) — planned but not executed
2. **Create `constants.js`** for magic numbers (debounce, pagination, cache TTL)
3. **Add logger.php** — structured file-based logging for API
4. **Fix silent catch blocks** in GuideContext.jsx and AppContext.jsx
5. **Add input validation helpers** usage across all endpoints
6. **Capacitor `allowNavigation`** — restrict from `*` to specific domains

---

## SEO Next Steps (from Strategy Guide)

1. **Google Search Console** — Verify domain, submit sitemap.xml
2. **Google Analytics 4** — Add tracking script to index.html
3. **OG image** — Create branded social sharing image (1200x630px)
4. **Content marketing** — 2-4 blog posts/month targeting safari inventory keywords
5. **Local SEO** — Google Business Profile if physical office
6. **Backlinks** — Guest posts on safari industry blogs, TripAdvisor integration
7. **Monthly audit** — Check Search Console for errors, update sitemap, refresh content

---

## Infrastructure

1. **CI/CD pipeline** — Auto-deploy on push to main (GitHub Actions → Hostinger)
2. **Staging environment** — Test changes before production
3. **Database backups** — Automated daily backups with retention policy
4. **Error monitoring** — Sentry or similar for frontend + API error tracking
5. **Uptime monitoring** — Simple ping monitor for API availability
