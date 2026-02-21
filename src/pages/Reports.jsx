import { useState } from 'react'
import { useUser, useSelectedCamp, isManager } from '../context/AppContext'
import { reports as reportsApi, tally } from '../services/api'
import { Printer, FileDown, Download, Loader2 } from 'lucide-react'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import PrintPortal from '../components/print/PrintPortal'
import ReportTemplate from '../components/print/ReportTemplate'
import ReportTable from '../components/print/ReportTable'
import { useToast } from '../components/ui/Toast'

const REPORT_TYPES = [
  { key: 'stock_summary', label: 'Stock Summary', desc: 'Stock levels and values by camp' },
  { key: 'movement_history', label: 'Movement History', desc: 'All stock movements in period' },
  { key: 'order_summary', label: 'Order Summary', desc: 'Orders overview by camp' },
  { key: 'consumption', label: 'Consumption', desc: 'Issue/consumption analysis' },
]

const TALLY_TYPES = [
  { key: 'sales', label: 'Sales Vouchers', desc: 'POS transactions' },
  { key: 'purchase', label: 'Purchase Vouchers', desc: 'Approved orders' },
  { key: 'stock_journal', label: 'Stock Journal', desc: 'Dispatch & receive movements' },
  { key: 'consumption', label: 'Consumption', desc: 'Issue vouchers (non-POS)' },
]

export default function Reports() {
  const user = useUser()
  const { camps } = useSelectedCamp()
  const toast = useToast()
  const [type, setType] = useState('stock_summary')
  const [campId, setCampId] = useState('')
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().slice(0, 10))
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [printing, setPrinting] = useState(false)

  // Tally export state
  const [tallyType, setTallyType] = useState('sales')
  const [tallyPreview, setTallyPreview] = useState(null)
  const [tallyLoading, setTallyLoading] = useState(false)
  const [tallyError, setTallyError] = useState('')

  async function runReport() {
    setLoading(true)
    setError('')
    setData(null)
    try {
      const params = { date_from: dateFrom, date_to: dateTo }
      if (campId) params.camp_id = campId
      const res = await reportsApi.get(type, params)
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Build column definitions from data
  function getColumns() {
    if (!data?.data?.length) return []
    return Object.keys(data.data[0]).map(key => ({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      align: typeof data.data[0][key] === 'number' ? 'right' : 'left',
      format: typeof data.data[0][key] === 'number'
        ? (key.includes('value') || key.includes('cost') || key.includes('price') ? 'currency' : 'number')
        : undefined,
    }))
  }

  function handlePrint() {
    setPrinting(true)
  }

  // Tally preview
  async function previewTally() {
    setTallyLoading(true)
    setTallyError('')
    setTallyPreview(null)
    try {
      const params = { date_from: dateFrom, date_to: dateTo }
      if (campId) params.camp_id = campId
      const res = await tally.preview(tallyType, params)
      setTallyPreview(res)
    } catch (e) {
      setTallyError(e.message)
    } finally {
      setTallyLoading(false)
    }
  }

  // Tally XML download
  async function downloadTallyXml() {
    setTallyLoading(true)
    try {
      const res = await tally.exportXml({
        type: tallyType,
        date_from: dateFrom,
        date_to: dateTo,
        camp_id: campId || null,
      })

      // Create XML blob and download
      const xml = res.xml || res
      const blob = new Blob([typeof xml === 'string' ? xml : JSON.stringify(xml)], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tally-${tallyType}-${dateFrom}-${dateTo}.xml`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Tally XML downloaded')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setTallyLoading(false)
    }
  }

  const campName = campId
    ? camps?.find(c => String(c.id) === String(campId))?.name || ''
    : 'All Camps'

  const reportLabel = REPORT_TYPES.find(r => r.key === type)?.label || type

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Reports</h1>

      {/* Filters */}
      <div data-guide="report-filters" className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Report Type</label>
            <select
              data-guide="report-type-select"
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {REPORT_TYPES.map(r => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Camp</label>
            <select
              value={campId}
              onChange={e => setCampId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Camps</option>
              {camps?.map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runReport}
              disabled={loading}
              data-guide="report-generate-btn"
              className="w-full bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      {loading && <LoadingSpinner message="Generating report..." />}

      {/* Results */}
      {data && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">
              {REPORT_TYPES.find(r => r.key === data.report_type)?.label}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {data.data?.length} rows
              </span>
              {data.data?.length > 0 && (
                <>
                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition"
                  >
                    <Printer size={13} /> Print
                  </button>
                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition"
                    title="Save as PDF using browser print dialog"
                  >
                    <FileDown size={13} /> PDF
                  </button>
                </>
              )}
            </div>
          </div>

          {data.data?.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No data found for selected period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {Object.keys(data.data[0] || {}).map(key => (
                      <th key={key} className="text-left text-xs font-medium text-gray-500 pb-2 px-2 whitespace-nowrap">
                        {key.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="py-2 px-2 whitespace-nowrap">
                          {typeof val === 'number'
                            ? Number(val).toLocaleString()
                            : val || '-'
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Print Portal for Reports */}
      {data?.data?.length > 0 && (
        <PrintPortal
          pageType="report"
          trigger={printing}
          onDone={() => setPrinting(false)}
        >
          <ReportTemplate
            title={reportLabel}
            campName={campName}
            dateRange={data?.period}
          >
            <ReportTable
              columns={getColumns()}
              data={data.data}
            />
          </ReportTemplate>
        </PrintPortal>
      )}

      {/* ═════════ Tally Export Section ═════════ */}
      {isManager(user?.role) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Tally ERP Export</h2>
          <p className="text-xs text-gray-500 mb-4">
            Export transaction data as Tally-compatible XML for import into Tally ERP.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Export Type</label>
              <select
                value={tallyType}
                onChange={e => { setTallyType(e.target.value); setTallyPreview(null) }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {TALLY_TYPES.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={previewTally}
                disabled={tallyLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {tallyLoading ? <Loader2 size={14} className="animate-spin" /> : 'Preview'}
              </button>
              <button
                onClick={downloadTallyXml}
                disabled={tallyLoading}
                className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                <Download size={14} /> XML
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-2">
            Uses date range and camp filter from above.
            {TALLY_TYPES.find(t => t.key === tallyType)?.desc && (
              <> — {TALLY_TYPES.find(t => t.key === tallyType).desc}</>
            )}
          </p>

          {tallyError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mt-2">{tallyError}</div>
          )}

          {tallyPreview && (
            <div className="bg-gray-50 rounded-lg p-3 mt-2">
              <div className="text-sm font-medium text-gray-700 mb-2">Export Preview</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Vouchers:</span> <span className="font-medium">{tallyPreview.count || 0}</span></div>
                <div><span className="text-gray-500">Total Value:</span> <span className="font-medium">TZS {Math.round(tallyPreview.total_value || 0).toLocaleString()}</span></div>
                <div><span className="text-gray-500">Period:</span> <span className="font-medium">{dateFrom} to {dateTo}</span></div>
                <div><span className="text-gray-500">Type:</span> <span className="font-medium">{TALLY_TYPES.find(t => t.key === tallyType)?.label}</span></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
