import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { auth } from '../services/api'
import { precacheCriticalData } from '../services/offlineDb'
import { LogIn, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { dispatch } = useApp()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await auth.login(username, password)
      localStorage.setItem('ws_token', data.token)
      dispatch({
        type: 'LOGIN',
        payload: {
          user: data.user,
          camps: data.camps,
          modules: data.modules || [],
          permissions: data.permissions || {},
          tenant: data.tenant || null,
        }
      })
      navigate('/app')
      // Pre-cache critical data for offline use (fire-and-forget)
      precacheCriticalData()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl mb-4">
              <span className="text-white text-2xl font-bold">WS</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">WebSquare</h1>
          <p className="text-gray-500 mt-1">Inventory Management</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Manager Login</h2>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                placeholder="Enter username"
                autoComplete="username"
                required
                data-guide="login-username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition pr-12"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  data-guide="login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            data-guide="login-submit"
            className="w-full mt-6 bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <LogIn size={20} />
            )}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="mt-6 text-center space-y-2">
            <Link
              to="/pin-login"
              className="text-amber-600 hover:text-amber-700 text-sm font-medium block"
            >
              Camp Staff? Login with PIN
            </Link>
          </div>
        </form>

        {/* Trial Promotion */}
        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-gray-900 mb-1">No account yet?</p>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            Start your 30-day free trial with full access.<br />
            No credit card required.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition"
          >
            Create Free Account <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
