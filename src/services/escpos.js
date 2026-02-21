/**
 * WebSquare — ESC/POS Thermal Printer Utility
 * Generates binary command sequences for thermal receipt printers.
 * Supports 80mm (48 chars) and 58mm (32 chars) paper widths.
 */

const ESC = 0x1B
const GS = 0x1D
const LF = 0x0A

// ── Primitive Commands ──────────────────────

function initialize() {
  return new Uint8Array([ESC, 0x40]) // ESC @ — reset
}

function lineFeed(n = 1) {
  return new Uint8Array(Array(n).fill(LF))
}

function bold(on) {
  return new Uint8Array([ESC, 0x45, on ? 1 : 0])
}

function alignCenter() {
  return new Uint8Array([ESC, 0x61, 1])
}

function alignLeft() {
  return new Uint8Array([ESC, 0x61, 0])
}

function alignRight() {
  return new Uint8Array([ESC, 0x61, 2])
}

function textSize(w = 1, h = 1) {
  // w and h: 1-8 (normal to 8x)
  const n = ((w - 1) << 4) | (h - 1)
  return new Uint8Array([GS, 0x21, n])
}

function cut() {
  return new Uint8Array([GS, 0x56, 0x00]) // Full cut
}

function partialCut() {
  return new Uint8Array([GS, 0x56, 0x01])
}

function text(str) {
  const encoder = new TextEncoder()
  return encoder.encode(str)
}

function line(char = '-', width = 48) {
  return text(char.repeat(width) + '\n')
}

function padRight(str, width) {
  return str.length >= width ? str.substring(0, width) : str + ' '.repeat(width - str.length)
}

function padLeft(str, width) {
  return str.length >= width ? str.substring(0, width) : ' '.repeat(width - str.length) + str
}

// ── Concatenate Uint8Arrays ──────────────────

function concat(...arrays) {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const a of arrays) {
    result.set(a, offset)
    offset += a.length
  }
  return result
}

// ── Main Receipt Generator ───────────────────

/**
 * Generate ESC/POS binary commands for a receipt.
 *
 * @param {object} receipt - { voucher_number, service_type, created_at, items[], total_value, received_by, table_number, notes }
 * @param {object} config - { campName, headerText, footerText, printerWidth: 48|32 }
 * @returns {Uint8Array} - binary ESC/POS commands
 */
export function generateReceiptCommands(receipt, config = {}) {
  const w = config.printerWidth || 48
  const campName = config.campName || 'WebSquare'
  const fmt = (n) => Math.round(n).toLocaleString('en-US')

  const date = receipt.created_at
    ? new Date(receipt.created_at).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : new Date().toLocaleString('en-GB')

  const parts = [
    initialize(),
    // Header
    alignCenter(),
    bold(true),
    textSize(2, 2),
    text(campName + '\n'),
    textSize(1, 1),
    bold(false),
  ]

  if (config.headerText) {
    parts.push(text(config.headerText + '\n'))
  }

  parts.push(
    line('-', w),
    alignLeft(),
    // Voucher info
    text(`Voucher: ${receipt.voucher_number}\n`),
    text(`Date:    ${date}\n`),
  )

  if (receipt.service_type) {
    const st = typeof receipt.service_type === 'object' ? receipt.service_type.label : receipt.service_type
    parts.push(text(`Service: ${st}\n`))
  }
  if (receipt.table_number) {
    parts.push(text(`Table:   ${receipt.table_number}\n`))
  }

  parts.push(line('-', w))

  // Column header
  const qtyW = 4
  const amtW = 10
  const nameW = w - qtyW - amtW - 2 // 2 spaces between columns

  parts.push(
    bold(true),
    text(padRight('Qty', qtyW) + ' ' + padRight('Item', nameW) + ' ' + padLeft('Amount', amtW) + '\n'),
    bold(false),
    line('-', w),
  )

  // Items
  for (const item of (receipt.items || [])) {
    const qty = item.qty || 1
    const price = item.price || 0
    const total = fmt(qty * price)
    const name = (item.name || '').substring(0, nameW)
    parts.push(
      text(
        padRight(String(qty), qtyW) + ' ' +
        padRight(name, nameW) + ' ' +
        padLeft(total, amtW) + '\n'
      )
    )
  }

  parts.push(line('=', w))

  // Total
  parts.push(
    bold(true),
    textSize(1, 2),
    text(padRight('TOTAL', w - amtW - 5) + ' TZS ' + padLeft(fmt(receipt.total_value), amtW) + '\n'),
    textSize(1, 1),
    bold(false),
    line('-', w),
  )

  // Footer
  if (receipt.received_by) {
    parts.push(text(`Served by: ${receipt.received_by}\n`))
  }

  parts.push(
    lineFeed(1),
    alignCenter(),
    text((config.footerText || 'Thank you for visiting!') + '\n'),
    text('WebSquare by Vyoma AI Studios\n'),
    lineFeed(3),
    partialCut(),
  )

  return concat(...parts)
}

/**
 * Send ESC/POS commands to a network thermal printer.
 *
 * @param {Uint8Array} commands - binary ESC/POS data
 * @param {string} printerUrl - e.g. http://192.168.1.50:9100
 */
export async function sendToNetworkPrinter(commands, printerUrl) {
  const response = await fetch(printerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: commands,
  })

  if (!response.ok) {
    throw new Error(`Printer error: ${response.status} ${response.statusText}`)
  }

  return true
}
