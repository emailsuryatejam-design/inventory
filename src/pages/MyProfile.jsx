import { useState, useEffect } from 'react'
import { useUser } from '../context/AppContext'
import { selfService as selfServiceApi } from '../services/api'
import { User, Briefcase, Building, CreditCard, Lock, Save, Eye, EyeOff } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

export default function MyProfile() {
  const user = useUser()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Editable personal fields
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({
    phone: '',
    address: '',
    city: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Bank details
  const [bankData, setBankData] = useState({
    bank_name: '',
    bank_code: '',
    branch: '',
    account_number: '',
    account_name: '',
  })
  const [savingBank, setSavingBank] = useState(false)
  const [bankMsg, setBankMsg] = useState('')

  // Change password
  const [pwData, setPwData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    setError('')
    try {
      const result = await selfServiceApi.profile()
      setProfile(result)
      // Pre-fill editable fields
      setEditData({
        phone: result.phone || '',
        address: result.address || '',
        city: result.city || '',
        emergency_contact_name: result.emergency_contact_name || '',
        emergency_contact_phone: result.emergency_contact_phone || '',
      })
      // Pre-fill bank details
      setBankData({
        bank_name: result.bank_name || '',
        bank_code: result.bank_code || '',
        branch: result.bank_branch || result.branch || '',
        account_number: result.account_number || '',
        account_name: result.account_name || '',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    try {
      await selfServiceApi.updateProfile(editData)
      setSaveMsg('Profile updated successfully')
      setEditMode(false)
      loadProfile()
    } catch (err) {
      setSaveMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveBank(e) {
    e.preventDefault()
    setSavingBank(true)
    setBankMsg('')
    try {
      await selfServiceApi.saveBank(bankData)
      setBankMsg('Bank details saved successfully')
      loadProfile()
    } catch (err) {
      setBankMsg(err.message)
    } finally {
      setSavingBank(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (pwData.new_password !== pwData.confirm_password) {
      setPwMsg('Passwords do not match')
      return
    }
    if (pwData.new_password.length < 6) {
      setPwMsg('New password must be at least 6 characters')
      return
    }
    setSavingPw(true)
    setPwMsg('')
    try {
      await selfServiceApi.changePassword({
        current_password: pwData.current_password,
        new_password: pwData.new_password,
      })
      setPwMsg('Password changed successfully')
      setPwData({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      setPwMsg(err.message)
    } finally {
      setSavingPw(false)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function InfoRow({ label, value }) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center py-2">
        <span className="text-sm text-gray-500 sm:w-40 flex-shrink-0">{label}</span>
        <span className="text-sm font-medium text-gray-900 mt-0.5 sm:mt-0">{value || '—'}</span>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4" data-guide="my-profile-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            View and update your personal information
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadProfile} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !profile && <LoadingSpinner message="Loading profile..." />}

      {profile && (
        <div className="space-y-6">
          {/* Personal Info Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <User size={18} className="text-green-600" />
              <h2 className="text-base font-semibold text-gray-900">Personal Information</h2>
            </div>
            <div className="divide-y divide-gray-100">
              <InfoRow label="Full Name" value={profile.full_name || profile.name} />
              <InfoRow label="Employee No" value={profile.employee_number || profile.employee_no} />
              <InfoRow label="Email" value={profile.email} />
              <InfoRow label="Phone" value={profile.phone} />
              <InfoRow label="ID Number" value={profile.id_number} />
              <InfoRow label="Date of Birth" value={formatDate(profile.date_of_birth || profile.dob)} />
              <InfoRow label="Gender" value={profile.gender} />
            </div>
          </div>

          {/* Employment Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase size={18} className="text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">Employment Details</h2>
            </div>
            <div className="divide-y divide-gray-100">
              <InfoRow label="Job Title" value={profile.job_title || profile.position} />
              <InfoRow label="Department" value={profile.department_name || profile.department} />
              <InfoRow label="Join Date" value={formatDate(profile.join_date || profile.date_joined)} />
            </div>
          </div>

          {/* Statutory Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building size={18} className="text-purple-600" />
              <h2 className="text-base font-semibold text-gray-900">Statutory Information</h2>
            </div>
            <div className="divide-y divide-gray-100">
              <InfoRow label="Tax PIN" value={profile.tax_pin || profile.kra_pin} />
              <InfoRow label="NSSF No" value={profile.nssf_number || profile.nssf_no} />
              <InfoRow label="NHIF No" value={profile.nhif_number || profile.nhif_no} />
            </div>
          </div>

          {/* Editable Fields Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6" data-guide="my-profile-edit">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User size={18} className="text-amber-600" />
                <h2 className="text-base font-semibold text-gray-900">Editable Details</h2>
              </div>
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  Edit
                </button>
              )}
            </div>

            {saveMsg && (
              <div className={`px-4 py-2 rounded-lg mb-4 text-sm ${saveMsg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {saveMsg}
              </div>
            )}

            <form onSubmit={handleSaveProfile}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editData.phone}
                    onChange={e => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                    disabled={!editMode}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editData.city}
                    onChange={e => setEditData(prev => ({ ...prev, city: e.target.value }))}
                    disabled={!editMode}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={editData.address}
                    onChange={e => setEditData(prev => ({ ...prev, address: e.target.value }))}
                    disabled={!editMode}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={editData.emergency_contact_name}
                    onChange={e => setEditData(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                    disabled={!editMode}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
                  <input
                    type="text"
                    value={editData.emergency_contact_phone}
                    onChange={e => setEditData(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                    disabled={!editMode}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
              </div>

              {editMode && (
                <div className="flex items-center gap-3 mt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(false)
                      setEditData({
                        phone: profile.phone || '',
                        address: profile.address || '',
                        city: profile.city || '',
                        emergency_contact_name: profile.emergency_contact_name || '',
                        emergency_contact_phone: profile.emergency_contact_phone || '',
                      })
                      setSaveMsg('')
                    }}
                    className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 font-medium transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Bank Details Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={18} className="text-indigo-600" />
              <h2 className="text-base font-semibold text-gray-900">Bank Details</h2>
            </div>

            {bankMsg && (
              <div className={`px-4 py-2 rounded-lg mb-4 text-sm ${bankMsg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {bankMsg}
              </div>
            )}

            <form onSubmit={handleSaveBank}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={bankData.bank_name}
                    onChange={e => setBankData(prev => ({ ...prev, bank_name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Code</label>
                  <input
                    type="text"
                    value={bankData.bank_code}
                    onChange={e => setBankData(prev => ({ ...prev, bank_code: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <input
                    type="text"
                    value={bankData.branch}
                    onChange={e => setBankData(prev => ({ ...prev, branch: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={bankData.account_number}
                    onChange={e => setBankData(prev => ({ ...prev, account_number: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                  <input
                    type="text"
                    value={bankData.account_name}
                    onChange={e => setBankData(prev => ({ ...prev, account_name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="submit"
                  disabled={savingBank}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                >
                  <Save size={16} />
                  {savingBank ? 'Saving...' : 'Save Bank Details'}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock size={18} className="text-red-600" />
              <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
            </div>

            {pwMsg && (
              <div className={`px-4 py-2 rounded-lg mb-4 text-sm ${pwMsg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {pwMsg}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      value={pwData.current_password}
                      onChange={e => setPwData(prev => ({ ...prev, current_password: e.target.value }))}
                      required
                      className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={pwData.new_password}
                      onChange={e => setPwData(prev => ({ ...prev, new_password: e.target.value }))}
                      required
                      minLength={6}
                      className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={pwData.confirm_password}
                    onChange={e => setPwData(prev => ({ ...prev, confirm_password: e.target.value }))}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="submit"
                  disabled={savingPw}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                >
                  <Lock size={16} />
                  {savingPw ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
