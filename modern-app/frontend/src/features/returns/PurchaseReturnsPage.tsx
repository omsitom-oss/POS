import { useCallback, useState } from 'react'
import { Button, ErrorState, FilterChips, FormField, Modal, Money, StatusBadge } from '../../components/shared'
import { DataTable, type TableColumn } from '../../components/DataTable'
import { datePresetOptions, inDatePreset, sumBy, type DatePreset } from '../../components/listFilters'
import { formatDay } from '../../app/formatters'
import { Icon } from '../../components/icons'
import { useLoadEffect } from '../../components/useLoadEffect'
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
  const [period, setPeriod] = useState<DatePreset>('all')
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
  const inPeriod = rows.filter(row => inDatePreset(row.returnDate, period))
  const visible = inPeriod.filter(row => filter === 'ALL' || row.status === filter)
  const columns: Array<TableColumn<PurchaseReturnRow>> = [
    { key: 'returnNo', title: ar ? 'رقم المرتجع' : 'Return no.', value: row => row.returnNo, render: row => <span className="doc-no">{row.returnNo}</span> },
    { key: 'returnDate', title: ar ? 'التاريخ' : 'Date', value: row => row.returnDate, searchable: false, render: row => formatDay(row.returnDate) },
    { key: 'invoiceNo', title: ar ? 'فاتورة الشراء' : 'Purchase invoice', value: row => row.invoiceNo, render: row => <span className="doc-no">{row.invoiceNo}</span> },
    { key: 'supplierName', title: ar ? 'المورد' : 'Supplier', value: row => row.supplierName, wrap: true },
    { key: 'lineCount', title: ar ? 'الأسطر' : 'Lines', value: row => row.lineCount, align: 'end', searchable: false },
    { key: 'total', title: ar ? 'القيمة' : 'Amount', value: row => row.total, align: 'end', searchable: false, render: row => <Money value={row.total} symbol={row.currencySymbol} /> },
    { key: 'status', title: ar ? 'الحالة' : 'Status', value: row => row.status, searchable: false, wrap: true, render: row => <><StatusBadge tone={statusTones[row.status]}>{statusLabels[row.status][ar ? 0 : 1]}</StatusBadge>{row.reviewNote && <small className="muted-cell"> {row.reviewNote}</small>}</> },
  ]

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
    <PageHeader title={ar ? 'مرتجع شراء جديد' : 'New purchase return'} description={source ? undefined : (ar ? 'اختر فاتورة الشراء التي تُرجع أصنافها للمورد.' : 'Choose the purchase invoice whose items go back to the supplier.')}
      actions={<Button variant="secondary" onClick={() => source ? setSource(null) : close()}><Icon name="arrow-left" size={18} className="icon-flip-rtl" />{source ? (ar ? 'فاتورة أخرى' : 'Other invoice') : (ar ? 'العودة للمرتجعات' : 'Back to returns')}</Button>} />
    {error && <ErrorState title={ar ? 'تعذر تنفيذ العملية' : 'Request failed'} detail={error} />}
    {source
      ? <PurchaseReturnEditor key={source.purchaseId} ar={ar} source={source} onCancel={close} onSaved={(returnNo, status) => { close(); setNotice(`${ar ? 'تم حفظ المرتجع' : 'Return saved'}: ${returnNo}${status === 'PENDING' ? (ar ? ' (بانتظار الموافقة)' : ' (waiting for approval)') : ''}`); void load() }} />
      : <InvoiceFinder locale={locale} endpoint="/api/purchase-returns/invoices" partnerLabel={ar ? 'المورد' : 'Supplier'} onSelect={invoice => void choose(invoice.invoiceId)} />}
  </div>

  return <div className="settings-page" dir={ar ? 'rtl' : 'ltr'}>
    <PageHeader title={ar ? 'مرتجعات المشتريات' : 'Purchase returns'} description={ar ? 'إرجاع أصناف من فاتورة شراء مرحّلة إلى المورد، مع الموافقة عند تفعيلها.' : 'Return items from a posted purchase invoice to the supplier, with approval when it is switched on.'}
      actions={<Button variant="primary" onClick={() => { setNotice(''); setError(''); setCreating(true) }}><Icon name="plus" size={18} />{ar ? 'مرتجع جديد' : 'New return'}</Button>} />
    {notice && <div className="form-success" role="status">{notice}</div>}
    {error && <ErrorState title={ar ? 'تعذر تنفيذ العملية' : 'Request failed'} detail={error} />}
    <DataTable
      locale={locale}
      columns={columns}
      rows={visible}
      rowKey={row => row.purchaseReturnId}
      loading={loading}
      density="compact"
      pageSize={15}
      searchLabel={ar ? 'بحث في المرتجعات' : 'Search returns'}
      searchPlaceholder={ar ? 'رقم المرتجع أو الفاتورة أو المورد' : 'Return no., invoice no. or supplier'}
      filters={<>
        <FilterChips label={ar ? 'حالة المرتجع' : 'Return status'} value={filter} onChange={setFilter} options={[
          { value: 'ALL', label: ar ? 'الكل' : 'All', count: inPeriod.length },
          { value: 'PENDING', label: ar ? 'بانتظار الموافقة' : 'Pending', count: inPeriod.filter(row => row.status === 'PENDING').length },
          { value: 'POSTED', label: ar ? 'مرحّلة' : 'Posted', count: inPeriod.filter(row => row.status === 'POSTED').length },
          { value: 'REJECTED', label: ar ? 'مرفوضة' : 'Rejected', count: inPeriod.filter(row => row.status === 'REJECTED').length },
        ]} />
        <FilterChips label={ar ? 'الفترة' : 'Period'} options={datePresetOptions(ar)} value={period} onChange={setPeriod} />
      </>}
      totals={list => [
        { key: 'count', label: ar ? 'المرتجعات' : 'Returns', value: list.length },
        { key: 'total', label: ar ? 'القيمة' : 'Value', value: <Money value={sumBy(list, row => row.total)} symbol={list[0]?.currencySymbol} /> },
      ]}
      rowActions={row => row.status === 'PENDING' && canApprove ? <div className="inventory-row-actions">
        <Button size="small" variant="primary" onClick={() => { setNote(''); setReview({ row, action: 'approve' }) }}>{ar ? 'موافقة' : 'Approve'}</Button>
        <Button size="small" variant="danger" onClick={() => { setNote(''); setReview({ row, action: 'reject' }) }}>{ar ? 'رفض' : 'Reject'}</Button>
      </div> : null}
      emptyTitle={rows.length ? (ar ? 'لا توجد نتائج' : 'No results') : (ar ? 'لا توجد مرتجعات مشتريات' : 'No purchase returns yet')}
    />
    <Modal open={Boolean(review)} busy={reviewing} closeLabel={ar ? 'إغلاق' : 'Close'} onClose={() => setReview(null)}
      title={review?.action === 'approve' ? (ar ? 'الموافقة على المرتجع' : 'Approve return') : (ar ? 'رفض المرتجع' : 'Reject return')}
      description={review?.action === 'approve' ? (ar ? 'ستخرج الأصناف من المخزون ويقل رصيد المورد.' : 'The items leave stock and the supplier balance goes down.') : (ar ? 'تُحرر الكميات المحجوزة ولا يُرحّل شيء.' : 'The reserved quantities are released and nothing is posted.')}
      footer={<><Button variant="ghost" disabled={reviewing} onClick={() => setReview(null)}>{ar ? 'إلغاء' : 'Cancel'}</Button><Button variant={review?.action === 'approve' ? 'primary' : 'danger'} loading={reviewing} onClick={() => void submitReview()}>{review?.action === 'approve' ? (ar ? 'موافقة' : 'Approve') : (ar ? 'رفض' : 'Reject')}</Button></>}>
      <div className="settings-form"><p className="dialog-message">{review?.row.returnNo} · {review?.row.supplierName} · {review ? money(review.row.total) : ''} {review?.row.currencySymbol}</p><FormField label={ar ? 'ملاحظة' : 'Note'}><textarea className="text-input" rows={3} maxLength={500} value={note} onChange={event => setNote(event.target.value)} /></FormField></div>
    </Modal>
  </div>
}
