/**
 * ReportTemplate — standardized wrapper for printable reports.
 * Renders a header, content area, and footer for A4 print.
 *
 * @param {string} title - report title
 * @param {string} campName - camp name
 * @param {{ from: string, to: string }} dateRange - period
 * @param {React.ReactNode} children - table or content
 */
export default function ReportTemplate({ title, campName, dateRange, children }) {
  const now = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#000', fontSize: '10pt' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '18pt', fontWeight: 'bold', color: '#10b981' }}>WebSquare</div>
          <div style={{ fontSize: '9pt', color: '#666', marginTop: '2px' }}>by Vyoma AI Studios</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '9pt', color: '#666' }}>
          <div>Generated: {now}</div>
          {campName && <div>Camp: {campName}</div>}
        </div>
      </div>

      {/* Title */}
      <div style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '4px' }}>{title}</div>
      {dateRange && (
        <div style={{ fontSize: '9pt', color: '#666', marginBottom: '16px' }}>
          Period: {dateRange.from} to {dateRange.to}
        </div>
      )}

      <div style={{ borderTop: '2px solid #10b981', marginBottom: '12px' }} />

      {/* Content */}
      <div>{children}</div>

      {/* Footer */}
      <div style={{ marginTop: '24px', borderTop: '1px solid #ddd', paddingTop: '8px', fontSize: '8pt', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
        <span>WebSquare v2.0 — Vyoma AI Studios</span>
        <span>{title}</span>
      </div>
    </div>
  )
}
