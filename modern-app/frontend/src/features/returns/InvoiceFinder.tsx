import { useCallback, useState } from 'react'
import { Button, DateInput, EmptyState, ErrorState, FormField, LoadingState, SearchInput, TableFooter, Money } from '../../components/shared'
import { useLoadEffect } from '../../components/useLoadEffect'
import { usePagination } from '../../components/usePagination'
import type { Locale } from '../../layouts/AppLayout'
import { type ReturnableInvoice } from './returnModel'

// Lists invoices that still have something to return, filtered by invoice number, partner or item and by date.
export function InvoiceFinder({ locale, endpoint, partnerLabel, onSelect }: { locale: Locale; endpoint: string; partnerLabel: string; onSelect: (invoice: ReturnableInvoice) => void }) {
  const ar = locale === 'ar'
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [query, setQuery] = useState({ search: '', from: '', to: '' })
  const [rows, setRows] = useState<ReturnableInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (query.search.trim()) params.set('search', query.search.trim())
      if (query.from) params.set('from', query.from)
      if (query.to) params.set('to', query.to)
      const queryString = params.toString()
      const response = await fetch(queryString ? `${endpoint}?${queryString}` : endpoint)
      if (!response.ok) throw new Error(ar ? 'تعذر تحميل الفواتير.' : 'Could not load invoices.')
      setRows(await response.json() as ReturnableInvoice[])
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) } finally { setLoading(false) }
  }, [endpoint, query, ar])
  useLoadEffect(load)
  const page = usePagination(rows)

  return <section aria-label={ar ? 'اختيار الفاتورة' : 'Choose invoice'}>
    <form className="receipts-toolbar" onSubmit={event => { event.preventDefault(); setQuery({ search, from, to }); page.resetPage() }}>
      <SearchInput aria-label={ar ? 'بحث في الفواتير' : 'Search invoices'} placeholder={ar ? `رقم الفاتورة أو ${partnerLabel} أو الصنف` : `Invoice no., ${partnerLabel.toLocaleLowerCase()} or item`} value={search} onChange={event => setSearch(event.target.value)} />
      <FormField label={ar ? 'من' : 'From'}><DateInput value={from} onChange={event => setFrom(event.target.value)} /></FormField>
      <FormField label={ar ? 'إلى' : 'To'}><DateInput value={to} onChange={event => setTo(event.target.value)} /></FormField>
      <Button type="submit" variant="secondary">{ar ? 'تحديث' : 'Refresh'}</Button>
    </form>
    {error && <ErrorState title={ar ? 'تعذر تنفيذ العملية' : 'Request failed'} detail={error} />}
    {loading ? <LoadingState /> : rows.length === 0 ? <EmptyState title={ar ? 'لا توجد فواتير قابلة للإرجاع' : 'No invoices to return'} detail={ar ? 'تظهر هنا الفواتير المرحّلة التي لم تُرجع بالكامل.' : 'Posted invoices that are not fully returned appear here.'} /> : <div className="receipts-table-wrap"><table className="receipts-table">
      <thead><tr><th>{ar ? 'رقم الفاتورة' : 'Invoice no.'}</th><th>{ar ? 'التاريخ' : 'Date'}</th><th>{partnerLabel}</th><th className="num-cell">{ar ? 'الإجمالي' : 'Total'}</th><th className="num-cell">{ar ? 'المُرجع' : 'Returned'}</th><th aria-label={ar ? 'إجراءات' : 'Actions'} /></tr></thead>
      <tbody>{page.rows.map(invoice => <tr key={invoice.invoiceId}>
        <td><code>{invoice.invoiceNo}</code></td>
        <td>{invoice.invoiceDate.slice(0, 10)}</td>
        <td>{invoice.partnerName ?? <span className="muted-cell">{ar ? 'بيع مباشر' : 'Walk-in'}</span>}</td>
        <td className="numeric-cell"><Money value={invoice.total} symbol={invoice.currencySymbol} /></td>
        <td className="numeric-cell"><Money value={invoice.returnedTotal} symbol={invoice.currencySymbol} /></td>
        <td><Button size="small" variant="outline" onClick={() => onSelect(invoice)}>{ar ? 'إرجاع من هذه الفاتورة' : 'Return from this invoice'}</Button></td>
      </tr>)}</tbody>
    </table><TableFooter total={rows.length} locale={locale} pager={page.pager} /></div>}
  </section>
}
