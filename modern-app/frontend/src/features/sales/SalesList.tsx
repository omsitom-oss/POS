import { useEffect, useMemo, useState } from 'react'
import { DataTable, type TableColumn } from '../../components/DataTable'
import { DetailList, DetailPanel, FilterChips, LoadingState, Money, StatusBadge } from '../../components/shared'
import { datePresetOptions, inDatePreset, sumBy, type DatePreset } from '../../components/listFilters'
import { formatDay, formatNumber } from '../../app/formatters'

export type SaleRow = { saleId: number; saleNo: string; saleDate: string; total: number; currencySymbol: string; customerName?: string | null; treasuryName?: string | null; lineCount?: number }
type SaleDetail = { saleId: number; saleNo: string; saleDate: string; customerName?: string | null; currencySymbol: string; subtotal: number; discount: number; total: number; returnedTotal: number; lines: Array<{ saleLineId: number; itemNameAr: string; itemNameEn: string; soldQuantity: number; returnedQuantity: number; unitPrice: number }> }
type SaleType = 'all' | 'direct' | 'account'

export function SalesList({ ar, rows }: { ar: boolean; rows: SaleRow[] }) {
  const [period, setPeriod] = useState<DatePreset>('all')
  const [type, setType] = useState<SaleType>('all')
  const [selected, setSelected] = useState<SaleRow | null>(null)
  const [detail, setDetail] = useState<SaleDetail | null>(null)
  const [detailState, setDetailState] = useState<'idle' | 'loading' | 'error'>('idle')

  const visible = useMemo(() => rows.filter(row => inDatePreset(row.saleDate, period) && (type === 'all' || (type === 'account') === Boolean(row.customerName))), [period, rows, type])
  const symbol = rows[0]?.currencySymbol ?? ''

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    fetch(`/api/sales/${selected.saleId}`)
      .then(async response => { if (!response.ok) throw new Error('detail'); return await response.json() as SaleDetail })
      .then(result => { if (!cancelled) { setDetail(result); setDetailState('idle') } })
      .catch(() => { if (!cancelled) setDetailState('error') })
    return () => { cancelled = true }
  }, [selected])

  function select(row: SaleRow) {
    if (selected?.saleId === row.saleId) { setSelected(null); return }
    setDetail(null)
    setDetailState('loading')
    setSelected(row)
  }

  const columns: Array<TableColumn<SaleRow>> = [
    { key: 'saleNo', title: ar ? 'الفاتورة' : 'Invoice', value: row => row.saleNo, render: row => <span className="doc-no">{row.saleNo}</span> },
    { key: 'saleDate', title: ar ? 'التاريخ' : 'Date', value: row => row.saleDate, render: row => formatDay(row.saleDate), searchable: false },
    { key: 'type', title: ar ? 'النوع' : 'Type', value: row => row.customerName ? 1 : 0, searchable: false, render: row => <StatusBadge tone={row.customerName ? 'info' : 'neutral'}>{row.customerName ? (ar ? 'آجل' : 'On account') : (ar ? 'مباشر' : 'Direct')}</StatusBadge> },
    { key: 'customer', title: ar ? 'العميل' : 'Customer', value: row => row.customerName ?? '', wrap: true, render: row => row.customerName ?? <span className="muted-cell">{ar ? 'عميل نقدي' : 'Walk-in'}</span> },
    { key: 'lines', title: ar ? 'الأصناف' : 'Items', value: row => row.lineCount ?? 0, align: 'end', searchable: false },
    { key: 'total', title: ar ? 'الإجمالي' : 'Total', value: row => row.total, align: 'end', searchable: false, render: row => <Money value={row.total} symbol={row.currencySymbol} /> },
  ]

  const panel = selected && <DetailPanel
    title={<span className="doc-no">{selected.saleNo}</span>}
    badge={<StatusBadge tone={selected.customerName ? 'info' : 'neutral'}>{selected.customerName ? (ar ? 'آجل' : 'On account') : (ar ? 'مباشر' : 'Direct')}</StatusBadge>}
    closeLabel={ar ? 'إغلاق' : 'Close'}
    onClose={() => setSelected(null)}>
    <DetailList items={[
      { label: ar ? 'التاريخ' : 'Date', value: formatDay(selected.saleDate) },
      { label: ar ? 'العميل' : 'Customer', value: selected.customerName ?? (ar ? 'عميل نقدي' : 'Walk-in') },
      selected.treasuryName ? { label: ar ? 'الخزنة' : 'Treasury', value: selected.treasuryName } : null,
    ]} />
    {detailState === 'loading' && <LoadingState label={ar ? 'جارٍ التحميل…' : 'Loading…'} />}
    {detailState === 'error' && <p className="field-hint" role="status">{ar ? 'تعذر تحميل أسطر الفاتورة.' : 'Could not load the invoice lines.'}</p>}
    {detail && <>
      <h3 className="detail-section-title">{ar ? 'الأصناف' : 'Items'}</h3>
      <ul className="detail-lines">{detail.lines.map(line => <li key={line.saleLineId}><span>{ar ? line.itemNameAr : line.itemNameEn} <small>× {formatNumber(line.soldQuantity, 'en', 3)}</small>{line.returnedQuantity > 0 && <small> · {ar ? 'مرتجع' : 'returned'} {formatNumber(line.returnedQuantity, 'en', 3)}</small>}</span><Money value={line.soldQuantity * line.unitPrice} /></li>)}</ul>
      <DetailList items={[
        { label: ar ? 'المجموع الفرعي' : 'Subtotal', value: <Money value={detail.subtotal} symbol={detail.currencySymbol} /> },
        detail.discount > 0 ? { label: ar ? 'الخصم' : 'Discount', value: <Money value={detail.discount} symbol={detail.currencySymbol} /> } : null,
        { label: ar ? 'الإجمالي' : 'Total', value: <Money value={detail.total} symbol={detail.currencySymbol} />, strong: true },
        detail.returnedTotal > 0 ? { label: ar ? 'المرتجع' : 'Returned', value: <Money value={detail.returnedTotal} symbol={detail.currencySymbol} /> } : null,
      ]} />
    </>}
  </DetailPanel>

  return <DataTable
    locale={ar ? 'ar' : 'en'}
    columns={columns}
    rows={visible}
    rowKey={row => row.saleId ?? row.saleNo}
    density="compact"
    pageSize={15}
    searchPlaceholder={ar ? 'رقم الفاتورة أو العميل' : 'Invoice or customer'}
    searchLabel={ar ? 'بحث في فواتير البيع' : 'Search sales invoices'}
    filters={<>
      <FilterChips label={ar ? 'الفترة' : 'Period'} options={datePresetOptions(ar)} value={period} onChange={setPeriod} />
      <FilterChips label={ar ? 'نوع البيع' : 'Sale type'} options={[{ value: 'all', label: ar ? 'الكل' : 'All' }, { value: 'direct', label: ar ? 'مباشر' : 'Direct' }, { value: 'account', label: ar ? 'آجل' : 'On account' }]} value={type} onChange={setType} />
    </>}
    totals={list => [
      { key: 'count', label: ar ? 'الفواتير' : 'Invoices', value: formatNumber(list.length, 'en', 0) },
      { key: 'total', label: ar ? 'الإجمالي' : 'Total', value: <Money value={sumBy(list, row => row.total)} symbol={symbol} /> },
      { key: 'account', label: ar ? 'آجل' : 'On account', value: <Money value={sumBy(list.filter(row => row.customerName), row => row.total)} symbol={symbol} /> },
    ]}
    activeRowKey={selected ? selected.saleId : null}
    onRowSelect={select}
    panel={panel}
    emptyTitle={rows.length ? (ar ? 'لا توجد فواتير مطابقة' : 'No matching invoices') : (ar ? 'لا توجد فواتير بيع.' : 'No sales invoices yet.')}
    emptyDetail={rows.length ? (ar ? 'جرّب فترة أخرى أو نوع بيع آخر.' : 'Try another period or sale type.') : undefined}
  />
}
