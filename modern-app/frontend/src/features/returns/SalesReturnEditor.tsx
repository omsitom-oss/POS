import { useState } from 'react'
import { ConfirmDialog, FormField, Select, TextInput } from '../../components/shared'
import { Icon } from '../../components/icons'
import { ReturnSummary } from './ReturnSummary'
import { enteredQuantity, money, quantity, quantityErrors, refundPreview, today } from './returnModel'

export type SalesReturnSource = {
  saleId: number; saleNo: string; saleDate: string; customerPartnerId?: number | null; customerName?: string | null; treasuryId?: number | null; currencyId: number; currencySymbol: string
  subtotal: number; discount: number; total: number; returnedTotal: number
  lines: Array<{ saleLineId: number; itemId: number; itemCode: string; itemNameAr: string; itemNameEn: string; soldQuantity: number; returnedQuantity: number; returnableQuantity: number; unitPrice: number }>
}
export type Treasury = { treasuryId: number; nameAr: string; nameEn: string; currencyId: number; currencySymbol: string; isActive: boolean }

// Return quantities per invoice line, the treasury the refund leaves from, and a confirmation before posting.
// An invoice saved without a treasury was sold on the customer's account, so its return is credited to the customer's account and no treasury is chosen.
export function SalesReturnEditor({ ar, source, treasuries, onCancel, onSaved }: { ar: boolean; source: SalesReturnSource; treasuries: Treasury[]; onCancel: () => void; onSaved: (returnNo: string) => void }) {
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const onAccount = source.treasuryId == null
  const [treasuryId, setTreasuryId] = useState(source.treasuryId ? String(source.treasuryId) : '')
  const [returnDate, setReturnDate] = useState(today())
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  const errors = quantityErrors(source.lines.map(line => ({ lineId: line.saleLineId, entered: quantities[line.saleLineId] ?? '', max: line.returnableQuantity })), ar)
  const returning = source.lines.map(line => ({ line, qty: enteredQuantity(quantities[line.saleLineId]) })).filter(entry => entry.qty > 0)
  const gross = returning.reduce((sum, entry) => sum + entry.qty * entry.line.unitPrice, 0)
  const completes = source.lines.every(line => enteredQuantity(quantities[line.saleLineId]) === line.returnableQuantity)
  const refund = refundPreview(gross, source, completes)
  const treasury = treasuries.find(item => String(item.treasuryId) === treasuryId)

  function review() {
    setError('')
    if (Object.keys(errors).length) { setError(ar ? 'صحّح الكميات المظللة أولاً.' : 'Fix the highlighted quantities first.'); return }
    if (!returning.length) { setError(ar ? 'أدخل كمية مرتجعة لسطر واحد على الأقل.' : 'Enter a quantity to return for at least one line.'); return }
    if (!onAccount && !treasuryId) { setError(ar ? 'اختر الخزنة التي يُصرف منها المبلغ.' : 'Choose the treasury the refund is paid from.'); return }
    setConfirming(true)
  }

  async function save() {
    setSaving(true)
    try {
      const response = await fetch('/api/sales-returns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saleId: source.saleId, treasuryId: onAccount ? null : Number(treasuryId), returnDate, reason: reason.trim() || null, lines: returning.map(entry => ({ lineId: entry.line.saleLineId, quantity: entry.qty })) }) })
      if (!response.ok) { const problem = await response.json().catch(() => null) as { detail?: string } | null; throw new Error(problem?.detail ?? (ar ? 'تعذر حفظ المرتجع.' : 'Could not save the return.')) }
      onSaved((await response.json() as { returnNo: string }).returnNo)
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); setConfirming(false) } finally { setSaving(false) }
  }

  return <div className="sales-editor-card">
    <section className="sales-items-panel" aria-label={ar ? 'أصناف الفاتورة' : 'Invoice items'}>
      <div className="sales-panel-heading"><div><span className="sales-panel-icon" aria-hidden="true"><Icon name="sales" size={20} /></span><h2>{source.saleNo}</h2></div><span className="muted-cell">{source.saleDate.slice(0, 10)} · {source.customerName ?? (ar ? 'بيع مباشر' : 'Walk-in')} · {money(source.total)} {source.currencySymbol}</span></div>
      <div className="receipts-table-wrap"><table className="receipts-table return-lines-table">
        <thead><tr><th>{ar ? 'الصنف' : 'Item'}</th><th>{ar ? 'المباع' : 'Sold'}</th><th>{ar ? 'المُرجع سابقاً' : 'Returned'}</th><th>{ar ? 'المتبقي' : 'Left'}</th><th>{ar ? 'سعر البيع' : 'Price'}</th><th>{ar ? 'كمية الإرجاع' : 'Return qty'}</th><th>{ar ? 'القيمة' : 'Value'}</th></tr></thead>
        <tbody>{source.lines.map(line => <tr key={line.saleLineId}>
          <td><strong>{ar ? line.itemNameAr : line.itemNameEn}</strong> <small dir="ltr">{line.itemCode}</small></td>
          <td className="numeric-cell">{quantity(line.soldQuantity)}</td>
          <td className="numeric-cell">{quantity(line.returnedQuantity)}</td>
          <td className="numeric-cell">{quantity(line.returnableQuantity)}</td>
          <td className="numeric-cell">{money(line.unitPrice)}</td>
          <td><FormField label="" error={errors[line.saleLineId]}><TextInput type="number" min="0" step="any" max={line.returnableQuantity} disabled={line.returnableQuantity <= 0} value={quantities[line.saleLineId] ?? ''} placeholder="0" onChange={event => setQuantities(current => ({ ...current, [line.saleLineId]: event.target.value }))} aria-label={`${ar ? 'كمية إرجاع' : 'Return quantity for'} ${ar ? line.itemNameAr : line.itemNameEn}`} /></FormField></td>
          <td className="numeric-cell">{money(enteredQuantity(quantities[line.saleLineId]) * line.unitPrice)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
    <ReturnSummary ar={ar} currencySymbol={source.currencySymbol} returnDate={returnDate} onReturnDate={setReturnDate} reason={reason} onReason={setReason} refund={refund} error={error} saving={saving} saveLabel={ar ? 'حفظ المرتجع' : 'Save return'} onCancel={onCancel} onSave={review}>
      {onAccount
        ? <p className="field-hint" role="note">{ar ? `تُقيَّد قيمة المرتجع لحساب العميل ${source.customerName ?? ''}، دون صرف من الخزنة.` : `The refund is credited to ${source.customerName ?? 'the customer'}'s account; nothing is paid out of a treasury.`}</p>
        : <FormField label={ar ? 'صرف المبلغ من الخزنة' : 'Refund from treasury'} required><Select value={treasuryId} onChange={event => setTreasuryId(event.target.value)} aria-label={ar ? 'صرف المبلغ من الخزنة' : 'Refund from treasury'}><option value="">{ar ? 'اختر الخزنة' : 'Choose treasury'}</option>{treasuries.map(item => <option key={item.treasuryId} value={item.treasuryId}>{ar ? item.nameAr : item.nameEn} · {item.currencySymbol}</option>)}</Select></FormField>}
    </ReturnSummary>
    <ConfirmDialog open={confirming} busy={saving} title={ar ? 'تأكيد المرتجع' : 'Confirm return'}
      message={onAccount
        ? (ar ? `سيتم إرجاع الأصناف إلى المخزون وقيد ${money(refund.net)} ${source.currencySymbol} لحساب ${source.customerName ?? 'العميل'}.` : `The items go back into stock and ${money(refund.net)} ${source.currencySymbol} is credited to ${source.customerName ?? 'the customer'}'s account.`)
        : (ar ? `سيتم إرجاع الأصناف إلى المخزون وصرف ${money(refund.net)} ${source.currencySymbol} من ${treasury?.nameAr ?? ''}.` : `The items go back into stock and ${money(refund.net)} ${source.currencySymbol} is paid out of ${treasury?.nameEn ?? ''}.`)}
      confirmLabel={ar ? 'تأكيد الإرجاع' : 'Confirm return'} cancelLabel={ar ? 'رجوع' : 'Back'} closeLabel={ar ? 'إغلاق' : 'Close'} onCancel={() => setConfirming(false)} onConfirm={() => void save()} />
  </div>
}
