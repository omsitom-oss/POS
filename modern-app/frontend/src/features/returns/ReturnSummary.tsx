import type { ReactNode } from 'react'
import { Button, DateInput, FormField } from '../../components/shared'
import { Icon } from '../../components/icons'
import { money } from './returnModel'

// The side panel of both return editors: date, reason, refund breakdown and the save button.
export function ReturnSummary({ ar, currencySymbol, returnDate, onReturnDate, reason, onReason, refund, error, saving, saveLabel, onCancel, onSave, children }: {
  ar: boolean
  currencySymbol: string
  returnDate: string
  onReturnDate: (value: string) => void
  reason: string
  onReason: (value: string) => void
  refund: { gross: number; discount: number; net: number }
  error: string
  saving: boolean
  saveLabel: string
  onCancel: () => void
  onSave: () => void
  children?: ReactNode
}) {
  return <aside className="sales-summary-panel" aria-label={ar ? 'ملخص المرتجع' : 'Return summary'}>
    <div className="sales-panel-heading sales-summary-heading"><div><span className="sales-panel-icon" aria-hidden="true"><Icon name="document" size={20} /></span><h2>{ar ? 'بيانات المرتجع' : 'Return details'}</h2></div></div>
    <FormField label={ar ? 'تاريخ المرتجع' : 'Return date'} required><DateInput value={returnDate} onChange={event => onReturnDate(event.target.value)} /></FormField>
    {children}
    <FormField label={ar ? 'سبب الإرجاع' : 'Reason'}><textarea className="text-input" rows={3} maxLength={500} value={reason} onChange={event => onReason(event.target.value)} /></FormField>
    <div className="sales-summary-divider" />
    <dl className="sales-totals">
      <div><dt>{ar ? 'قيمة الأصناف' : 'Items value'}</dt><dd>{money(refund.gross)} {currencySymbol}</dd></div>
      <div><dt>{ar ? 'حصة خصم الفاتورة' : 'Invoice discount share'}</dt><dd>−{money(refund.discount)} {currencySymbol}</dd></div>
    </dl>
    <div className="sales-total-row"><strong>{ar ? 'صافي المرتجع' : 'Return total'}</strong><strong>{money(refund.net)} {currencySymbol}</strong></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="sales-summary-actions">
      <Button variant="secondary" disabled={saving} onClick={onCancel}>{ar ? 'إلغاء' : 'Cancel'}</Button>
      <Button variant="primary" loading={saving} onClick={onSave}><Icon name="save" size={18} />{saveLabel}</Button>
    </div>
  </aside>
}
