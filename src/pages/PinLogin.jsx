import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { auth, users as usersApi } from '../services/api'
import { Delete, Loader2, ChevronDown } from 'lucide-react'

export default function PinLogin() {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [step, setStep] = useState('username') // 'username' | 'pin'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [staffList, setStaffList] = useState([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const navigate = useNavigate()
  const { dispatch } = useApp()

  // Load staff list for dropdown
  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await usersApi.list()
        // Filter only active users with PIN enabled
        const pinUsers = (res.users || []).filter(u => u.is_active && u.pin_enabled)
        setStaffList(pinUsers)
      } catch (err) {
        console.error('Failed to load staff:', err)
        // If API fails, still allow manual entry
      } finally {
        setLoadingStaff(false)
      }
    }
    loadStaff()
  }, [])

  function handlePinDigit(digit) {
    if (pin.length < 4) {
      const newPin = pin + digit
      setPin(newPin)
      if (newPin.length === 4) {
        submitPin(newPin)
      }
    }
  }

  function handlePinDelete() {
    setPin(pin.slice(0, -1))
  }

  async function submitPin(pinValue) {
    setError('')
    setLoading(true)

    try {
      const data = await auth.pinLogin(username, pinValue)
      localStorage.setItem('kcl_token', data.token)
      dispatch({
        type: 'LOGIN',
        payload: { user: data.user, camps: data.camps }
      })
      navigate('/app')
    } catch (err) {
      setError(err.message)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  function handleUsernameSubmit(e) {
    e.preventDefault()
    if (username.trim()) {
      setStep('pin')
      setError('')
    }
  }

  // Find display name for selected username
  const selectedUser = staffList.find(u => u.username === username)

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">KC</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">KCL Stores</h1>
          <p className="text-gray-500 mt-1">Camp Staff Login</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
              {error}
            </div>
          )}

          {step === 'username' ? (
            <form onSubmit={handleUsernameSubmit}>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Staff Member</label>
              {loadingStaff ? (
                <div className="flex items-center justify-center py-4 text-gray-400 gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Loading staff...</span>
                </div>
              ) : staffList.length > 0 ? (
                <div className="relative">
                  <select
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none bg-white"
                    required
                  >
                    <option value="">— Pick your name —</option>
                    {staffList.map(u => (
                      <option key={u.id} value={u.username}>
                        {u.name} ({u.camp_code || 'HO'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              ) : (
                /* Fallback if no staff list available — simple text input */
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  placeholder="Enter username"
                  autoFocus
                  required
                />
              )}
              <button
                type="submit"
                disabled={!username}
                className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium py-4 rounded-xl transition text-lg"
              >
                Next
              </button>
            </form>
          ) : (
            <>
              <div className="text-center mb-6">
                <p className="text-gray-500 text-sm">Logging in as</p>
                <p className="font-semibold text-gray-900">{selectedUser?.name || username}</p>
                {selectedUser?.camp_code && (
                  <p className="text-xs text-gray-400">{selectedUser.camp_code}</p>
                )}
                <button
                  onClick={() => { setStep('username'); setPin(''); setError('') }}
                  className="text-green-600 text-sm mt-1"
                >
                  Change
                </button>
              </div>

              <p className="text-center text-sm text-gray-600 mb-4">Enter 4-digit PIN</p>

              {/* PIN dots */}
              <div className="flex justify-center gap-4 mb-8">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition ${
                      i < pin.length ? 'bg-green-600 scale-110' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>

              {loading && (
                <div className="flex justify-center mb-4">
                  <Loader2 size={24} className="animate-spin text-green-600" />
                </div>
              )}

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <button
                    key={n}
                    onClick={() => handlePinDigit(String(n))}
                    disabled={loading}
                    className="h-16 text-2xl font-medium text-gray-800 bg-gray-50 hover:bg-gray-100 active:bg-green-50 rounded-xl transition disabled:opacity-50"
                  >
                    {n}
                  </button>
                ))}
                <div /> {/* Empty cell */}
                <button
                  onClick={() => handlePinDigit('0')}
                  disabled={loading}
                  className="h-16 text-2xl font-medium text-gray-800 bg-gray-50 hover:bg-gray-100 active:bg-green-50 rounded-xl transition disabled:opacity-50"
                >
                  0
                </button>
                <button
                  onClick={handlePinDelete}
                  disabled={loading}
                  className="h-16 flex items-center justify-center text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition disabled:opacity-50"
                >
                  <Delete size={24} />
                </button>
              </div>
            </>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-green-600 hover:text-green-700 text-sm font-medium"
            >
              ← Manager Login (Password)
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
