// Shared types and refund arithmetic for the sales and purchase return screens.
// The server recomputes everything on save; this only previews what the return will refund.
import { formatQuantity, localDate } from '../../app/formatters'

export type ReturnableInvoice = { invoiceId: number; invoiceNo: string; invoiceDate: string; partnerName?: string | null; currencySymbol: string; total: number; returnedTotal: number }

export type InvoiceTotals = { subtotal: number; discount: number; total: number; returnedTotal: number }

export { formatMoney as money } from '../../app/formatters'
export const quantity = formatQuantity
export const today = () => localDate()

// Same rule as ReturnMath on the server: the invoice discount is shared in proportion to line value, and the
// return that completes the invoice refunds whatever of its total is left.
export function refundPreview(gross: number, invoice: InvoiceTotals, completesInvoice: boolean) {
  const remaining = Math.max(0, invoice.total - invoice.returnedTotal)
  if (completesInvoice) return { gross, discount: Math.max(0, gross - remaining), net: remaining }
  const share = invoice.subtotal <= 0 ? 0 : invoice.discount * gross / invoice.subtotal
  const net = Math.min(Math.max(0, Math.round((gross - share) * 100) / 100), remaining)
  return { gross, discount: Math.max(0, gross - net), net }
}

export type QuantityCheck = { lineId: number; entered: string; max: number }

// Problems with the entered quantities, keyed by line. An empty entry means "return none of this line".
export function quantityErrors(lines: QuantityCheck[], ar: boolean) {
  const errors: Record<number, string> = {}
  for (const line of lines) {
    if (line.entered.trim() === '') continue
    const value = Number(line.entered)
    if (!Number.isFinite(value) || value < 0) errors[line.lineId] = ar ? 'كمية غير صحيحة' : 'Not a valid quantity'
    else if (value > line.max) errors[line.lineId] = ar ? `الحد الأقصى ${quantity(line.max)}` : `At most ${quantity(line.max)}`
  }
  return errors
}

export const enteredQuantity = (value: string | undefined) => { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0 }
