import { Link } from 'react-router-dom'
import {
  Boxes, ShoppingCart, BarChart3, ChefHat, Wine, Shield,
  ArrowRight, CheckCircle, Star, Users, Globe, Zap,
  Truck, MapPin, Tent, Sunrise, TreePine, PackageCheck,
  HelpCircle, ChevronDown
} from 'lucide-react'
import { useState } from 'react'
import PublicNavbar from '../components/layout/PublicNavbar'
import PublicFooter from '../components/layout/PublicFooter'

const features = [
  {
    icon: Boxes,
    title: 'Camp Stock Control',
    desc: 'Track inventory across remote lodges and bush camps in real-time. Auto-alerts for low stock, par levels, and dead stock — even offline.',
    color: 'blue',
  },
  {
    icon: ShoppingCart,
    title: 'Safari Procurement',
    desc: 'Multi-camp ordering with approval workflows. Head office oversight on every purchase order, from Arusha suppliers to bush deliveries.',
    color: 'green',
  },
  {
    icon: ChefHat,
    title: 'Bush Kitchen & Menu Planning',
    desc: 'AI-powered menu planning for guest meal services. Daily/weekly grocery lists, recipe costing, and dietary tracking for safari guests.',
    color: 'amber',
  },
  {
    icon: Wine,
    title: 'Lodge Bar & POS',
    desc: 'Point of sale for lodge bars and sundowner stations. Track cocktails, wines, and spirits with real-time sales and stock deductions.',
    color: 'purple',
  },
  {
    icon: Truck,
    title: 'Inter-Camp Dispatch',
    desc: 'Manage goods movement between head office, lodges, and mobile camps. Track dispatch, transit, and receiving with full audit trails.',
    color: 'cyan',
  },
  {
    icon: Shield,
    title: 'Role-Based Access Control',
    desc: 'Camp storekeepers, bush chefs, lodge managers, operations directors — each role sees exactly what they need, nothing more.',
    color: 'red',
  },
]

const colorMap = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  red: 'bg-red-50 text-red-600',
}

const stats = [
  { value: '30', label: 'Days Free Trial' },
  { value: '5', label: 'Team Members Included' },
  { value: '2', label: 'Camp Locations' },
  { value: '24/7', label: 'Bush to Office Sync' },
]

const painPoints = [
  { before: 'Spreadsheets lost when camp moves', after: 'Cloud-synced inventory, works offline too' },
  { before: 'No visibility into remote camp stock', after: 'Real-time dashboards per camp location' },
  { before: 'Chefs ordering without budget control', after: 'Approval workflows with spending limits' },
  { before: 'Bar stock shrinkage goes unnoticed', after: 'POS tracks every pour and sale' },
]

const testimonials = [
  {
    name: 'Operations Director — Serengeti Lodge Group',
    text: 'We run 5 camps across the Serengeti. Before WebSquare, stock reconciliation took 3 days. Now it takes 3 minutes. The inter-camp dispatch feature alone saved us.',
  },
  {
    name: 'Head Chef — Ngorongoro Crater Lodge',
    text: 'Planning meals for 40 guests with dietary requirements used to be a nightmare. The AI menu planner handles it beautifully, and my grocery lists are spot on.',
  },
  {
    name: 'Camp Manager — Tarangire Mobile Camp',
    text: 'Even in the bush with spotty internet, WebSquare works offline. When signal returns, everything syncs. It is built for safari operations.',
  },
]

