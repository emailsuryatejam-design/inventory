import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  hrEmployees as hrEmployeesApi,
  employeeAllowances as employeeAllowancesApi,
  allowanceTypes as allowanceTypesApi,
  departments as departmentsApi,
  jobGrades as jobGradesApi,
} from '../services/api'
import { useUser, isManager } from '../context/AppContext'
import { ArrowLeft, Pencil, Save, X, Plus, Trash2 } from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'allowances', label: 'Allowances' },
  { key: 'leave', label: 'Leave' },
  { key: 'documents', label: 'Documents' },
]

const STATUS_BADGE = {
  active: 'ok',
  suspended: 'low',
  terminated: 'out',
  resigned: 'out',
  probation: 'pending',
}

const EMPLOYMENT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'casual', label: 'Casual' },
  { value: 'intern', label: 'Intern' },
]

const EMPLOYMENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'resigned', label: 'Resigned' },
  { value: 'probation', label: 'Probation' },
]

const GENDER_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

export default function HREmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useUser()
  const canManage = isManager(user?.role)

  const [employee, setEmployee] = useState(null)
  const [allowances, setAllowances] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [departments, setDepartments] = useState([])
  const [jobGrades, setJobGrades] = useState([])

  // Allowance modal
  const [showAllowanceModal, setShowAllowanceModal] = useState(false)
  const [editingAllowance, setEditingAllowance] = useState(null)
  const [allowanceForm, setAllowanceForm] = useState({ allowance_type_id: '', amount: '', effective_from: '', effective_to: '' })
  const [allowanceTypes, setAllowanceTypes] = useState([])
  const [savingAllowance, setSavingAllowance] = useState(false)

  useEffect(() => { loadEmployee() }, [id])

  async function loadEmployee() {
    setLoading(true)
    setError('')
    try {
      const result = await hrEmployeesApi.get(id)
      setEmployee(result.employee)
      setAllowances(result.allowances || [])
      setLeaveRequests(result.leave_requests || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function startEditing() {
    setEditing(true)
    setEditForm({ ...employee })
    try {
      const [deptRes, gradeRes] = await Promise.all([
        departmentsApi.list(),
        jobGradesApi.list(),
      ])
      setDepartments(deptRes.departments || [])
      setJobGrades(gradeRes.job_grades || [])
    } catch (err) {
      setError(err.message)
    }
  }

  function cancelEditing() {
    setEditing(false)
    setEditForm({})
  }

  function updateEditForm(field, value) {
    setEditForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { ...editForm }
      // Convert numeric fields
      if (payload.department_id) payload.department_id = Number(payload.department_id)
      if (payload.job_grade_id) payload.job_grade_id = Number(payload.job_grade_id)
      if (payload.basic_salary) payload.basic_salary = Number(payload.basic_salary)
      // Clean nulls
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') payload[key] = null
      })
      await hrEmployeesApi.update(id, payload)
      setEditing(false)
      loadEmployee()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Allowances ──

  async function openAllowanceCreate() {
    setEditingAllowance(null)
    setAllowanceForm({ allowance_type_id: '', amount: '', effective_from: '', effective_to: '' })
    setShowAllowanceModal(true)
    try {
      const res = await allowanceTypesApi.list()
      setAllowanceTypes(res.allowance_types || [])
    } catch (err) {
      setError(err.message)
    }
  }

  async function openAllowanceEdit(allowance) {
    setEditingAllowance(allowance)
    setAllowanceForm({
      allowance_type_id: String(allowance.allowance_type_id),
      amount: String(allowance.amount),
      effective_from: allowance.effective_from || '',
      effective_to: allowance.effective_to || '',
    })
    setShowAllowanceModal(true)
    try {
      const res = await allowanceTypesApi.list()
      setAllowanceTypes(res.allowance_types || [])
    } catch (err) {
      setError(err.message)
    }
  }

  function closeAllowanceModal() {
    setShowAllowanceModal(false)
    setEditingAllowance(null)
  }

  async function handleAllowanceSubmit(e) {
    e.preventDefault()
    setSavingAllowance(true)
    setError('')
    try {
      const payload = {
        employee_id: Number(id),
        allowance_type_id: Number(allowanceForm.allowance_type_id),
        amount: Number(allowanceForm.amount),
        effective_from: allowanceForm.effective_from || null,
        effective_to: allowanceForm.effective_to || null,
      }
      if (editingAllowance) {
        await employeeAllowancesApi.update(editingAllowance.id, payload)
      } else {
        await employeeAllowancesApi.create(payload)
      }
      closeAllowanceModal()
      loadEmployee()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingAllowance(false)
    }
  }

  async function handleDeleteAllowance(allowance) {
    if (!confirm(`Remove allowance "${allowance.allowance_type_name}"?`)) return
    try {
      await employeeAllowancesApi.remove(allowance.id)
      loadEmployee()
    } catch (err) {
      setError(err.message)
    }
  }

  // ── Render helpers ──

  function InfoRow({ label, value }) {
    return (
      <div className="flex justify-between py-2 border-b border-gray-50">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-sm text-gray-900 font-medium">{value || '--'}</span>
      </div>
    )
  }

  if (loading) return <LoadingSpinner message="Loading employee..." />

  if (error && !employee) {
    return (
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
        {error}
        <button onClick={loadEmployee} className="ml-2 underline">Retry</button>
      </div>
    )
  }

  if (!employee) return null

  const fullName = `${employee.first_name} ${employee.last_name}`
  const initial = (employee.first_name?.[0] || '?').toUpperCase()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/app/hr-employees')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <span className="text-lg font-bold text-green-700">{initial}</span>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-mono text-gray-400">{employee.employee_no}</span>
            <Badge variant={STATUS_BADGE[employee.employment_status] || 'pending'}>
              {employee.employment_status || 'Unknown'}
            </Badge>
          </div>
        </div>
        {canManage && !editing && (
          <button
            onClick={startEditing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Pencil size={14} />
            Edit
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && !editing && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Personal */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Personal Information</h3>
            <InfoRow label="Full Name" value={fullName} />
            <InfoRow label="Email" value={employee.email} />
            <InfoRow label="Phone" value={employee.phone} />
            <InfoRow label="Date of Birth" value={employee.date_of_birth} />
            <InfoRow label="Gender" value={employee.gender} />
            <InfoRow label="National ID" value={employee.national_id} />
          </div>

          {/* Employment */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Employment</h3>
            <InfoRow label="Employee No" value={employee.employee_no} />
            <InfoRow label="Department" value={employee.department_name} />
            <InfoRow label="Job Grade" value={employee.job_grade_name} />
            <InfoRow label="Job Title" value={employee.job_title} />
            <InfoRow label="Employment Type" value={employee.employment_type} />
            <InfoRow label="Employment Status" value={employee.employment_status} />
            <InfoRow label="Hire Date" value={employee.hire_date} />
            <InfoRow label="Termination Date" value={employee.termination_date} />
            <InfoRow label="Region" value={employee.region_name} />
            <InfoRow label="Shift" value={employee.shift_name} />
          </div>

          {/* Compensation */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Compensation</h3>
            <InfoRow label="Basic Salary" value={employee.basic_salary != null ? employee.basic_salary.toLocaleString() : null} />
            <InfoRow label="Bank Name" value={employee.bank_name} />
            <InfoRow label="Bank Branch" value={employee.bank_branch} />
            <InfoRow label="Bank Account" value={employee.bank_account} />
          </div>

          {/* Statutory */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Statutory</h3>
            <InfoRow label="Tax PIN" value={employee.tax_pin} />
            <InfoRow label="NSSF No" value={employee.nssf_no} />
            <InfoRow label="NHIF No" value={employee.nhif_no} />
          </div>
        </div>
      )}

      {/* ── Overview Edit Mode ── */}
      {activeTab === 'overview' && editing && (
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {/* Personal */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">First Name</label>
                <input value={editForm.first_name || ''} onChange={e => updateEditForm('first_name', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Last Name</label>
                <input value={editForm.last_name || ''} onChange={e => updateEditForm('last_name', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                <input type="email" value={editForm.email || ''} onChange={e => updateEditForm('email', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Phone</label>
                <input value={editForm.phone || ''} onChange={e => updateEditForm('phone', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Date of Birth</label>
                <input type="date" value={editForm.date_of_birth || ''} onChange={e => updateEditForm('date_of_birth', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Gender</label>
                <select value={editForm.gender || ''} onChange={e => updateEditForm('gender', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                  {GENDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">National ID</label>
                <input value={editForm.national_id || ''} onChange={e => updateEditForm('national_id', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
            </div>
          </div>

          {/* Employment */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Employment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Department</label>
                <select value={editForm.department_id || ''} onChange={e => updateEditForm('department_id', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                  <option value="">Select...</option>
                  {departments.filter(d => d.is_active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Job Grade</label>
                <select value={editForm.job_grade_id || ''} onChange={e => updateEditForm('job_grade_id', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                  <option value="">Select...</option>
                  {jobGrades.map(g => <option key={g.id} value={g.id}>{g.name} (Level {g.level})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Job Title</label>
                <input value={editForm.job_title || ''} onChange={e => updateEditForm('job_title', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Employment Type</label>
                <select value={editForm.employment_type || ''} onChange={e => updateEditForm('employment_type', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                  {EMPLOYMENT_TYPES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Employment Status</label>
                <select value={editForm.employment_status || ''} onChange={e => updateEditForm('employment_status', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                  {EMPLOYMENT_STATUSES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Hire Date</label>
                <input type="date" value={editForm.hire_date || ''} onChange={e => updateEditForm('hire_date', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Termination Date</label>
                <input type="date" value={editForm.termination_date || ''} onChange={e => updateEditForm('termination_date', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
            </div>
          </div>

          {/* Compensation */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Compensation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Basic Salary</label>
                <input type="number" value={editForm.basic_salary || ''} onChange={e => updateEditForm('basic_salary', e.target.value)} min="0" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Bank Name</label>
                <input value={editForm.bank_name || ''} onChange={e => updateEditForm('bank_name', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Bank Branch</label>
                <input value={editForm.bank_branch || ''} onChange={e => updateEditForm('bank_branch', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Bank Account</label>
                <input value={editForm.bank_account || ''} onChange={e => updateEditForm('bank_account', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
            </div>
          </div>

          {/* Statutory */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Statutory</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Tax PIN</label>
                <input value={editForm.tax_pin || ''} onChange={e => updateEditForm('tax_pin', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">NSSF No</label>
                <input value={editForm.nssf_no || ''} onChange={e => updateEditForm('nssf_no', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">NHIF No</label>
                <input value={editForm.nhif_no || ''} onChange={e => updateEditForm('nhif_no', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
              </div>
            </div>
          </div>

          {/* Edit Actions */}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={cancelEditing} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
              <X size={14} /> Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* ── Allowances Tab ── */}
      {activeTab === 'allowances' && (
        <div>
          {canManage && (
            <div className="flex justify-end mb-4">
              <button
                onClick={openAllowanceCreate}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
              >
                <Plus size={14} />
                Add Allowance
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200">
            {allowances.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">No allowances assigned</div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Allowance</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Code</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Amount</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Taxable</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">From</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">To</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                        {canManage && <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {allowances.map(a => (
                        <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.allowance_type_name}</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-500">{a.allowance_type_code}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{a.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={a.is_taxable ? 'low' : 'ok'}>
                              {a.is_taxable ? 'Yes' : 'No'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{a.effective_from || '--'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{a.effective_to || '--'}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={a.is_active ? 'ok' : 'out'}>
                              {a.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => openAllowanceEdit(a)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => handleDeleteAllowance(a)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="lg:hidden divide-y divide-gray-100">
                  {allowances.map(a => (
                    <div key={a.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{a.allowance_type_name}</span>
                        <Badge variant={a.is_active ? 'ok' : 'out'}>{a.is_active ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-mono">{a.allowance_type_code}</span>
                        <span>|</span>
                        <span className="font-medium">{a.amount.toLocaleString()}</span>
                        {a.is_taxable && <Badge variant="low">Taxable</Badge>}
                      </div>
                      {canManage && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => openAllowanceEdit(a)} className="text-xs text-blue-600 hover:underline">Edit</button>
                          <button onClick={() => handleDeleteAllowance(a)} className="text-xs text-red-600 hover:underline">Remove</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Allowance Modal */}
          {showAllowanceModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl w-full max-w-md">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {editingAllowance ? 'Edit Allowance' : 'Add Allowance'}
                  </h2>
                  <button onClick={closeAllowanceModal} className="p-1 text-gray-400 hover:text-gray-600">
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleAllowanceSubmit} className="p-4 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Allowance Type</label>
                    <select
                      value={allowanceForm.allowance_type_id}
                      onChange={e => setAllowanceForm({ ...allowanceForm, allowance_type_id: e.target.value })}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    >
                      <option value="">Select type...</option>
                      {allowanceTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Amount</label>
                    <input
                      type="number"
                      value={allowanceForm.amount}
                      onChange={e => setAllowanceForm({ ...allowanceForm, amount: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Effective From</label>
                      <input
                        type="date"
                        value={allowanceForm.effective_from}
                        onChange={e => setAllowanceForm({ ...allowanceForm, effective_from: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Effective To</label>
                      <input
                        type="date"
                        value={allowanceForm.effective_to}
                        onChange={e => setAllowanceForm({ ...allowanceForm, effective_to: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={closeAllowanceModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
                      Cancel
                    </button>
                    <button type="submit" disabled={savingAllowance} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
                      {savingAllowance ? 'Saving...' : editingAllowance ? 'Update' : 'Add'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Leave Tab ── */}
      {activeTab === 'leave' && (
        <div className="bg-white rounded-xl border border-gray-200">
          {leaveRequests.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">No leave requests found</div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Leave Type</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Start</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">End</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Days</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Reason</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.map(lr => (
                      <tr key={lr.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{lr.leave_type_name || '--'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{lr.start_date}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{lr.end_date}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{lr.days}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{lr.reason || '--'}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={lr.status === 'approved' ? 'ok' : lr.status === 'rejected' ? 'out' : 'pending'}>
                            {lr.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="lg:hidden divide-y divide-gray-100">
                {leaveRequests.map(lr => (
                  <div key={lr.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{lr.leave_type_name || 'Leave'}</span>
                      <Badge variant={lr.status === 'approved' ? 'ok' : lr.status === 'rejected' ? 'out' : 'pending'}>
                        {lr.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500">
                      {lr.start_date} - {lr.end_date} ({lr.days} days)
                    </div>
                    {lr.reason && <p className="text-xs text-gray-400 mt-1 truncate">{lr.reason}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Documents Tab ── */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">Coming soon</p>
          <p className="text-xs text-gray-400 mt-1">Document management will be available in a future update</p>
        </div>
      )}
    </div>
  )
}
