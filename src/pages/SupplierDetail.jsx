import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useUser, isManager } from '../context/AppContext'
import { suppliers as suppliersApi } from '../services/api'
import { useToast } from '../components/ui/Toast'
import {
  ArrowLeft, Building2, Edit3, Save, X, Loader2,
  Package, Phone, Mail, MapPin, CreditCard
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function SupplierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useUser()
  const toast = useToast()
  const canEdit = isManager(user?.role)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})
  const [activeTab, setActiveTab] = useState('info')

  useEffect(() => { loadSupplier() }, [id])

  async function loadSupplier() {
    setLoading(true)
    try {
      const result = await suppliersApi.get(id)
      setData(result)
      setForm({ ...result.supplier })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.name?.trim()) return toast.error('Supplier name is required')
    setSaving(true)
    try {
      await suppliersApi.update(id, {
        name: form.name,
        contact: form.contact,
        email: form.email,
        phone: form.phone,
        address: form.address,
        city: form.city,
        country: form.country,
        tax_id: form.tax_id,
        payment_terms: parseInt(form.payment_terms) || 30,
        credit_limit: parseFloat(form.credit_limit) || 0,
        bank_name: form.bank_name,
        bank_account: form.bank_account,
        notes: form.notes,
      })
      toast.success('Supplier updated')
      setEditing(false)
      loadSupplier()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!confirm('Are you sure you want to deactivate this supplier?')) return
    try {
      await suppliersApi.deactivate(id)
      toast.success('Supplier deactivated')
      navigate('/app/suppliers')
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) return <LoadingSpinner message="Loading supplier..." />
  if (error) return (
    <div className="text-center py-16">
      <p className="text-red-600 mb-4">{error}</p>
      <Link to="/app/suppliers" className="text-green-600 font-medium">Back to Suppliers</Link>
    </div>
  )
  if (!data) return null

  const supplier = data.supplier

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app/suppliers" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-mono text-gray-400">{supplier.supplier_code}</span>
            <Badge variant={supplier.is_active ? 'ok' : 'out'}>
              {supplier.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <h1 className="text-xl font-bold text-gray-900 truncate">{supplier.name}</h1>
        </div>
        {canEdit && !editing && (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">
              <Edit3 size={16} /> Edit
            </button>
            {supplier.is_active && (
              <button onClick={handleDeactivate}
                className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition">
                Deactivate
              </button>
            )}
          </div>
        )}
        {editing && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditing(false); setForm({ ...supplier }) }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">
              <X size={16} /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {['info', 'items'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab === 'info' ? 'Details' : `Items (${data.items?.length || 0})`}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Contact Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 size={18} /> Contact Information
            </h2>
            <div className="space-y-4">
              <EditableRow icon={Phone} label="Contact Person" field="contact" value={form.contact} editing={editing} onChange={handleChange} />
              <EditableRow icon={Mail} label="Email" field="email" value={form.email} editing={editing} onChange={handleChange} type="email" />
              <EditableRow icon={Phone} label="Phone" field="phone" value={form.phone} editing={editing} onChange={handleChange} type="tel" />
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin size={18} /> Address
            </h2>
            <div className="space-y-4">
              <EditableRow label="Address" field="address" value={form.address} editing={editing} onChange={handleChange} textarea />
              <EditableRow label="City" field="city" value={form.city} editing={editing} onChange={handleChange} />
              <EditableRow label="Country" field="country" value={form.country} editing={editing} onChange={handleChange} />
            </div>
          </div>

          {/* Financial */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard size={18} /> Financial
            </h2>
            <div className="space-y-4">
              <EditableRow label="Tax ID / KRA PIN" field="tax_id" value={form.tax_id} editing={editing} onChange={handleChange} />
              <EditableRow label="Payment Terms (days)" field="payment_terms" value={form.payment_terms} editing={editing} onChange={handleChange} type="number" />
              <EditableRow label="Credit Limit" field="credit_limit" value={form.credit_limit} editing={editing} onChange={handleChange} type="number" />
              <EditableRow label="Bank Name" field="bank_name" value={form.bank_name} editing={editing} onChange={handleChange} />
              <EditableRow label="Bank Account" field="bank_account" value={form.bank_account} editing={editing} onChange={handleChange} />
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Notes</h2>
            {editing ? (
              <textarea value={form.notes || ''} onChange={e => handleChange('notes', e.target.value)}
                className="input-field" rows={4} placeholder="Add notes..." />
            ) : (
              <p className="text-sm text-gray-600">{supplier.notes || 'No notes'}</p>
            )}
            <p className="text-xs text-gray-400 mt-3">
              Created: {supplier.created_at ? new Date(supplier.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'items' && (
        <div className="bg-white rounded-xl border border-gray-200">
          {(!data.items || data.items.length === 0) ? (
            <div className="text-center py-12">
              <Package size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No items linked to this supplier</p>
              <p className="text-xs text-gray-400 mt-1">Link items from the item detail page</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Item Code</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Item Name</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Group</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">UOM</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Unit Price</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Lead Time</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Preferred</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(item => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <Link to={`/app/items/${item.item_id}`} className="text-sm font-mono text-green-600 hover:text-green-700">
                          {item.item_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900">{item.item_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500">{item.group_code || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500">{item.uom || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-900">
                          {item.unit_price ? `TZS ${Math.round(item.unit_price).toLocaleString()}` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-500">
                          {item.lead_time_days ? `${item.lead_time_days}d` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.is_preferred && <span className="text-green-600 text-lg">★</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EditableRow({ icon: Icon, label, field, value, editing, onChange, type = 'text', textarea }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
        {Icon && <Icon size={12} />}
        {label}
      </p>
      {editing ? (
        textarea ? (
          <textarea value={value || ''} onChange={e => onChange(field, e.target.value)}
            className="input-field" rows={2} />
        ) : (
          <input type={type} value={value || ''} onChange={e => onChange(field, e.target.value)}
            className="input-field" />
        )
      ) : (
        <p className="text-sm text-gray-700">{value || '—'}</p>
      )}
    </div>
  )
}
