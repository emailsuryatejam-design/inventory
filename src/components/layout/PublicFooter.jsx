import { Link } from 'react-router-dom'

/**
 * Shared footer for public pages (Landing, Pricing, Register).
 * 3-column layout with navigation + credit line.
 */
export default function PublicFooter() {
  return (
    <footer className="bg-white border-t border-gray-200" aria-label="Site footer">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">WS</span>
              </div>
              <span className="font-semibold text-gray-900">WebSquare</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              Inventory management built for safari lodges, camps, and hospitality.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Product</h3>
            <ul className="space-y-2">
              <li><FooterScrollLink id="features" label="Features" /></li>
              <li><Link to="/pricing" className="text-sm text-gray-600 hover:text-amber-600 transition">Pricing</Link></li>
              <li><FooterScrollLink id="how-it-works" label="How It Works" /></li>
              <li><FooterScrollLink id="built-for-bush" label="Offline-First" /></li>
            </ul>
          </div>

          {/* Get Started */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Get Started</h3>
            <ul className="space-y-2">
              <li><Link to="/register" className="text-sm text-gray-600 hover:text-amber-600 transition">Free Trial</Link></li>
              <li><Link to="/login" className="text-sm text-gray-600 hover:text-amber-600 transition">Sign In</Link></li>
              <li><Link to="/pin-login" className="text-sm text-gray-600 hover:text-amber-600 transition">Camp Staff Login</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Company</h3>
            <ul className="space-y-2">
              <li><Link to="/global-admin" className="text-sm text-gray-600 hover:text-amber-600 transition">Admin</Link></li>
              <li>
                <a href="mailto:hello@websquare.io" className="text-sm text-gray-600 hover:text-amber-600 transition">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} WebSquare. All rights reserved.</p>
          <p className="text-xs text-gray-400">
            Powered by{' '}
            <a href="https://vyoma.ai" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-600 font-medium">
              Vyoma AI Studios
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}

/** Scroll-to-section link (HashRouter compatible) */
function FooterScrollLink({ id, label }) {
  function handleClick(e) {
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    } else {
      // Navigate to landing first
      window.location.hash = '#/'
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      }, 400)
    }
  }

  return (
    <a href={`/#${id}`} onClick={handleClick} className="text-sm text-gray-600 hover:text-amber-600 transition cursor-pointer">
      {label}
    </a>
  )
}