const faqs = [
  {
    q: 'Does WebSquare work offline in remote bush camps?',
    a: 'Yes. WebSquare is built offline-first. All operations — stock counts, orders, POS sales — continue without internet. Data syncs automatically when connectivity returns.',
  },
  {
    q: 'Can I manage inventory across multiple safari camps?',
    a: 'Yes. WebSquare supports multi-camp operations with inter-camp dispatch tracking, centralized procurement from head office, and per-camp dashboards with role-based access.',
  },
  {
    q: 'Is there a free trial for safari lodges?',
    a: 'Yes. We offer a 30-day free trial with full access to all features, up to 5 team members and 2 camp locations. No credit card required.',
  },
  {
    q: 'What safari operations does WebSquare cover?',
    a: 'WebSquare covers stock management, procurement and purchase orders, kitchen and menu planning with AI, bar and POS, inter-camp dispatch and receiving, and reporting — all in one platform.',
  },
]

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-xs)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left bg-white hover:bg-gray-50 transition"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-gray-900 pr-4">{q}</span>
        <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 bg-white">
          <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      <main>
        {/* ── Hero ── */}
        <section className="py-20 lg:py-28 px-4 relative overflow-hidden" aria-label="Hero">
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle at 25% 25%, #f59e0b 1px, transparent 1px), radial-gradient(circle at 75% 75%, #f59e0b 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} aria-hidden="true" />
          <div className="max-w-4xl mx-auto text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium mb-6">
              <Tent size={14} aria-hidden="true" />
              Built for Safari Lodges & Bush Camps
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Safari Inventory Management
              <br />
              <span className="text-amber-500">Under Control</span>
            </h1>
            <p className="text-lg lg:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              The inventory platform built for the African safari industry.
              Manage stock, procurement, kitchen, and bar across lodges and mobile camps — even offline in the bush.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-amber-500 rounded-xl hover:bg-amber-600 transition flex items-center justify-center gap-2"
              >
                Start 30-Day Free Trial
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
              >
                Sign In to Your Lodge
              </Link>
            </div>
            <p className="text-xs text-gray-400 mt-4">No credit card required. Full access to all features.</p>
          </div>
        </section>

        {/* ── Stats Strip ── */}
        <section className="bg-gray-50 py-12 px-4" style={{ borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }} aria-label="Trial benefits">
          <div className="max-w-4xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pain Points → Solution ── */}
        <section className="py-20 px-4" aria-label="Challenges solved">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Safari Operations Challenges, Solved</h2>
              <p className="text-gray-500 max-w-lg mx-auto">
                Running inventory across remote bush camps is hard. We built WebSquare to fix exactly that.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {painPoints.map((p, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: 'var(--shadow-xs)' }}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-6 h-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold" aria-hidden="true">✕</div>
                    <p className="text-sm text-gray-500 line-through">{p.before}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
                      <CheckCircle size={14} />
                    </div>
                    <p className="text-sm font-medium text-gray-900">{p.after}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="bg-gray-50 py-20 px-4" id="features" style={{ borderTop: '1px solid #f1f5f9' }} aria-label="Features">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything Your Safari Lodge Needs</h2>
              <p className="text-gray-500 max-w-lg mx-auto">
                From head office warehouse to bush kitchen to lodge bar — one platform for your entire safari operation.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <article
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition"
                  style={{ boxShadow: 'var(--shadow-xs)' }}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorMap[f.color]}`} aria-hidden="true">
                    <f.icon size={22} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" className="py-20 px-4" aria-label="How it works">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Up and Running Before Your Next Game Drive</h2>
              <p className="text-gray-500">Three simple steps to modernize your lodge operations.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: '1', title: 'Register Your Lodge', desc: 'Enter your company details and create your admin account. Takes 30 seconds.', icon: Tent },
                { step: '2', title: 'Add Your Camps', desc: 'Set up your camp locations, upload your items catalog, and invite your team.', icon: MapPin },
                { step: '3', title: 'Start Operations', desc: 'Begin managing stock, orders, kitchen, and bar from day one — even offline.', icon: Sunrise },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                    <s.icon size={24} />
                  </div>
                  <div className="text-xs font-bold text-amber-500 mb-2">STEP {s.step}</div>
                  <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Built for Safari ── */}
        <section id="built-for-bush" className="bg-gray-50 py-16 px-4" style={{ borderTop: '1px solid #f1f5f9' }} aria-label="Key capabilities">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Built for the Bush</h2>
              <p className="text-gray-500 text-sm">Designed for the unique challenges of safari and lodge operations in Africa.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: TreePine, label: 'Works Offline', desc: 'Syncs when signal returns' },
                { icon: MapPin, label: 'Multi-Camp', desc: 'Manage all locations' },
                { icon: PackageCheck, label: 'Dispatch Tracking', desc: 'Camp-to-camp transfers' },
                { icon: Globe, label: 'Mobile Ready', desc: 'Android app included' },
              ].map((item, i) => (
                <div key={i} className="text-center p-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3" aria-hidden="true">
                    <item.icon size={20} />
                  </div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="py-20 px-4" aria-label="Testimonials">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Trusted by Safari Operators</h2>
              <p className="text-gray-500">Lodges and camps across East Africa rely on WebSquare daily.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <blockquote
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-6"
                  style={{ boxShadow: 'var(--shadow-xs)' }}
                >
                  <div className="flex items-center gap-1 mb-3" aria-label="5 out of 5 stars">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} size={14} className="text-amber-400 fill-amber-400" aria-hidden="true" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">{t.text}</p>
                  <cite className="text-xs font-medium text-gray-400 not-italic">{t.name}</cite>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="bg-gray-50 py-20 px-4" style={{ borderTop: '1px solid #f1f5f9' }} aria-label="Frequently asked questions">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Frequently Asked Questions</h2>
              <p className="text-gray-500">Common questions about WebSquare for safari operations.</p>
            </div>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-gray-900 py-20 px-4" aria-label="Get started">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Run Your Safari Lodge Smarter?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Join safari operators across East Africa who trust WebSquare for inventory management.
              30-day free trial, no credit card, cancel anytime.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-gray-900 bg-amber-400 rounded-xl hover:bg-amber-300 transition"
            >
              Get Started Free
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
