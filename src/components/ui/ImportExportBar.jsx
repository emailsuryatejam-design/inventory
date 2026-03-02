import { useState, useRef } from 'react'
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { dataExport, dataImport } from '../../services/api'
import Modal from './Modal'

/**
 * ImportExportBar — Reusable toolbar for CSV import/export
 *
 * Props:
 *   entity       - 'items' | 'suppliers'
 *   onImportComplete - callback after successful import (e.g. refresh list)
 *   campId       - optional camp filter for stock export
 */
export default function ImportExportBar({ entity, onImportComplete, campId }) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const importFileRef = useRef(null) // keep reference to the file for execute step

  async function handleExport() {
    setError('')
    setExporting(true)
    try {
      if (entity === 'stock') {
        await dataExport.stock(campId)
      } else {
        await dataExport[entity]()
      }
    } catch (err) {
      setError(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function handleTemplate() {
    setError('')
    try {
      await dataExport.template(entity)
    } catch (err) {
      setError(err.message || 'Template download failed')
    }
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset file input so same file can be selected again
    if (fileRef.current) fileRef.current.value = ''

    setError('')
    setResult(null)
    setImporting(true)
    importFileRef.current = file

    try {
      const res = await dataImport.validate(file, entity)
      setPreview(res)
    } catch (err) {
      setError(err.message || 'File validation failed')
    } finally {
      setImporting(false)
    }
  }

  async function handleConfirmImport() {
    if (!importFileRef.current) return
    setImporting(true)
    try {
      const res = await dataImport.execute(importFileRef.current, entity)
      setResult(res)
      setPreview(null)
      importFileRef.current = null
      if (res.success && onImportComplete) {
        onImportComplete()
      }
    } catch (err) {
      setError(err.message || 'Import failed')
      setPreview(null)
    } finally {
      setImporting(false)
    }
  }

  function handleCancelPreview() {
    setPreview(null)
    importFileRef.current = null
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg
                     hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Download size={14} />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>

        {/* Template */}
        <button
          onClick={handleTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg
                     hover:bg-gray-50 transition-colors"
        >
          <FileSpreadsheet size={14} />
          Template
        </button>

        {/* Import */}
        <label
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg
                      transition-colors cursor-pointer ${importing ? 'opacity-50' : 'hover:bg-gray-50'}`}
        >
          <Upload size={14} />
          {importing ? 'Processing...' : 'Import CSV'}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileSelect}
            disabled={importing}
            className="hidden"
          />
        </label>

        {/* Error */}
        {error && (
          <span className="text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle size={12} /> {error}
            <button onClick={() => setError('')} className="ml-1 hover:text-red-800">
              <X size={12} />
            </button>
          </span>
        )}
      </div>

      {/* Success toast */}
      {result?.success && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>
            Successfully imported <strong>{result.inserted}</strong> {entity}.
            {result.error_count > 0 && ` (${result.error_count} rows had errors)`}
          </span>
          <button onClick={() => setResult(null)} className="ml-auto hover:text-emerald-900">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <Modal open={true} onClose={handleCancelPreview} title="Import Preview" maxWidth="640px">
          <div className="p-4 space-y-4">
            {/* Summary */}
            <div className="flex gap-4 text-sm">
              <div className="px-3 py-2 bg-blue-50 rounded-lg">
                <div className="text-blue-600 font-semibold">{preview.total_rows}</div>
                <div className="text-blue-500 text-xs">Total rows</div>
              </div>
              <div className="px-3 py-2 bg-emerald-50 rounded-lg">
                <div className="text-emerald-600 font-semibold">{preview.valid_count}</div>
                <div className="text-emerald-500 text-xs">Valid</div>
              </div>
              {preview.error_count > 0 && (
                <div className="px-3 py-2 bg-red-50 rounded-lg">
                  <div className="text-red-600 font-semibold">{preview.error_count}</div>
                  <div className="text-red-500 text-xs">Errors</div>
                </div>
              )}
            </div>

            {/* Errors list */}
            {preview.errors?.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-red-100 rounded-lg">
                <div className="px-3 py-1.5 bg-red-50 text-xs font-medium text-red-700 border-b border-red-100">
                  Errors (showing first {Math.min(preview.errors.length, 50)})
                </div>
                {preview.errors.slice(0, 20).map((err, i) => (
                  <div key={i} className="px-3 py-1.5 text-xs text-red-600 border-b border-red-50 last:border-0">
                    <span className="font-medium">Line {err.line}:</span>{' '}
                    {err.errors.join('; ')}
                  </div>
                ))}
              </div>
            )}

            {/* Preview table */}
            {preview.preview?.length > 0 && (
              <div className="max-h-48 overflow-auto border rounded-lg">
                <div className="px-3 py-1.5 bg-gray-50 text-xs font-medium text-gray-600 border-b">
                  Preview (first {Math.min(preview.preview.length, 10)} valid rows)
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-gray-50/50">
                      {Object.keys(preview.preview[0]).map(key => (
                        <th key={key} className="px-2 py-1 text-left font-medium text-gray-500 whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-2 py-1 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                            {val || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Available codes hint */}
            {preview.available_groups?.length > 0 && (
              <p className="text-xs text-gray-500">
                <span className="font-medium">Available group codes:</span>{' '}
                {preview.available_groups.join(', ') || 'None (create groups first)'}
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={handleCancelPreview}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing || preview.valid_count === 0}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg
                           hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {importing ? 'Importing...' : `Import ${preview.valid_count} ${entity}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
