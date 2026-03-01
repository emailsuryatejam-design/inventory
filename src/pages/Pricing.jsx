import { Link } from 'react-router-dom'
import { Check, X as XIcon, ArrowRight, Zap, Shield, Headphones } from 'lucide-react'
import PublicNavbar from '../components/layout/PublicNavbar'
import PublicFooter from '../components/layout/PublicFooter'

const plans = [
  {
    name: 'Trial',
    badge: 'Free',
    price: '$0',
    period: 'for 30 days',
    description: 'Try everything — no credit card required.',
    features: {
      users: '5 team members',
      camps: '2 camp locations',
      modules: 'All modules included',
      support: 'Email support',
    },
    cta: 'Start Free Trial',
    ctaLink: '/register',
    highlight: true,
    icon: Zap,
    color: 'amber',
  },
  {
    name: 'Starter',
    price: '$29',
    period: '/month',
    description: 'For small lodges getting organized.',
    features: {
      users: '10 team members',
      camps: '5 camp locations',
      modules: 'All modules included',
      support: 'Email support',
    },
    cta: 'Coming Soon',
    ctaLink: null,
    highlight: false,
    icon: Shield,
    color: 'blue',
  },
  {
    name: 'Professional',
    price: '$79',
    period: '/month',
    description: 'For large operations across multiple camps.',
    features: {
      users: 'Unlimited members',
      camps: 'Unlimited locations',
      modules: 'All modules + API access',
      support: 'Priority support',
    },
    cta: 'Coming Soon',
    ctaLink: null,
    highlight: false,
    icon: Headphones,
    color: 'purple',
  },
]

const comparisonFeatures = [
  { name: 'Stock Management', trial: true, starter: true, pro: true },
  { name: 'Kitchen & Menu Planning', trial: true, starter: true, pro: true },
  { name: 'Bar POS System', trial: true, starter: true, pro: true },
  { name: 'Procurement & Orders', trial: true, starter: true, pro: true },
  { name: 'Multi-Camp Dispatch', trial: true, starter: true, pro: true },
  { name: 'Reports & Analytics', trial: true, starter: true, pro: true },
  { name: 'Offline Mode', trial: true, starter: true, pro: true },
  { name: 'Mobile App (Android)', trial: true, starter: true, pro: true },
  { name: 'Role-Based Access Control', trial: true, starter: true, pro: true },
  { name: 'AI Recipe Suggestions', trial: true, starter: true, pro: true },
  { name: 'API Access', trial: false, starter: false, pro: true },
  { name: 'Priority Support', trial: false, starter: false, pro: true },
  { name: 'Custom Integrations', trial: false, starter: false, pro: true },
]

const colorMap = {
  amber: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', btn: 'bg-amber-500 hover:bg-amber-600', badge: 'bg-amber-100 text-amber-700' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', btn: 'bg-blue-500 hover:bg-blue-600', badge: 'bg-blue-100 text-blue-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', btn: 'bg-purple-500 hover:bg-purple-600', badge: 'bg-purple-100 text-purple-700' },
}

export default function Pricing() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      <main>
        {/* Header */}
        <section className="py-16 lg:py-20 px-4 text-center">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Start free for 30 days. No credit card required. Upgrade when you're ready.
          </p>
        </section>

        {/* Plan Cards */}
        <section className="px-4 pb-16">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
            {plans.map(plan => {
              const colors = colorMap[plan.color]
              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl p-6 flex flex-col ${
                    plan.highlight
                      ? `${colors.bg} border-2 ${colors.border}`
                      : 'bg-white border border-gray-200'
                  }`}
                  style={{ boxShadow: plan.highlight ? '0 8px 30px rgba(245,158,11,0.12)' : 'var(--shadow-xs)' }}
                >
                  {plan.badge && (
                    <span className={`absolute -top-3 left-6 px-3 py-1 text-xs font-bold rounded-full ${colors.badge}`}>
                      {plan.badge}
                    </span>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.bg}`}>
                      <plan.icon size={20} className={colors.text} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                  </div>

                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-sm text-gray-500 ml-1">{plan.period}</span>
                  </div>

                  <p className="text-sm text-gray-500 mb-6">{plan.description}</p>

                  <ul className="space-y-3 mb-8 flex-1">
                    {Object.values(plan.features).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm text-gray-700">
                        <Check size={16} className="text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {plan.ctaLink ? (
                    <Link
                      to={plan.ctaLink}
                      className={`block text-center py-3 px-6 rounded-lg text-sm font-semibold text-white ${colors.btn} transition`}
                    >
                      {plan.cta}
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="block w-full py-3 px-6 rounded-lg text-sm font-semibold text-gray-400 bg-gray-100 cursor-not-allowed"
                    >
                      {plan.cta}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Feature Comparison</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: 'var(--shadow-xs)' }}>
              {/* Table header */}
              <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-200 py-3 px-4">
                <div className="text-xs font-semibold text-gray-500 uppercase">Feature</div>
                <div className="text-xs font-semibold text-amber-600 uppercase text-center">Trial</div>
                <div className="text-xs font-semibold text-blue-600 uppercase text-center">Starter</div>
                <div className="text-xs font-semibold text-purple-600 uppercase text-center">Pro</div>
              </div>
              {/* Rows */}
              {comparisonFeatures.map((row, i) => (
                <div
                  key={row.name}
                  className={`grid grid-cols-4 py-3 px-4 ${i < comparisonFeatures.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <div className="text-sm text-gray-700">{row.name}</div>
                  <div className="flex justify-center">
                    {row.trial ? <Check size={16} className="text-green-500" /> : <XIcon size={16} className="text-gray-300" />}
                  </div>
                  <div className="flex justify-center">
                    {row.starter ? <Check size={16} className="text-green-500" /> : <XIcon size={16} className="text-gray-300" />}
                  </div>
                  <div className="flex justify-center">
                    {row.pro ? <Check size={16} className="text-green-500" /> : <XIcon size={16} className="text-gray-300" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing FAQ */}
        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Pricing Questions</h2>
            <div className="space-y-4">
              <FaqItem
                q="What happens after my 30-day trial?"
                a="Your data is preserved, but access is paused until you upgrade. We'll send reminders before your trial ends so you have time to decide."
              />
              <FaqItem
                q="Can I change plans later?"
                a="Absolutely. You can upgrade or downgrade at any time. Changes take effect immediately, and billing is prorated."
              />
              <FaqItem
                q="Is there a setup fee?"
                a="No. All plans include free setup, onboarding, and data migration assistance. You only pay the monthly subscription."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4" style={{ backgroundColor: '#1c1917' }}>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
              Ready to Streamline Your Lodge Operations?
            </h2>
            <p className="text-gray-400 mb-8">
              30-day free trial. No credit card. Full access to every feature.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition"
            >
              Get Started Free <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

function FaqItem({ q, a }) {
  return (
    <div className="bg-gray-50 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{q}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
    </div>
  )
}
