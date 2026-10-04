import { useCallback, useMemo, useState } from 'react'
import { Button, EmptyState, ErrorState, FormField, LoadingState, Modal, SearchInput, StatusBadge, TableFooter, Tabs, Money } from '../../components/shared'
import { Icon } from '../../components/icons'
import { useLoadEffect } from '../../components/useLoadEffect'
import { usePagination } from '../../components/usePagination'
import { PageHeader, type Locale } from '../../layouts/AppLayout'
import { InvoiceFinder } from './InvoiceFinder'
import { PurchaseReturnEditor, type PurchaseReturnSource } from './PurchaseReturnEditor'
import { money } from './returnModel'

type Status = 'PENDING' | 'POSTED' | 'REJECTED'
type PurchaseReturnRow = { purchaseReturnId: number; returnNo: string; returnDate: string; invoiceNo: string; supplierName: string; currencySymbol: string; total: number; lineCount: number; status: Status; reviewNote?: string | null }

const statusLabels: Record<Status, [string, string]> = { PENDING: ['بانتظار الموافقة', 'Pending approval'], POSTED: ['مرحّل', 'Posted'], REJECTED: ['مرفوض', 'Rejected'] }
const statusTones: Record<Status, 'warning' | 'success' | 'danger'> = { PENDING: 'warning', POSTED: 'success', REJECTED: 'danger' }

