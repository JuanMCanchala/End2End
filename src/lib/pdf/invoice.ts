// Generador de facturas PDF profesionales
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit')

export interface InvoiceItem {
  product_name: string
  quantity: number
  unit_price: number
  total: number
}

export interface InvoiceData {
  invoiceNumber: string
  date: string
  businessName: string
  businessDescription?: string | null
  clientName: string
  clientPhone: string
  items: InvoiceItem[]
  totalAmount: number
  currency: string
}

function formatMoney(amount: number, currency: string): string {
  return `$${amount.toLocaleString('es-CO')} ${currency}`
}

export function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const primary = '#6D28D9'   // purple-700
    const light   = '#EDE9FE'   // purple-100
    const gray    = '#6B7280'
    const dark    = '#111827'

    // ── Cabecera ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 110).fill(primary)

    doc.fontSize(26).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text(data.businessName, 50, 30, { align: 'left' })

    if (data.businessDescription) {
      doc.fontSize(10).font('Helvetica').fillColor('#C4B5FD')
        .text(data.businessDescription, 50, 62, { width: 320 })
    }

    // Badge "FACTURA"
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text('FACTURA DE VENTA', doc.page.width - 200, 35, { width: 160, align: 'right' })
    doc.fontSize(9).font('Helvetica').fillColor('#DDD6FE')
      .text(`N° ${data.invoiceNumber}`, doc.page.width - 200, 55, { width: 160, align: 'right' })
    doc.fontSize(9).fillColor('#DDD6FE')
      .text(data.date, doc.page.width - 200, 70, { width: 160, align: 'right' })

    // ── Info del cliente ───────────────────────────────────────────────────────
    doc.rect(50, 125, doc.page.width - 100, 55).fill(light)

    doc.fontSize(8).font('Helvetica-Bold').fillColor(gray)
      .text('FACTURADO A', 65, 135)
    doc.fontSize(12).font('Helvetica-Bold').fillColor(dark)
      .text(data.clientName, 65, 148)
    doc.fontSize(9).font('Helvetica').fillColor(gray)
      .text(data.clientPhone.replace('telegram:', 'Telegram ID: ').replace('whatsapp:', 'WhatsApp: '), 65, 164)

    doc.fontSize(8).font('Helvetica-Bold').fillColor(gray)
      .text('SISTEMA', doc.page.width - 185, 135)
    doc.fontSize(10).font('Helvetica').fillColor(dark)
      .text('End2End', doc.page.width - 185, 148)
    doc.fontSize(8).fillColor(gray)
      .text('Sistema Multi-Agente', doc.page.width - 185, 162)

    // ── Tabla de productos ─────────────────────────────────────────────────────
    const tableTop = 205
    const colX = { desc: 50, qty: 310, price: 380, total: 455 }

    // Header de tabla
    doc.rect(50, tableTop, doc.page.width - 100, 25).fill(primary)
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text('PRODUCTO / SERVICIO', colX.desc, tableTop + 8)
      .text('CANT.', colX.qty, tableTop + 8, { width: 60, align: 'center' })
      .text('PRECIO UNIT.', colX.price, tableTop + 8, { width: 70, align: 'right' })
      .text('TOTAL', colX.total, tableTop + 8, { width: 80, align: 'right' })

    // Filas de productos
    let y = tableTop + 25
    data.items.forEach((item, idx) => {
      const rowColor = idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB'
      doc.rect(50, y, doc.page.width - 100, 28).fill(rowColor)

      doc.fontSize(10).font('Helvetica').fillColor(dark)
        .text(item.product_name, colX.desc, y + 9, { width: 250 })
      doc.text(String(item.quantity), colX.qty, y + 9, { width: 60, align: 'center' })
      doc.fontSize(9).fillColor(gray)
        .text(formatMoney(item.unit_price, data.currency), colX.price, y + 9, { width: 70, align: 'right' })
      doc.fontSize(10).font('Helvetica-Bold').fillColor(dark)
        .text(formatMoney(item.total, data.currency), colX.total, y + 9, { width: 80, align: 'right' })

      // Línea separadora
      doc.moveTo(50, y + 28).lineTo(doc.page.width - 50, y + 28).strokeColor('#E5E7EB').lineWidth(0.5).stroke()
      y += 28
    })

    // ── Total ──────────────────────────────────────────────────────────────────
    y += 10
    doc.rect(doc.page.width - 230, y, 180, 35).fill(primary)
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text('TOTAL', doc.page.width - 225, y + 10, { width: 80 })
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text(formatMoney(data.totalAmount, data.currency), doc.page.width - 130, y + 9, { width: 120, align: 'right' })

    // ── Instrucciones de pago ──────────────────────────────────────────────────
    y += 60
    doc.rect(50, y, doc.page.width - 100, 70).fill(light)
    doc.fontSize(9).font('Helvetica-Bold').fillColor(primary)
      .text('INSTRUCCIONES DE PAGO', 65, y + 12)
    doc.fontSize(9).font('Helvetica').fillColor(dark)
      .text(
        'Por favor realiza el pago del total indicado y envía el comprobante de transferencia para verificación.\n' +
        'Una vez confirmado el pago, procesaremos tu pedido a la brevedad posible.\n' +
        '¡Gracias por tu confianza!',
        65, y + 28, { width: doc.page.width - 130 }
      )

    // ── Footer ─────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 55
    doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).strokeColor('#E5E7EB').lineWidth(1).stroke()
    doc.fontSize(8).font('Helvetica').fillColor(gray)
      .text(
        `${data.businessName}  ·  Generado por End2End Sistema Multi-Agente  ·  ${data.date}`,
        50, footerY + 12, { align: 'center', width: doc.page.width - 100 }
      )

    doc.end()
  })
}
