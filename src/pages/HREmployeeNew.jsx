import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hrEmployees as hrEmployeesApi, departments as departmentsApi, jobGrades as jobGradesApi } from '../services/api'
import { ArrowLeft, Save } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const EMPLOYMENT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'casual', label: 'Casual' },
  { value: 'intern', label: 'Intern' },
]

const GENDER_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

export default function HREmployeeNew() {
  const navigate = useNavigate()
  const [departments, setDepartments] = useState([])
  const [jobGrades, setJobGrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    // Personal
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    national_id: '',
    // Employment
    employee_no: '',
    department_id: '',
    job_grade_id: '',
    job_title: '',
    employment_type: 'permanent',
    hire_date: '',
    // Compensation
    basic_salary: '',
    bank_name: '',
    bank_branch: '',
    bank_account: '',
    // Statutory
    tax_pin: '',
    nssf_no: '',
    nhif_no: '',
  })

  useEffect(() => {
    loadDropdowns()
  }, [])

  async function loadDropdowns() {
    setLoading(true)
    try {
      const [deptRes, gradeRes] = await Promise.all([
        departmentsApi.list(),
        jobGradesApi.list(),
      ])
      setDepartments(deptRes.departments || [])
      setJobGrades(gradeRes.job_grades || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        department_id: form.department_id ? Number(form.department_id) : null,
        job_grade_id: form.job_grade_id ? Number(form.job_grade_id) : null,
        basic_salary: form.basic_salary ? Number(form.basic_salary) : null,
        employee_no: form.employee_no || undefined,
      }
      // Remove empty strings
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') payload[key] = null
      })
      await hrEmployeesApi.create(payload)
      navigate('/app/hr-employees')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner message="Loading form..." />

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
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Employee</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fill in the employee details below</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Personal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">First Name *</label>
              <input
                value={form.first_name}
                onChange={e => updateForm('first_name', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Last Name *</label>
              <input
                value={form.last_name}
                onChange={e => updateForm('last_name', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => updateForm('email', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Phone</label>
              <input
                value={form.phone}
                onChange={e => updateForm('phone', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Date of Birth</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={e => updateForm('date_of_birth', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Gender</label>
              <select
                value={form.gender}
                onChange={e => updateForm('gender', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                {GENDER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">National ID</label>
              <input
                value={form.national_id}
                onChange={e => updateForm('national_id', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Employment */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Employment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Employee No</label>
              <input
                value={form.employee_no}
                onChange={e => updateForm('employee_no', e.target.value)}
                placeholder="Auto-generated if empty"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Department</label>
              <select
                value={form.department_id}
                onChange={e => updateForm('department_id', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">Select department...</option>
                {departments.filter(d => d.is_active).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Job Grade</label>
              <select
                value={form.job_grade_id}
                onChange={e => updateForm('job_grade_id', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">Select job grade...</option>
                {jobGrades.map(g => (
                  <option key={g.id} value={g.id}>{g.name} (Level {g.level})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Job Title</label>
              <input
                value={form.job_title}
                onChange={e => updateForm('job_title', e.target.value)}
                placeholder="e.g. Software Engineer"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Employment Type</label>
              <select
                value={form.employment_type}
                onChange={e => updateForm('employment_type', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                {EMPLOYMENT_TYPES.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Hire Date</label>
              <input
                type="date"
                value={form.hire_date}
                onChange={e => updateForm('hire_date', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Compensation */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Compensation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Basic Salary</label>
              <input
                type="number"
                value={form.basic_salary}
                onChange={e => updateForm('basic_salary', e.target.value)}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Bank Name</label>
              <input
                value={form.bank_name}
                onChange={e => updateForm('bank_name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Bank Branch</label>
              <input
                value={form.bank_branch}
                onChange={e => updateForm('bank_branch', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Bank Account</label>
              <input
                value={form.bank_account}
                onChange={e => updateForm('bank_account', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Statutory */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Statutory</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Tax PIN</label>
              <input
                value={form.tax_pin}
                onChange={e => updateForm('tax_pin', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">NSSF No</label>
              <input
                value={form.nssf_no}
                onChange={e => updateForm('nssf_no', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">NHIF No</label>
              <input
                value={form.nhif_no}
                onChange={e => updateForm('nhif_no', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/hr-employees')}
            className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Creating...' : 'Create Employee'}
          </button>
        </div>
      </form>
    </div>
  )
}
