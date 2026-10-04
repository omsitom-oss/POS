import { useState } from 'react'
import { ConfirmDialog, FormField, TextInput } from '../../components/shared'
import { Icon } from '../../components/icons'
import { ReturnSummary } from './ReturnSummary'
import { enteredQuantity, money, quantity, quantityErrors, refundPreview, today } from './returnModel'

export type PurchaseReturnSource = {
  purchaseId: number; invoiceNo: string; purchaseDate: string; supplierName: string; currencySymbol: string
  subtotal: number; discount: number; total: number; returnedTotal: number; requiresApproval: boolean
  lines: Array<{ purchaseLineId: number; itemId: number; itemCode: string; itemNameAr: string; itemNameEn: string; unitName?: string | null; batchNo?: string | null; expiryDate?: string | null; purchasedQuantity: number; returnedQuantity: number; availableQuantity: number; returnableQuantity: number; unitCost: number }>
}

// Return quantities per purchase line (batch). A line can only give back what is still in stock.
export function PurchaseReturnEditor({ ar, source, onCancel, onSaved }: { ar: boolean; source: PurchaseReturnSource; onCancel: () => void; onSaved: (returnNo: string, status: string) => void }) {
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [returnDate, setReturnDate] = useState(today())
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  const errors = quantityErrors(source.lines.map(line => ({ lineId: line.purchaseLineId, entered: quantities[line.purchaseLineId] ?? '', max: line.returnableQuantity })), ar)
  const returning = source.lines.map(line => ({ line, qty: enteredQuantity(quantities[line.purchaseLineId]) })).filter(entry => entry.qty > 0)
  const gross = returning.reduce((sum, entry) => sum + entry.qty * entry.line.unitCost, 0)
  const completes = source.lines.every(line => enteredQuantity(quantities[line.purchaseLineId]) === line.purchasedQuantity - line.returnedQuantity)
  const refund = refundPreview(gross, source, completes)

  function review() {
    setError('')
    if (Object.keys(errors).length) { setError(ar ? 'صحّح الكميات المظللة أولاً.' : 'Fix the highlighted quantities first.'); return }
    if (!returning.length) { setError(ar ? 'أدخل كمية مرتجعة لسطر واحد على الأقل.' : 'Enter a quantity to return for at least one line.'); return }
    setConfirming(true)
  }

  async function save() {
    setSaving(true)
    try {
      const response = await fetch('/api/purchase-returns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purchaseId: source.purchaseId, returnDate, reason: reason.trim() || null, lines: returning.map(entry => ({ lineId: entry.line.purchaseLineId, quantity: entry.qty })) }) })
      if (!response.ok) { const problem = await response.json().catch(() => null) as { detail?: string } | null; throw new Error(problem?.detail ?? (ar ? 'تعذر حفظ المرتجع.' : 'Could not save the return.')) }
      const result = await response.json() as { returnNo: string; status: string }
      onSaved(result.returnNo, result.status)
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); setConfirming(false) } finally { setSaving(false) }
  }

  const effect = source.requiresApproval
    ? (ar ? 'سيُرسل المرتجع للموافقة، ولن يتأثر المخزون أو رصيد المورد قبل الموافقة.' : 'The return goes for approval. Stock and the supplier balance change only once it is approved.')
    : (ar ? `ستخرج الأصناف من المخزون ويقل رصيد المورد بمقدار ${money(refund.net)} ${source.currencySymbol}.` : `The items leave stock and the supplier balance goes down by ${money(refund.net)} ${source.currencySymbol}.`)

  return <div className="sales-editor-card">
    <section className="sales-items-panel" aria-label={ar ? 'أصناف الفاتورة' : 'Invoice items'}>
      <div className="sales-panel-heading"><div><span className="sales-panel-icon" aria-hidden="true"><Icon name="purchases" size={20} /></span><h2>{source.invoiceNo}</h2></div><span className="muted-cell">{source.purchaseDate.slice(0, 10)} · {source.supplierName} · {money(source.total)} {source.currencySymbol}</span></div>
      <div className="receipts-table-wrap"><table className="receipts-table return-lines-table">
        <thead><tr><th>{ar ? 'الصنف' : 'Item'}</th><th>{ar ? 'الباتش / الانتهاء' : 'Batch / expiry'}</th><th>{ar ? 'المشترى' : 'Bought'}</th><th>{ar ? 'المُرجع' : 'Returned'}</th><th>{ar ? 'في المخزون' : 'In stock'}</th><th>{ar ? 'سعر الشراء' : 'Cost'}</th><th>{ar ? 'كمية الإرجاع' : 'Return qty'}</th><th>{ar ? 'القيمة' : 'Value'}</th></tr></thead>
        <tbody>{source.lines.map(line => <tr key={line.purchaseLineId}>
          <td><strong>{ar ? line.itemNameAr : line.itemNameEn}</strong> {line.unitName && <small>({line.unitName})</small>}</td>
          <td><span dir="ltr">{line.batchNo ?? '—'}</span><br /><small className="muted-cell">{line.expiryDate?.slice(0, 10) ?? '—'}</small></td>
          <td className="numeric-cell">{quantity(line.purchasedQuantity)}</td>
          <td className="numeric-cell">{quantity(line.returnedQuantity)}</td>
          <td className="numeric-cell">{quantity(line.availableQuantity)}</td>
          <td className="numeric-cell">{money(line.unitCost)}</td>
          <td><FormField label="" error={errors[line.purchaseLineId]}><TextInput type="number" min="0" step="any" max={line.returnableQuantity} disabled={line.returnableQuantity <= 0} value={quantities[line.purchaseLineId] ?? ''} placeholder="0" onChange={event => setQuantities(current => ({ ...current, [line.purchaseLineId]: event.target.value }))} aria-label={`${ar ? 'كمية إرجاع' : 'Return quantity for'} ${ar ? line.itemNameAr : line.itemNameEn}`} /></FormField></td>
          <td className="numeric-cell">{money(enteredQuantity(quantities[line.purchaseLineId]) * line.unitCost)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
    <ReturnSummary ar={ar} currencySymbol={source.currencySymbol} returnDate={returnDate} onReturnDate={setReturnDate} reason={reason} onReason={setReason} refund={refund} error={error} saving={saving}
      saveLabel={source.requiresApproval ? (ar ? 'إرسال للموافقة' : 'Send for approval') : (ar ? 'حفظ المرتجع' : 'Save return')} onCancel={onCancel} onSave={review} />
    <ConfirmDialog open={confirming} busy={saving} title={ar ? 'تأكيد مرتجع الشراء' : 'Confirm purchase return'} message={effect}
      confirmLabel={ar ? 'تأكيد' : 'Confirm'} cancelLabel={ar ? 'رجوع' : 'Back'} closeLabel={ar ? 'إغلاق' : 'Close'} onCancel={() => setConfirming(false)} onConfirm={() => void save()} />
  </div>
}
