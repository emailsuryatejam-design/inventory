/**
 * ReportTable — print-optimized data table with repeating headers.
 *
 * @param {Array} columns - [{ key, label, align?, format? }]
 * @param {Array} data - row objects
 * @param {object} summary - optional summary row (same shape as data row)
 */
export default function ReportTable({ columns = [], data = [], summary }) {
  const fmt = (value, format) => {
    if (value == null || value === '') return '-'
    if (format === 'currency') return `TZS ${Math.round(Number(value)).toLocaleString('en-US')}`
    if (format === 'number') return Number(value).toLocaleString('en-US')
    if (format === 'date') {
      try {
        return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      } catch { return value }
    }
    return String(value)
  }

  const cellStyle = (align) => ({
    border: '1px solid #ccc',
    padding: '4px 8px',
    textAlign: align || 'left',
    fontSize: '9pt',
    whiteSpace: 'nowrap',
  })

  const headerStyle = (align) => ({
    ...cellStyle(align),
    background: '#f0f0f0',
    fontWeight: 'bold',
    fontSize: '9pt',
  })

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead style={{ display: 'table-header-group' }}>
        <tr>
          {columns.map((col) => (
            <th key={col.key} style={headerStyle(col.align)}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} style={{ pageBreakInside: 'avoid' }}>
            {columns.map((col) => (
              <td key={col.key} style={cellStyle(col.align)}>
                {fmt(row[col.key], col.format)}
              </td>
            ))}
          </tr>
        ))}

        {/* Summary Row */}
        {summary && (
          <tr style={{ fontWeight: 'bold', borderTop: '2px solid #000' }}>
            {columns.map((col) => (
              <td key={col.key} style={{ ...cellStyle(col.align), fontWeight: 'bold', borderTop: '2px solid #666' }}>
                {summary[col.key] != null ? fmt(summary[col.key], col.format) : ''}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  )
}
