import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { items as itemsApi } from '../services/api'
import {
  ArrowLeft, Package, Thermometer, AlertTriangle,
  Clock, Truck, BarChart3, ShieldCheck
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function ItemDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadItem()
  }, [id])

  async function loadItem() {
    setLoading(true)
    try {
      const result = await itemsApi.get(id)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSpinner message="Loading item..." />

  if (error) return (
    <div className="text-center py-16">
      <p className="text-red-600 mb-4">{error}</p>
      <Link to="/app/items" className="text-green-600 font-medium">Back to Items</Link>
    </div>
  )

  if (!data) return null

  const item = data.item
  const formatPrice = (v) => v ? `TZS ${Math.round(v).toLocaleString()}` : '—'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app/items" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-mono text-gray-400">{item.item_code}</span>
            <Badge variant={item.abc_class}>{item.abc_class}</Badge>
            <Badge variant={item.storage_type}>{item.storage_type}</Badge>
            {item.is_critical && <Badge variant="danger">Critical</Badge>}
          </div>
          <h1 className="text-xl font-bold text-gray-900 truncate">{item.name}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Basic Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package size={18} />
              Item Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Item Code" value={item.item_code} />
              <InfoRow label="SAP Item No" value={item.sap_item_no || '—'} />
              <InfoRow label="Group" value={item.group_name ? `${item.group_code} — ${item.group_name}` : '—'} />
              <InfoRow label="Sub-Category" value={item.sub_cat_name ? `${item.sub_cat_code} — ${item.sub_cat_name}` : '—'} />
              <InfoRow label="Cost Center" value={item.cost_center_name || '—'} />
              <InfoRow label="Manufacturer" value={item.manufacturer || '—'} />
              <InfoRow label="Barcode" value={item.barcode || '—'} />
              <InfoRow label="Description" value={item.description || '—'} />
            </div>
          </div>

          {/* Units & Pricing */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 size={18} />
              Units & Pricing
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Stock UOM" value={item.stock_uom_name || item.stock_uom || '—'} />
              <InfoRow label="Purchase UOM" value={item.purchase_uom_name || item.purchase_uom || '—'} />
              <InfoRow label="Issue UOM" value={item.issue_uom_name || item.issue_uom || '—'} />
              <InfoRow label="Pack Size" value={item.standard_pack_size || '—'} />
              <InfoRow label="Purchase → Stock" value={`${item.purchase_to_stock_factor}x`} />
              <InfoRow label="Stock → Issue" value={`${item.stock_to_issue_factor}x`} />
              <InfoRow label="Last Purchase Price" value={formatPrice(item.last_purchase_price)} highlight />
              <InfoRow label="Weighted Avg Cost" value={formatPrice(item.weighted_avg_cost)} />
              <InfoRow label="Min Order Qty" value={item.min_order_qty || '—'} />
              <InfoRow label="Yield %" value={item.yield_percentage ? `${item.yield_percentage}%` : '—'} />
            </div>
          </div>

          {/* Storage & Safety */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShieldCheck size={18} />
              Storage & Safety
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Storage Type" value={item.storage_type} />
              <InfoRow label="Temp Range" value={
                item.storage_temp_min != null || item.storage_temp_max != null
                  ? `${item.storage_temp_min ?? '?'}°C to ${item.storage_temp_max ?? '?'}°C`
                  : '—'
              } />
              <InfoRow label="HACCP Category" value={item.haccp_category?.replace(/_/g, ' ') || '—'} />
              <InfoRow label="Perishable" value={item.is_perishable ? 'Yes' : 'No'} />
              <InfoRow label="Shelf Life" value={item.shelf_life_days ? `${item.shelf_life_days} days` : '—'} />
              <InfoRow label="After Opening" value={item.shelf_life_after_opening_days ? `${item.shelf_life_after_opening_days} days` : '—'} />
              <InfoRow label="Allergen Info" value={item.allergen_info || '—'} />
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Stock Across Camps */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Truck size={18} />
              Stock by Camp
            </h2>
            {data.stock_balances.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No stock records</p>
            ) : (
              <div className="space-y-3">
                {data.stock_balances.map(sb => (
                  <div key={sb.camp_id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{sb.camp_name}</span>
                      <Badge variant={sb.stock_status}>{sb.stock_status}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-gray-900">
                        {sb.current_qty.toLocaleString()} <span className="text-xs text-gray-400 font-normal">{item.stock_uom}</span>
                      </span>
                      <span className="text-xs text-gray-400">
                        Par: {sb.par_level ?? '—'}
                      </span>
                    </div>
                    {sb.days_stock_on_hand != null && (
                      <p className="text-xs text-gray-400 mt-1">
                        {sb.days_stock_on_hand} days on hand
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Suppliers */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Suppliers</h2>
            {data.suppliers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No suppliers linked</p>
            ) : (
              <div className="space-y-2">
                {data.suppliers.map(s => (
                  <div key={s.supplier_id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {s.supplier_name}
                        {s.is_preferred && <span className="ml-1 text-green-600 text-xs">★</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        Lead: {s.lead_time_days ? `${s.lead_time_days}d` : '—'}
                      </p>
                    </div>
                    <span className="text-sm text-gray-600">
                      {s.unit_price ? formatPrice(s.unit_price) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Movements */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={18} />
              Recent Movements
            </h2>
            {data.recent_movements.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No movements yet</p>
            ) : (
              <div className="space-y-2">
                {data.recent_movements.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm text-gray-900">
                        <span className={m.type === 'receipt' || m.type === 'adjustment_in'
                          ? 'text-green-600'
                          : 'text-red-600'
                        }>
                          {m.type === 'receipt' || m.type === 'adjustment_in' ? '+' : '−'}
                          {m.quantity}
                        </span>
                        <span className="text-gray-400 ml-1">{m.camp_code}</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {m.reference_number || m.type} · {new Date(m.created_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, highlight }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm ${highlight ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
        {value}
      </p>
    </div>
  )
}
