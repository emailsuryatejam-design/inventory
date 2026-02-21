/**
 * ReceiptTemplate — standard receipt layout for POS & Bar orders.
 * Uses inline styles for reliable print rendering.
 *
 * Props:
 *   receipt: { voucher_number, service_type, created_at, items[], total_value, received_by, table_number, guest_count, notes }
 *   campName: string
 *   headerText: string (optional custom header)
 *   footerText: string (optional custom footer)
 */
export default function ReceiptTemplate({ receipt, campName, headerText, footerText }) {
  if (!receipt) return null

  const date = receipt.created_at
    ? new Date(receipt.created_at).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : receipt.time || new Date().toLocaleString('en-GB')

  const fmt = (n) => Math.round(n).toLocaleString('en-US')

  const styles = {
    wrapper: {
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '12px',
      lineHeight: '1.4',
      color: '#000',
      background: '#fff',
      width: '280px',
      margin: '0 auto',
      padding: '8px 0',
    },
    center: { textAlign: 'center' },
    bold: { fontWeight: 'bold' },
    line: {
      borderTop: '1px dashed #000',
      margin: '6px 0',
    },
    row: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '1px 0',
    },
    itemRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '2px 0',
      fontSize: '11px',
    },
    totalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '4px 0',
      fontWeight: 'bold',
      fontSize: '14px',
    },
  }

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.center}>
        <div style={{ ...styles.bold, fontSize: '16px', marginBottom: '2px' }}>
          {campName || 'WebSquare'}
        </div>
        {headerText && <div style={{ fontSize: '10px' }}>{headerText}</div>}
      </div>

      <div style={styles.line} />

      {/* Voucher Info */}
      <div style={styles.row}>
        <span>Voucher:</span>
        <span style={styles.bold}>{receipt.voucher_number}</span>
      </div>
      <div style={styles.row}>
        <span>Date:</span>
        <span>{date}</span>
      </div>
      {receipt.service_type && (
        <div style={styles.row}>
          <span>Service:</span>
          <span>{typeof receipt.service_type === 'object' ? receipt.service_type.label : receipt.service_type}</span>
        </div>
      )}
      {receipt.table_number && (
        <div style={styles.row}>
          <span>Table:</span>
          <span>{receipt.table_number}</span>
        </div>
      )}
      {receipt.guest_count && (
        <div style={styles.row}>
          <span>Guests:</span>
          <span>{receipt.guest_count}</span>
        </div>
      )}

      <div style={styles.line} />

      {/* Column Header */}
      <div style={{ ...styles.itemRow, fontWeight: 'bold', fontSize: '11px' }}>
        <span style={{ flex: '0 0 30px' }}>Qty</span>
        <span style={{ flex: 1 }}>Item</span>
        <span style={{ flex: '0 0 70px', textAlign: 'right' }}>Amount</span>
      </div>

      <div style={{ borderTop: '1px solid #000', margin: '2px 0' }} />

      {/* Items */}
      {(receipt.items || []).map((item, i) => {
        const price = item.price || 0
        const qty = item.qty || 1
        return (
          <div key={item.id || i} style={styles.itemRow}>
            <span style={{ flex: '0 0 30px' }}>{qty}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
            </span>
            <span style={{ flex: '0 0 70px', textAlign: 'right' }}>
              {fmt(qty * price)}
            </span>
          </div>
        )
      })}

      <div style={styles.line} />

      {/* Total */}
      <div style={styles.totalRow}>
        <span>TOTAL</span>
        <span>TZS {fmt(receipt.total_value)}</span>
      </div>

      <div style={styles.line} />

      {/* Footer */}
      {receipt.received_by && (
        <div style={{ ...styles.row, fontSize: '10px' }}>
          <span>Served by:</span>
          <span>{receipt.received_by}</span>
        </div>
      )}
      {receipt.notes && (
        <div style={{ fontSize: '10px', marginTop: '4px' }}>
          Note: {receipt.notes}
        </div>
      )}

      <div style={{ ...styles.center, marginTop: '8px', fontSize: '10px' }}>
        {footerText || 'Thank you for visiting!'}
      </div>

      <div style={{ ...styles.center, marginTop: '4px', fontSize: '9px', opacity: 0.5 }}>
        WebSquare by Vyoma AI Studios
      </div>
    </div>
  )
}
