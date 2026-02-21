import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { suppliers as suppliersApi } from '../services/api'
import { useToast } from '../components/ui/Toast'
import { ArrowLeft, Loader2, Save } from 'lucide-react'

export default function SupplierNew() {
  const navigate = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    contact: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Kenya',
    tax_id: '',
    payment_terms: '30',
    credit_limit: '',
    bank_name: '',
    bank_account: '',
    notes: '',
  })

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Supplier name is required')

    setSaving(true)
    try {
      const result = await suppliersApi.create({
        ...form,
        payment_terms: parseInt(form.payment_terms) || 30,
        credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : 0,
      })
      toast.success(`Supplier ${result.supplier.supplier_code} created`)
      navigate(`/app/suppliers/${result.supplier.id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/app/suppliers')} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Supplier</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <Section title="Basic Information">
          <Field label="Supplier Name *" full>
            <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)}
              className="input-field" placeholder="Enter supplier name" autoFocus />
          </Field>
          <Field label="Contact Person">
            <input type="text" value={form.contact} onChange={e => handleChange('contact', e.target.value)}
              className="input-field" placeholder="Primary contact name" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)}
              className="input-field" placeholder="email@example.com" />
          </Field>
          <Field label="Phone">
            <input type="tel" value={form.phone} onChange={e => handleChange('phone', e.target.value)}
              className="input-field" placeholder="+254 xxx xxx xxx" />
          </Field>
        </Section>

        {/* Address */}
        <Section title="Address">
          <Field label="Address" full>
            <textarea value={form.address} onChange={e => handleChange('address', e.target.value)}
              className="input-field" rows={2} placeholder="Street address" />
          </Field>
          <Field label="City">
            <input type="text" value={form.city} onChange={e => handleChange('city', e.target.value)}
              className="input-field" placeholder="City" />
          </Field>
          <Field label="Country">
            <input type="text" value={form.country} onChange={e => handleChange('country', e.target.value)}
              className="input-field" placeholder="Country" />
          </Field>
        </Section>

        {/* Financial */}
        <Section title="Financial">
          <Field label="Tax ID / KRA PIN">
            <input type="text" value={form.tax_id} onChange={e => handleChange('tax_id', e.target.value)}
              className="input-field" placeholder="Tax identification number" />
          </Field>
          <Field label="Payment Terms (days)">
            <input type="number" value={form.payment_terms} onChange={e => handleChange('payment_terms', e.target.value)}
              className="input-field" placeholder="30" />
          </Field>
          <Field label="Credit Limit">
            <input type="number" step="0.01" value={form.credit_limit} onChange={e => handleChange('credit_limit', e.target.value)}
              className="input-field" placeholder="0.00" />
          </Field>
        </Section>

        {/* Banking */}
        <Section title="Banking Details">
          <Field label="Bank Name">
            <input type="text" value={form.bank_name} onChange={e => handleChange('bank_name', e.target.value)}
              className="input-field" placeholder="Bank name" />
          </Field>
          <Field label="Bank Account">
            <input type="text" value={form.bank_account} onChange={e => handleChange('bank_account', e.target.value)}
              className="input-field" placeholder="Account number" />
          </Field>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <Field label="Notes" full>
            <textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)}
              className="input-field" rows={3} placeholder="Additional notes about this supplier..." />
          </Field>
        </Section>

        {/* Submit */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 -mx-4 mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate('/app/suppliers')}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Creating...' : 'Create Supplier'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  )
}

function Field({ label, children, full }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
