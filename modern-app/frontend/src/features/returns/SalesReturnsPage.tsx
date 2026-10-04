import { useCallback, useMemo, useState } from 'react'
import { Button, EmptyState, ErrorState, LoadingState, SearchInput, TableFooter, Money } from '../../components/shared'
import { Icon } from '../../components/icons'
import { useLoadEffect } from '../../components/useLoadEffect'
import { usePagination } from '../../components/usePagination'
import { PageHeader, type Locale } from '../../layouts/AppLayout'
import { InvoiceFinder } from './InvoiceFinder'
import { SalesReturnEditor, type SalesReturnSource, type Treasury } from './SalesReturnEditor'

type SalesReturnRow = { salesReturnId: number; returnNo: string; returnDate: string; saleNo: string; customerName?: string | null; treasuryNameAr?: string | null; treasuryNameEn?: string | null; currencySymbol: string; total: number; lineCount: number }

// Sales returns: the list of posted returns, and a new-return flow (choose invoice, then quantities).
export function SalesReturnsPage({ locale }: { locale: Locale }) {
  const ar = locale === 'ar'
  const [rows, setRows] = useState<SalesReturnRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [creating, setCreating] = useState(false)
  const [source, setSource] = useState<SalesReturnSource | null>(null)
  const [treasuries, setTreasuries] = useState<Treasury[]>([])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/sales-returns')
      if (!response.ok) throw new Error(ar ? 'تعذر تحميل المرتجعات.' : 'Could not load sales returns.')
      setRows(await response.json() as SalesReturnRow[])
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) } finally { setLoading(false) }
  }, [ar])
  useLoadEffect(load)
  const visible = useMemo(() => { const q = search.trim().toLocaleLowerCase(); return rows.filter(row => !q || [row.returnNo, row.saleNo, row.customerName ?? ''].some(value => value.toLocaleLowerCase().includes(q))) }, [rows, search])
  const page = usePagination(visible)

  async function choose(invoiceId: number) {
    setError('')
    try {
      const [sourceResponse, treasuryResponse] = await Promise.all([fetch(`/api/sales-returns/invoices/${invoiceId}`), fetch('/api/treasuries')])
      if (!sourceResponse.ok || !treasuryResponse.ok) throw new Error(ar ? 'تعذر تحميل الفاتورة.' : 'Could not load the invoice.')
      const invoice = await sourceResponse.json() as SalesReturnSource
      setTreasuries((await treasuryResponse.json() as Treasury[]).filter(item => item.isActive && item.currencyId === invoice.currencyId))
      setSource(invoice)
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
  }

  function close() { setCreating(false); setSource(null) }

  if (creating) return <div className="settings-page" dir={ar ? 'rtl' : 'ltr'}>
    <PageHeader eyebrow={ar ? 'المبيعات' : 'SALES'} title={ar ? 'مرتجع مبيعات جديد' : 'New sales return'} description={source ? undefined : (ar ? 'اختر فاتورة البيع التي تُرجع منها الأصناف.' : 'Choose the sales invoice the items come back from.')}
      actions={<Button variant="secondary" onClick={() => source ? setSource(null) : close()}><Icon name="arrow-left" size={18} className="icon-flip-rtl" />{source ? (ar ? 'فاتورة أخرى' : 'Other invoice') : (ar ? 'العودة للمرتجعات' : 'Back to returns')}</Button>} />
    {error && <ErrorState title={ar ? 'تعذر تنفيذ العملية' : 'Request failed'} detail={error} />}
    {source
      ? <SalesReturnEditor key={source.saleId} ar={ar} source={source} treasuries={treasuries} onCancel={close} onSaved={returnNo => { close(); setNotice(`${ar ? 'تم حفظ المرتجع' : 'Return saved'}: ${returnNo}`); void load() }} />
      : <InvoiceFinder locale={locale} endpoint="/api/sales-returns/invoices" partnerLabel={ar ? 'العميل' : 'Customer'} onSelect={invoice => void choose(invoice.invoiceId)} />}
  </div>

  return <div className="settings-page" dir={ar ? 'rtl' : 'ltr'}>
    <PageHeader eyebrow={ar ? 'المبيعات' : 'SALES'} title={ar ? 'مرتجعات المبيعات' : 'Sales returns'} description={ar ? 'إرجاع أصناف من فاتورة بيع مرحّلة وصرف قيمتها من الخزنة.' : 'Return items from a posted sales invoice and refund them from a treasury.'}
      actions={<Button variant="primary" onClick={() => { setNotice(''); setError(''); setCreating(true) }}><Icon name="plus" size={18} />{ar ? 'مرتجع جديد' : 'New return'}</Button>} />
    {notice && <div className="form-success" role="status">{notice}</div>}
    <section className="receipts-toolbar"><SearchInput aria-label={ar ? 'بحث في المرتجعات' : 'Search returns'} placeholder={ar ? 'رقم المرتجع أو الفاتورة أو العميل' : 'Return no., invoice no. or customer'} value={search} onChange={event => { setSearch(event.target.value); page.resetPage() }} /></section>
    {error && <ErrorState title={ar ? 'تعذر تنفيذ العملية' : 'Request failed'} detail={error} />}
    {loading ? <LoadingState /> : visible.length === 0 ? <EmptyState title={search ? (ar ? 'لا توجد نتائج' : 'No results') : (ar ? 'لا توجد مرتجعات مبيعات' : 'No sales returns yet')} /> : <div className="receipts-table-wrap"><table className="receipts-table">
      <thead><tr><th>{ar ? 'رقم المرتجع' : 'Return no.'}</th><th>{ar ? 'التاريخ' : 'Date'}</th><th>{ar ? 'فاتورة البيع' : 'Sales invoice'}</th><th>{ar ? 'العميل' : 'Customer'}</th><th>{ar ? 'الخزنة' : 'Treasury'}</th><th className="num-cell">{ar ? 'الأسطر' : 'Lines'}</th><th className="num-cell">{ar ? 'المبلغ المرتجع' : 'Refund'}</th></tr></thead>
      <tbody>{page.rows.map(row => <tr key={row.salesReturnId}>
        <td><code>{row.returnNo}</code></td>
        <td>{row.returnDate.slice(0, 10)}</td>
        <td><code>{row.saleNo}</code></td>
        <td>{row.customerName ?? <span className="muted-cell">{ar ? 'بيع مباشر' : 'Walk-in'}</span>}</td>
        <td>{(ar ? row.treasuryNameAr : row.treasuryNameEn) ?? <span className="muted-cell">{ar ? 'حساب العميل' : 'Customer account'}</span>}</td>
        <td className="numeric-cell">{row.lineCount}</td>
        <td className="numeric-cell"><Money value={row.total} symbol={row.currencySymbol} /></td>
      </tr>)}</tbody>
    </table><TableFooter total={visible.length} locale={locale} pager={page.pager} /></div>}
  </div>
}