// Purchase returns: list with approval actions, and a new-return flow (choose invoice, then quantities per batch).
export function PurchaseReturnsPage({ locale, canApprove }: { locale: Locale; canApprove: boolean }) {
  const ar = locale === 'ar'
  const [rows, setRows] = useState<PurchaseReturnRow[]>([])
  const [filter, setFilter] = useState<'ALL' | Status>('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [creating, setCreating] = useState(false)
  const [source, setSource] = useState<PurchaseReturnSource | null>(null)
  const [review, setReview] = useState<{ row: PurchaseReturnRow; action: 'approve' | 'reject' } | null>(null)
  const [note, setNote] = useState('')
  const [reviewing, setReviewing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/purchase-returns')
      if (!response.ok) throw new Error(ar ? 'تعذر تحميل مرتجعات الشراء.' : 'Could not load purchase returns.')
      setRows(await response.json() as PurchaseReturnRow[])
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) } finally { setLoading(false) }
  }, [ar])
  useLoadEffect(load)
  const visible = useMemo(() => { const q = search.trim().toLocaleLowerCase(); return rows.filter(row => (filter === 'ALL' || row.status === filter) && (!q || [row.returnNo, row.invoiceNo, row.supplierName].some(value => value.toLocaleLowerCase().includes(q)))) }, [rows, search, filter])
  const page = usePagination(visible)
  const pendingCount = rows.filter(row => row.status === 'PENDING').length

  async function choose(invoiceId: number) {
    setError('')
    try {
      const response = await fetch(`/api/purchase-returns/invoices/${invoiceId}`)
      if (!response.ok) throw new Error(ar ? 'تعذر تحميل الفاتورة.' : 'Could not load the invoice.')
      setSource(await response.json() as PurchaseReturnSource)
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
  }

  async function submitReview() {
    if (!review) return
    setReviewing(true); setError('')
    try {
      const response = await fetch(`/api/purchase-returns/${review.row.purchaseReturnId}/${review.action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: note.trim() || null }) })
      if (!response.ok) { const problem = await response.json().catch(() => null) as { detail?: string } | null; throw new Error(problem?.detail ?? (ar ? 'تعذر تنفيذ العملية.' : 'The request failed.')) }
      setNotice(`${review.row.returnNo}: ${review.action === 'approve' ? (ar ? 'تمت الموافقة والترحيل' : 'approved and posted') : (ar ? 'تم الرفض' : 'rejected')}`)
      setReview(null); setNote('')
      await load()
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); setReview(null) } finally { setReviewing(false) }
  }

  function close() { setCreating(false); setSource(null) }

  if (creating) return <div className="settings-page" dir={ar ? 'rtl' : 'ltr'}>
    <PageHeader eyebrow={ar ? 'المشتريات' : 'PURCHASES'} title={ar ? 'مرتجع شراء جديد' : 'New purchase return'} description={source ? undefined : (ar ? 'اختر فاتورة الشراء التي تُرجع أصنافها للمورد.' : 'Choose the purchase invoice whose items go back to the supplier.')}
      actions={<Button variant="secondary" onClick={() => source ? setSource(null) : close()}><Icon name="arrow-left" size={18} className="icon-flip-rtl" />{source ? (ar ? 'فاتورة أخرى' : 'Other invoice') : (ar ? 'العودة للمرتجعات' : 'Back to returns')}</Button>} />
    {error && <ErrorState title={ar ? 'تعذر تنفيذ العملية' : 'Request failed'} detail={error} />}
    {source
      ? <PurchaseReturnEditor key={source.purchaseId} ar={ar} source={source} onCancel={close} onSaved={(returnNo, status) => { close(); setNotice(`${ar ? 'تم حفظ المرتجع' : 'Return saved'}: ${returnNo}${status === 'PENDING' ? (ar ? ' (بانتظار الموافقة)' : ' (waiting for approval)') : ''}`); void load() }} />
      : <InvoiceFinder locale={locale} endpoint="/api/purchase-returns/invoices" partnerLabel={ar ? 'المورد' : 'Supplier'} onSelect={invoice => void choose(invoice.invoiceId)} />}
  </div>

  return <div className="settings-page" dir={ar ? 'rtl' : 'ltr'}>
    <PageHeader eyebrow={ar ? 'المشتريات' : 'PURCHASES'} title={ar ? 'مرتجعات المشتريات' : 'Purchase returns'} description={ar ? 'إرجاع أصناف من فاتورة شراء مرحّلة إلى المورد، مع الموافقة عند تفعيلها.' : 'Return items from a posted purchase invoice to the supplier, with approval when it is switched on.'}
      actions={<Button variant="primary" onClick={() => { setNotice(''); setError(''); setCreating(true) }}><Icon name="plus" size={18} />{ar ? 'مرتجع جديد' : 'New return'}</Button>} />
    {notice && <div className="form-success" role="status">{notice}</div>}
    <Tabs value={filter} onChange={id => { setFilter(id as 'ALL' | Status); page.resetPage() }} tabs={[
      { id: 'ALL', label: ar ? 'الكل' : 'All' },
      { id: 'PENDING', label: `${ar ? 'بانتظار الموافقة' : 'Pending'}${pendingCount ? ` (${pendingCount})` : ''}` },
      { id: 'POSTED', label: ar ? 'مرحّلة' : 'Posted' },
      { id: 'REJECTED', label: ar ? 'مرفوضة' : 'Rejected' },
    ]} />
    <section className="receipts-toolbar"><SearchInput aria-label={ar ? 'بحث في المرتجعات' : 'Search returns'} placeholder={ar ? 'رقم المرتجع أو الفاتورة أو المورد' : 'Return no., invoice no. or supplier'} value={search} onChange={event => { setSearch(event.target.value); page.resetPage() }} /></section>
    {error && <ErrorState title={ar ? 'تعذر تنفيذ العملية' : 'Request failed'} detail={error} />}
    {loading ? <LoadingState /> : visible.length === 0 ? <EmptyState title={search || filter !== 'ALL' ? (ar ? 'لا توجد نتائج' : 'No results') : (ar ? 'لا توجد مرتجعات مشتريات' : 'No purchase returns yet')} /> : <div className="receipts-table-wrap"><table className="receipts-table">
      <thead><tr><th>{ar ? 'رقم المرتجع' : 'Return no.'}</th><th>{ar ? 'التاريخ' : 'Date'}</th><th>{ar ? 'فاتورة الشراء' : 'Purchase invoice'}</th><th>{ar ? 'المورد' : 'Supplier'}</th><th className="num-cell">{ar ? 'الأسطر' : 'Lines'}</th><th className="num-cell">{ar ? 'القيمة' : 'Amount'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th aria-label={ar ? 'إجراءات' : 'Actions'} /></tr></thead>
      <tbody>{page.rows.map(row => <tr key={row.purchaseReturnId}>
        <td><code>{row.returnNo}</code></td>
        <td>{row.returnDate.slice(0, 10)}</td>
        <td><code>{row.invoiceNo}</code></td>
        <td>{row.supplierName}</td>
        <td className="numeric-cell">{row.lineCount}</td>
        <td className="numeric-cell"><Money value={row.total} symbol={row.currencySymbol} /></td>
        <td><StatusBadge tone={statusTones[row.status]}>{statusLabels[row.status][ar ? 0 : 1]}</StatusBadge>{row.reviewNote && <small className="muted-cell"> {row.reviewNote}</small>}</td>
        <td>{row.status === 'PENDING' && canApprove && <div className="inventory-row-actions">
          <Button size="small" variant="primary" onClick={() => { setNote(''); setReview({ row, action: 'approve' }) }}>{ar ? 'موافقة' : 'Approve'}</Button>
          <Button size="small" variant="danger" onClick={() => { setNote(''); setReview({ row, action: 'reject' }) }}>{ar ? 'رفض' : 'Reject'}</Button>
        </div>}</td>
      </tr>)}</tbody>
    </table><TableFooter total={visible.length} locale={locale} pager={page.pager} /></div>}
    <Modal open={Boolean(review)} busy={reviewing} closeLabel={ar ? 'إغلاق' : 'Close'} onClose={() => setReview(null)}
      title={review?.action === 'approve' ? (ar ? 'الموافقة على المرتجع' : 'Approve return') : (ar ? 'رفض المرتجع' : 'Reject return')}
      description={review?.action === 'approve' ? (ar ? 'ستخرج الأصناف من المخزون ويقل رصيد المورد.' : 'The items leave stock and the supplier balance goes down.') : (ar ? 'تُحرر الكميات المحجوزة ولا يُرحّل شيء.' : 'The reserved quantities are released and nothing is posted.')}
      footer={<><Button variant="ghost" disabled={reviewing} onClick={() => setReview(null)}>{ar ? 'إلغاء' : 'Cancel'}</Button><Button variant={review?.action === 'approve' ? 'primary' : 'danger'} loading={reviewing} onClick={() => void submitReview()}>{review?.action === 'approve' ? (ar ? 'موافقة' : 'Approve') : (ar ? 'رفض' : 'Reject')}</Button></>}>
      <div className="settings-form"><p className="dialog-message">{review?.row.returnNo} · {review?.row.supplierName} · {review ? money(review.row.total) : ''} {review?.row.currencySymbol}</p><FormField label={ar ? 'ملاحظة' : 'Note'}><textarea className="text-input" rows={3} maxLength={500} value={note} onChange={event => setNote(event.target.value)} /></FormField></div>
    </Modal>
  </div>
}
