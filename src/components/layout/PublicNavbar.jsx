import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

/**
 * Shared navbar for public pages (Landing, Pricing, Register).
 * Sticky, backdrop-blur, responsive with mobile hamburger.
 */
export default function PublicNavbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  function scrollTo(id) {
    setOpen(false)
    // If we're on the landing page, scroll directly
    if (location.pathname === '/') {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    // Otherwise navigate to landing then scroll
    navigate('/')
    setTimeout(() => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }, 300)
  }

  const navLinks = [
    { label: 'Features', action: () => scrollTo('features') },
    { label: 'Pricing', to: '/pricing' },
    { label: 'FAQ', action: () => scrollTo('faq') },
  ]

  return (
    <header>
      <nav
        className="sticky top-0 bg-white/95 backdrop-blur-sm z-50"
        style={{ borderBottom: '1px solid #e2e8f0' }}
        aria-label="Main navigation"
      >
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5" aria-label="WebSquare home">
            <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">WS</span>
            </div>
            <div>
              <span className="font-semibold text-gray-900">WebSquare</span>
              <span className="hidden sm:inline text-xs text-gray-400 ml-1.5">for Safari & Lodges</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              link.to ? (
                <Link
                  key={link.label}
                  to={link.to}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition"
                >
                  {link.label}
                </Link>
              ) : (
                <button
                  key={link.label}
                  onClick={link.action}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition bg-transparent border-none cursor-pointer"
                >
                  {link.label}
                </button>
              )
            ))}
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-5 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-4 pt-2">
            {navLinks.map(link => (
              link.to ? (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="block py-2.5 text-sm font-medium text-gray-700 hover:text-amber-600 transition"
                >
                  {link.label}
                </Link>
              ) : (
                <button
                  key={link.label}
                  onClick={link.action}
                  className="block w-full text-left py-2.5 text-sm font-medium text-gray-700 hover:text-amber-600 transition bg-transparent border-none cursor-pointer"
                >
                  {link.label}
                </button>
              )
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="block py-2.5 text-center text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setOpen(false)}
                className="block py-2.5 text-center text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
