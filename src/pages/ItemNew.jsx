import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { items as itemsApi, itemGroups as groupsApi, uom as uomApi } from '../services/api'
import { useToast } from '../components/ui/Toast'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function ItemNew() {
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [groups, setGroups] = useState([])
  const [subCategories, setSubCategories] = useState([])
  const [uoms, setUoms] = useState([])
  const [form, setForm] = useState({
    name: '',
    description: '',
    item_group_id: '',
    sub_category_id: '',
    abc_class: 'C',
    storage_type: 'ambient',
    is_perishable: false,
    is_critical: false,
    stock_uom_id: '',
    purchase_uom_id: '',
    issue_uom_id: '',
    purchase_to_stock_factor: '1',
    stock_to_issue_factor: '1',
    last_purchase_price: '',
    min_order_qty: '',
    standard_pack_size: '',
    shelf_life_days: '',
    haccp_category: '',
    storage_temp_min: '',
    storage_temp_max: '',
    allergen_info: '',
    yield_percentage: '',
    sap_item_no: '',
    barcode: '',
    manufacturer: '',
  })

  useEffect(() => {
    loadLookups()
  }, [])

  async function loadLookups() {
    try {
      const [grpData, uomData] = await Promise.all([
        groupsApi.list(),
        uomApi.list(),
      ])
      setGroups(grpData.groups || [])
      setSubCategories(grpData.sub_categories || [])
      setUoms(uomData.uoms || [])
    } catch (err) {
      toast.error('Failed to load form data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Item name is required')
    if (!form.item_group_id) return toast.error('Item group is required')
    if (!form.stock_uom_id) return toast.error('Stock UOM is required')

    setSaving(true)
    try {
      const result = await itemsApi.create({
        ...form,
        item_group_id: parseInt(form.item_group_id),
        sub_category_id: form.sub_category_id ? parseInt(form.sub_category_id) : null,
        stock_uom_id: parseInt(form.stock_uom_id),
        purchase_uom_id: form.purchase_uom_id ? parseInt(form.purchase_uom_id) : null,
        issue_uom_id: form.issue_uom_id ? parseInt(form.issue_uom_id) : null,
        purchase_to_stock_factor: parseFloat(form.purchase_to_stock_factor) || 1,
        stock_to_issue_factor: parseFloat(form.stock_to_issue_factor) || 1,
        last_purchase_price: form.last_purchase_price ? parseFloat(form.last_purchase_price) : null,
        min_order_qty: form.min_order_qty ? parseFloat(form.min_order_qty) : null,
        standard_pack_size: form.standard_pack_size ? parseFloat(form.standard_pack_size) : null,
        shelf_life_days: form.shelf_life_days ? parseInt(form.shelf_life_days) : null,
        storage_temp_min: form.storage_temp_min !== '' ? parseFloat(form.storage_temp_min) : null,
        storage_temp_max: form.storage_temp_max !== '' ? parseFloat(form.storage_temp_max) : null,
        yield_percentage: form.yield_percentage ? parseFloat(form.yield_percentage) : null,
      })
      toast.success(`Item ${result.item.item_code} created`)
      navigate(`/app/items/${result.item.id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner message="Loading form data..." />

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/app/items')} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Item</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <Section title="Basic Information">
          <Field label="Item Name *" full>
            <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)}
              className="input-field" placeholder="Enter item name" autoFocus />
          </Field>
          <Field label="Description" full>
            <textarea value={form.description} onChange={e => handleChange('description', e.target.value)}
              className="input-field" rows={2} placeholder="Optional description" />
          </Field>
          <Field label="Item Group *">
            <select value={form.item_group_id} onChange={e => handleChange('item_group_id', e.target.value)} className="input-field">
              <option value="">Select group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
            </select>
          </Field>
          <Field label="Sub-Category">
            <select value={form.sub_category_id} onChange={e => handleChange('sub_category_id', e.target.value)} className="input-field">
              <option value="">None</option>
              {subCategories.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
          </Field>
        </Section>

        {/* Classification */}
        <Section title="Classification">
          <Field label="ABC Class">
            <select value={form.abc_class} onChange={e => handleChange('abc_class', e.target.value)} className="input-field">
              <option value="A">A — High Value</option>
              <option value="B">B — Medium Value</option>
              <option value="C">C — Low Value</option>
            </select>
          </Field>
          <Field label="Storage Type">
            <select value={form.storage_type} onChange={e => handleChange('storage_type', e.target.value)} className="input-field">
              <option value="ambient">Ambient</option>
              <option value="chilled">Chilled</option>
              <option value="frozen">Frozen</option>
              <option value="hazardous">Hazardous</option>
            </select>
          </Field>
          <Field label="Perishable">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_perishable} onChange={e => handleChange('is_perishable', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
              <span className="text-sm text-gray-700">Yes, this item is perishable</span>
            </label>
          </Field>
          <Field label="Critical Item">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_critical} onChange={e => handleChange('is_critical', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
              <span className="text-sm text-gray-700">Yes, this is a critical item</span>
            </label>
          </Field>
        </Section>

        {/* Units & Conversion */}
        <Section title="Units & Conversion">
          <Field label="Stock UOM *">
            <select value={form.stock_uom_id} onChange={e => handleChange('stock_uom_id', e.target.value)} className="input-field">
              <option value="">Select UOM</option>
              {uoms.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
            </select>
          </Field>
          <Field label="Purchase UOM">
            <select value={form.purchase_uom_id} onChange={e => handleChange('purchase_uom_id', e.target.value)} className="input-field">
              <option value="">Same as stock</option>
              {uoms.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
            </select>
          </Field>
          <Field label="Issue UOM">
            <select value={form.issue_uom_id} onChange={e => handleChange('issue_uom_id', e.target.value)} className="input-field">
              <option value="">Same as stock</option>
              {uoms.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
            </select>
          </Field>
          <Field label="Purchase → Stock Factor">
            <input type="number" step="0.01" value={form.purchase_to_stock_factor}
              onChange={e => handleChange('purchase_to_stock_factor', e.target.value)} className="input-field" />
          </Field>
          <Field label="Stock → Issue Factor">
            <input type="number" step="0.01" value={form.stock_to_issue_factor}
              onChange={e => handleChange('stock_to_issue_factor', e.target.value)} className="input-field" />
          </Field>
        </Section>

        {/* Pricing */}
        <Section title="Pricing & Ordering">
          <Field label="Last Purchase Price">
            <input type="number" step="0.01" value={form.last_purchase_price}
              onChange={e => handleChange('last_purchase_price', e.target.value)}
              className="input-field" placeholder="0.00" />
          </Field>
          <Field label="Min Order Qty">
            <input type="number" step="0.01" value={form.min_order_qty}
              onChange={e => handleChange('min_order_qty', e.target.value)}
              className="input-field" placeholder="0" />
          </Field>
          <Field label="Standard Pack Size">
            <input type="number" step="0.01" value={form.standard_pack_size}
              onChange={e => handleChange('standard_pack_size', e.target.value)}
              className="input-field" placeholder="0" />
          </Field>
        </Section>

        {/* Storage & Safety */}
        <Section title="Storage & Safety">
          <Field label="Shelf Life (days)">
            <input type="number" value={form.shelf_life_days}
              onChange={e => handleChange('shelf_life_days', e.target.value)}
              className="input-field" placeholder="e.g. 365" />
          </Field>
          <Field label="HACCP Category">
            <select value={form.haccp_category} onChange={e => handleChange('haccp_category', e.target.value)} className="input-field">
              <option value="">None</option>
              <option value="ccp">CCP — Critical Control Point</option>
              <option value="oprp">OPRP — Operational Prerequisite</option>
              <option value="prp">PRP — Prerequisite Programme</option>
            </select>
          </Field>
          <Field label="Storage Temp Min (°C)">
            <input type="number" step="0.1" value={form.storage_temp_min}
              onChange={e => handleChange('storage_temp_min', e.target.value)}
              className="input-field" placeholder="e.g. 2" />
          </Field>
          <Field label="Storage Temp Max (°C)">
            <input type="number" step="0.1" value={form.storage_temp_max}
              onChange={e => handleChange('storage_temp_max', e.target.value)}
              className="input-field" placeholder="e.g. 8" />
          </Field>
          <Field label="Allergen Info" full>
            <input type="text" value={form.allergen_info}
              onChange={e => handleChange('allergen_info', e.target.value)}
              className="input-field" placeholder="e.g. Contains gluten, dairy" />
          </Field>
          <Field label="Yield %">
            <input type="number" step="0.1" value={form.yield_percentage}
              onChange={e => handleChange('yield_percentage', e.target.value)}
              className="input-field" placeholder="e.g. 85" />
          </Field>
        </Section>

        {/* Identifiers */}
        <Section title="Identifiers">
          <Field label="SAP Item No">
            <input type="text" value={form.sap_item_no} onChange={e => handleChange('sap_item_no', e.target.value)}
              className="input-field" placeholder="Optional SAP reference" />
          </Field>
          <Field label="Barcode">
            <input type="text" value={form.barcode} onChange={e => handleChange('barcode', e.target.value)}
              className="input-field" placeholder="Scan or enter barcode" />
          </Field>
          <Field label="Manufacturer">
            <input type="text" value={form.manufacturer} onChange={e => handleChange('manufacturer', e.target.value)}
              className="input-field" placeholder="Manufacturer name" />
          </Field>
        </Section>

        {/* Submit */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 -mx-4 mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate('/app/items')}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Creating...' : 'Create Item'}
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
