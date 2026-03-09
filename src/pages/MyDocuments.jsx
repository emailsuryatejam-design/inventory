import { useState, useEffect } from 'react'
import { useUser } from '../context/AppContext'
import { selfService as selfServiceApi } from '../services/api'
import { FileText, Download } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

const DOCUMENT_TYPES = [
  { key: '', label: 'All' },
  { key: 'payslip', label: 'Payslip' },
  { key: 'contract', label: 'Contract' },
  { key: 'letter', label: 'Letter' },
  { key: 'tax_form', label: 'Tax Form' },
  { key: 'other', label: 'Other' },
]

const TYPE_VARIANTS = {
  payslip: 'ok',
  contract: 'info',
  letter: 'warning',
  tax_form: 'danger',
  other: 'default',
}

export default function MyDocuments() {
  const user = useUser()
  const [documents, setDocuments] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedType, setSelectedType] = useState('')

  useEffect(() => {
    loadDocuments()
  }, [selectedType])

  async function loadDocuments() {
    setLoading(true)
    setError('')
    try {
      const result = await selfServiceApi.myDocuments(selectedType || undefined)
      setDocuments(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatTypeLabel(type) {
    if (!type) return '—'
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  function handleDownload(doc) {
    // Trigger download via the document URL or ID
    if (doc.download_url) {
      window.open(doc.download_url, '_blank')
    } else if (doc.file_url) {
      window.open(doc.file_url, '_blank')
    }
  }

  const docList = documents?.documents || []

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4" data-guide="my-documents-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {docList.length} document{docList.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 mb-4">
        <select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        >
          {DOCUMENT_TYPES.map(t => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadDocuments} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !documents && <LoadingSpinner message="Loading documents..." />}

      {/* Documents List */}
      {documents && (
        <div className="bg-white rounded-xl border border-gray-200">
          {docList.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents found"
              message={selectedType ? `No ${formatTypeLabel(selectedType).toLowerCase()} documents available` : 'You have no documents at this time'}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Title</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Type</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docList.map((doc, idx) => (
                      <tr key={doc.id || idx} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-gray-400 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-900">{doc.title || doc.name || 'Untitled'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={TYPE_VARIANTS[doc.type || doc.document_type] || 'default'}>
                            {formatTypeLabel(doc.type || doc.document_type)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{formatDate(doc.date || doc.created_at)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDownload(doc)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 hover:text-green-700 hover:bg-green-50 font-medium rounded-lg transition"
                          >
                            <Download size={14} />
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {docList.map((doc, idx) => (
                  <div key={doc.id || idx} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900 truncate">{doc.title || doc.name || 'Untitled'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={TYPE_VARIANTS[doc.type || doc.document_type] || 'default'}>
                            {formatTypeLabel(doc.type || doc.document_type)}
                          </Badge>
                          <span className="text-xs text-gray-400">{formatDate(doc.date || doc.created_at)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="flex-shrink-0 p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
