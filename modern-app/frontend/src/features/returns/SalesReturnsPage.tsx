import { useCallback, useState } from 'react'
import { Button, ErrorState, FilterChips, Money } from '../../components/shared'
import { DataTable, type TableColumn } from '../../components/DataTable'
import { datePresetOptions, inDatePreset, sumBy, type DatePreset } from '../../components/listFilters'
import { formatDay } from '../../app/formatters'
import { Icon } from '../../components/icons'
import { useLoadEffect } from '../../components/useLoadEffect'
import { PageHeader, type Locale } from '../../layouts/AppLayout'
import { InvoiceFinder } from './InvoiceFinder'
import { SalesReturnEditor, type SalesReturnSource, type Treasury } from './SalesReturnEditor'

type SalesReturnRow = { salesReturnId: number; returnNo: string; returnDate: string; saleNo: string; customerName?: string | null; treasuryNameAr?: string | null; treasuryNameEn?: string | null; currencySymbol: string; total: number; lineCount: number }

// Sales returns: the list of posted returns, and a new-return flow (choose invoice, then quantities).
export function SalesReturnsPage({ locale }: { locale: Locale }) {
  const ar = locale === 'ar'
  const [rows, setRows] = useState<SalesReturnRow[]>([])
  const [period, setPeriod] = useState<DatePreset>('all')
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
  const visible = rows.filter(row => inDatePreset(row.returnDate, period))
  const columns: Array<TableColumn<SalesReturnRow>> = [
    { key: 'returnNo', title: ar ? 'رقم المرتجع' : 'Return no.', value: row => row.returnNo, render: row => <span className="doc-no">{row.returnNo}</span> },
    { key: 'returnDate', title: ar ? 'التاريخ' : 'Date', value: row => row.returnDate, searchable: false, render: row => formatDay(row.returnDate) },
    { key: 'saleNo', title: ar ? 'فاتورة البيع' : 'Sales invoice', value: row => row.saleNo, render: row => <span className="doc-no">{row.saleNo}</span> },
    { key: 'customer', title: ar ? 'العميل' : 'Customer', value: row => row.customerName ?? '', wrap: true, render: row => row.customerName ?? <span className="muted-cell">{ar ? 'عميل نقدي' : 'Walk-in'}</span> },
    { key: 'treasury', title: ar ? 'الخزنة' : 'Treasury', value: row => (ar ? row.treasuryNameAr : row.treasuryNameEn) ?? '', searchable: false, render: row => (ar ? row.treasuryNameAr : row.treasuryNameEn) ?? <span className="muted-cell">{ar ? 'حساب العميل' : 'Customer account'}</span> },
    { key: 'lineCount', title: ar ? 'الأسطر' : 'Lines', value: row => row.lineCount, align: 'end', searchable: false },
    { key: 'total', title: ar ? 'المبلغ المرتجع' : 'Refund', value: row => row.total, align: 'end', searchable: false, render: row => <Money value={row.total} symbol={row.currencySymbol} /> },
  ]

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
    <PageHeader title={ar ? 'مرتجعات المبيعات' : 'Sales returns'} description={ar ? 'إرجاع أصناف من فاتورة بيع مرحّلة وصرف قيمتها من الخزنة.' : 'Return items from a posted sales invoice and refund them from a treasury.'}
      actions={<Button variant="primary" onClick={() => { setNotice(''); setError(''); setCreating(true) }}><Icon name="plus" size={18} />{ar ? 'مرتجع جديد' : 'New return'}</Button>} />
    {notice && <div className="form-success" role="status">{notice}</div>}
    {error && <ErrorState title={ar ? 'تعذر تنفيذ العملية' : 'Request failed'} detail={error} />}
    <DataTable
      locale={locale}
      columns={columns}
      rows={visible}
      rowKey={row => row.salesReturnId}
      loading={loading}
      density="compact"
      pageSize={15}
      searchLabel={ar ? 'بحث في المرتجعات' : 'Search returns'}
      searchPlaceholder={ar ? 'رقم المرتجع أو الفاتورة أو العميل' : 'Return no., invoice no. or customer'}
      filters={<FilterChips label={ar ? 'الفترة' : 'Period'} options={datePresetOptions(ar)} value={period} onChange={setPeriod} />}
      totals={list => [
        { key: 'count', label: ar ? 'المرتجعات' : 'Returns', value: list.length },
        { key: 'total', label: ar ? 'إجمالي المرتجع' : 'Total refunded', value: <Money value={sumBy(list, row => row.total)} symbol={list[0]?.currencySymbol} /> },
      ]}
      emptyTitle={rows.length ? (ar ? 'لا توجد نتائج' : 'No results') : (ar ? 'لا توجد مرتجعات مبيعات' : 'No sales returns yet')}
    />
  </div>
}
