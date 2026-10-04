import { useEffect, useState, type ReactNode } from 'react'
import { Button, Card, DateInput, EmptyState, ErrorState, FilterChips, LoadingState, Select, StatusBadge } from '../../components/shared'
import { Icon, type IconName } from '../../components/icons'
import { PageHeader, type Locale } from '../../layouts/AppLayout'
import { formatDay, formatMoney, formatNumber } from '../../app/formatters'
import { bucketDays, netSales, niceMax, percentChange, periodOptions, periodRange, reportCsv, type Bucket, type Period, type ReportOverview } from './reportModel'

type Branch = { branchId: number; nameAr: string; nameEn: string; isActive?: boolean }
type Currency = { symbol: string; isPrimary: boolean }

export function ReportsPage({ locale, canAllBranches = false, branchName = '' }: { locale: Locale; canAllBranches?: boolean; branchName?: string }) {
  const ar = locale === 'ar'
  const [period, setPeriod] = useState<Period>('30d')
  const [custom, setCustom] = useState(() => periodRange('30d'))
  const [branchId, setBranchId] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [symbol, setSymbol] = useState('')
  const [report, setReport] = useState<ReportOverview | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const range = period === 'custom' ? custom : periodRange(period)

  useEffect(() => {
    if (canAllBranches) fetch('/api/branches').then(r => r.ok ? r.json() as Promise<Branch[]> : []).then(rows => setBranches(rows.filter(row => row.isActive !== false))).catch(() => undefined)
    fetch('/api/currencies').then(r => r.ok ? r.json() as Promise<Currency[]> : []).then(rows => setSymbol(rows.find(row => row.isPrimary)?.symbol ?? '')).catch(() => undefined)
  }, [canAllBranches])

  useEffect(() => {
    let cancelled = false
    const query = new URLSearchParams({ from: range.from, to: range.to })
    if (branchId) query.set('branchId', branchId)
    fetch(`/api/reports/overview?${query}`)
      .then(async response => { if (!response.ok) throw new Error('load'); return await response.json() as ReportOverview })
      .then(result => { if (!cancelled) { setReport(result); setState('ready') } })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [range.from, range.to, branchId])

  const t = ar ? copy.ar : copy.en
  const selectedBranch = branches.find(row => String(row.branchId) === branchId)
  const scopeName = selectedBranch ? (ar ? selectedBranch.nameAr : selectedBranch.nameEn) : canAllBranches ? t.allBranches : branchName
  const days = range.from === range.to ? 1 : Math.round((new Date(`${range.to}T12:00:00`).getTime() - new Date(`${range.from}T12:00:00`).getTime()) / 86400000) + 1
  const comparedTo = days === 1 ? t.vsPreviousDay : t.vsPreviousDays(days)

  function choose(next: Period) { setState('loading'); if (next === 'custom' && period !== 'custom') setCustom(range); setPeriod(next) }
  function exportCsv() {
    if (!report) return
    const url = URL.createObjectURL(new Blob([reportCsv(report, ar, scopeName)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `report-${range.from}-${range.to}.csv`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  // The page prints itself (not a dialog), so lift the dialog-only print rule while it does.
  function print() {
    document.documentElement.classList.add('printing-report')
    const done = () => { document.documentElement.classList.remove('printing-report'); window.removeEventListener('afterprint', done) }
    window.addEventListener('afterprint', done)
    window.print()
  }

  return <div className="reports-page">
    <PageHeader
      title={t.title}
      description={<><bdi dir="ltr">{formatDay(range.from)}{range.from !== range.to && <> – {formatDay(range.to)}</>}</bdi> · {scopeName}</>}
      actions={<div className="report-actions"><Button variant="secondary" onClick={exportCsv} disabled={!report}><Icon name="download" size={18} />{t.export}</Button><Button variant="secondary" onClick={print} disabled={!report}><Icon name="print" size={18} />{t.print}</Button></div>} />

    <div className="report-filters">
      <FilterChips label={t.period} options={periodOptions(ar)} value={period} onChange={choose} />
      {period === 'custom' && <div className="report-range">
        <DateInput aria-label={t.from} value={custom.from} max={custom.to} onChange={event => { if (event.target.value) { setState('loading'); setCustom(current => ({ ...current, from: event.target.value })) } }} />
        <span aria-hidden="true">–</span>
        <DateInput aria-label={t.to} value={custom.to} min={custom.from} onChange={event => { if (event.target.value) { setState('loading'); setCustom(current => ({ ...current, to: event.target.value })) } }} />
      </div>}
      {canAllBranches && branches.length > 1 && <div className="report-branch"><Icon name="city" size={18} /><Select aria-label={t.branch} value={branchId} onChange={event => { setState('loading'); setBranchId(event.target.value) }}>
        <option value="">{t.allBranches}</option>
        {branches.map(row => <option key={row.branchId} value={String(row.branchId)}>{ar ? row.nameAr : row.nameEn}</option>)}
      </Select></div>}
    </div>

    {state === 'error' && <ErrorState title={t.loadError} detail={t.loadErrorDetail} />}
    {state === 'loading' && !report && <LoadingState label={t.loading} />}
    {report && state !== 'error' && <ReportBody report={report} ar={ar} symbol={symbol} comparedTo={comparedTo} busy={state === 'loading'} showBranches={canAllBranches && !branchId} />}
  </div>
}

function ReportBody({ report, ar, symbol, comparedTo, busy, showBranches }: { report: ReportOverview; ar: boolean; symbol: string; comparedTo: string; busy: boolean; showBranches: boolean }) {
  const t = ar ? copy.ar : copy.en
  const s = report.summary, p = report.previous
  const net = netSales(s), cost = net - s.grossMargin, netProfit = s.grossMargin - s.expensesTotal
  const marginRate = net ? s.grossMargin / net * 100 : null
  const average = s.salesCount ? net / s.salesCount : 0
  const money = (value: number) => formatMoney(value, symbol)

  return <div className={`report-body${busy ? ' is-busy' : ''}`} aria-busy={busy}>
    <div className="report-kpis">
      <Kpi icon="sales" tone="primary" label={t.netSales} value={money(net)} change={percentChange(net, netSales(p))} note={comparedTo} />
      <Kpi icon="coins" tone="success" label={t.grossProfit} value={money(s.grossMargin)} change={percentChange(s.grossMargin, p.grossMargin)} note={comparedTo} badge={marginRate === null ? undefined : `${formatNumber(marginRate, 'en', 1)}% ${t.margin}`} />
      <Kpi icon="wallet" tone={netProfit < 0 ? 'danger' : 'info'} label={t.netProfit} value={money(netProfit)} change={percentChange(netProfit, p.grossMargin - p.expensesTotal)} note={comparedTo} />
      <Kpi icon="document" tone="warning" label={t.invoices} value={formatNumber(s.salesCount, 'en', 0)} change={percentChange(s.salesCount, p.salesCount)} note={comparedTo} footer={<>{t.averageInvoice} <bdi dir="ltr">{money(average)}</bdi></>} />
    </div>

    <div className="report-row report-row-wide">
      <Card className="report-panel">
        <PanelHead title={t.trend} aside={<div className="chart-legend"><span><i className="legend-swatch is-sales" />{t.netSales}</span><span><i className="legend-swatch is-profit" />{t.grossProfit}</span></div>} />
        <TrendChart buckets={bucketDays(report.days)} ar={ar} symbol={symbol} />
      </Card>
      <Card className="report-panel">
        <PanelHead title={t.profitAndLoss} />
        <ul className="pl-list">
          <PlRow label={t.sales} value={s.salesTotal} base={s.salesTotal} money={money} />
          <PlRow label={t.salesReturns} value={-s.salesReturnsTotal} base={s.salesTotal} money={money} />
          <PlRow label={t.costOfGoods} value={-cost} base={s.salesTotal} money={money} />
          <PlRow label={t.grossProfit} value={s.grossMargin} base={s.salesTotal} money={money} total />
          <PlRow label={t.expenses} value={-s.expensesTotal} base={s.salesTotal} money={money} />
          <PlRow label={t.netProfit} value={netProfit} base={s.salesTotal} money={money} total grand />
        </ul>
      </Card>
    </div>

    <div className="report-row report-row-wide">
      <Card className="report-panel">
        <PanelHead title={t.topItems} aside={<span className="panel-note">{t.topItemsNote}</span>} />
        {report.topItems.length ? <div className="report-table-wrap"><table className="data-table report-table">
          <thead><tr><th className="rank-cell">#</th><th>{t.item}</th><th className="align-end">{t.quantity}</th><th className="align-end">{t.sales}</th><th className="align-end">{t.profit}</th><th className="align-end">{t.margin}</th></tr></thead>
          <tbody>{report.topItems.map((item, index) => {
            const profit = item.revenue - item.cost, rate = item.revenue ? profit / item.revenue * 100 : 0
            return <tr key={item.itemId}>
              <td className="rank-cell"><span className="rank-mark">{index + 1}</span></td>
              <td><div className="item-cell"><strong>{ar ? item.nameAr : item.nameEn}</strong><span className="item-share"><span style={{ inlineSize: `${Math.max(item.revenue / report.topItems[0].revenue * 100, 2)}%` }} /></span></div></td>
              <td className="align-end num-cell">{formatNumber(item.quantity, 'en', 2)}</td>
              <td className="align-end num-cell"><bdi dir="ltr">{formatMoney(item.revenue)}</bdi></td>
              <td className="align-end num-cell"><bdi dir="ltr">{formatMoney(profit)}</bdi></td>
              <td className="align-end"><StatusBadge tone={rate < 0 ? 'danger' : rate < 15 ? 'warning' : 'success'}>{formatNumber(rate, 'en', 1)}%</StatusBadge></td>
            </tr>
          })}</tbody>
        </table></div> : <EmptyState title={t.noSales} detail={t.noSalesDetail} />}
      </Card>
      <div className="report-stack">
        <Card className="report-panel">
          <PanelHead title={t.howPaid} />
          <PaymentSplit report={report} ar={ar} money={money} />
        </Card>
        <Card className="report-panel">
          <PanelHead title={t.moneyFlow} />
          <dl className="flow-list">
            <FlowRow icon="history" label={t.receipts} value={money(s.receiptsTotal)} tone="success" />
            <FlowRow icon="wallet" label={t.payments} value={money(s.paymentsTotal)} tone="danger" />
            <FlowRow icon="purchases" label={t.purchases} value={money(s.purchasesTotal)} note={`${formatNumber(s.purchaseCount, 'en', 0)} ${t.invoicesShort}`} />
            <FlowRow icon="swap" label={t.purchaseReturns} value={money(s.purchaseReturnsTotal)} />
          </dl>
        </Card>
      </div>
    </div>

    <div className="report-row report-row-even">
      <Card className="report-panel">
        <PanelHead title={t.expensesByAccount} aside={<span className="panel-note"><bdi dir="ltr">{money(s.expensesTotal)}</bdi></span>} />
        <BarList empty={t.noExpenses} rows={report.expenses.map(row => ({ key: row.accountCode, label: ar ? row.nameAr : row.nameEn, value: row.amount, display: formatMoney(row.amount), note: row.accountCode }))} />
      </Card>
      {showBranches && report.branches.length > 1
        ? <Card className="report-panel">
          <PanelHead title={t.byBranch} />
          <BarList empty={t.noSales} rows={report.branches.map(row => ({ key: String(row.branchId), label: ar ? row.nameAr : row.nameEn, value: row.sales, display: formatMoney(row.sales), note: `${t.profit} ${formatMoney(row.margin)} · ${formatNumber(row.invoices, 'en', 0)} ${t.invoicesShort}` }))} />
        </Card>
        : <Card className="report-panel">
          <PanelHead title={t.byCashier} />
          <BarList empty={t.noSales} rows={report.cashiers.map(row => ({ key: String(row.userId ?? 'none'), label: row.userName ?? t.unknownUser, value: row.sales, display: formatMoney(row.sales), note: `${formatNumber(row.invoices, 'en', 0)} ${t.invoicesShort}` }))} />
        </Card>}
    </div>
  </div>
}

function PanelHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return <div className="report-panel-head"><h2>{title}</h2>{aside}</div>
}

function Kpi({ icon, tone, label, value, change, note, badge, footer }: { icon: IconName; tone: 'primary' | 'success' | 'info' | 'warning' | 'danger'; label: string; value: string; change: number | null; note: string; badge?: string; footer?: ReactNode }) {
  return <Card className="report-kpi">
    <div className="report-kpi-top"><span className={`report-kpi-icon tone-${tone}`}><Icon name={icon} size={19} /></span><span className="report-kpi-label">{label}</span>{badge && <span className="report-kpi-badge">{badge}</span>}</div>
    <strong className="report-kpi-value"><bdi dir="ltr">{value}</bdi></strong>
    <div className="report-kpi-foot">
      {change !== null ? <span className={`trend-pill${change < 0 ? ' is-down' : ''}`}><bdi dir="ltr">{change < 0 ? '↓' : '↑'} {formatNumber(Math.abs(change), 'en', 1)}%</bdi></span> : <span className="trend-pill is-flat">—</span>}
      <span>{footer ?? note}</span>
    </div>
  </Card>
}

function TrendChart({ buckets, ar, symbol }: { buckets: Bucket[]; ar: boolean; symbol: string }) {
  const t = ar ? copy.ar : copy.en
  const max = niceMax(Math.max(...buckets.map(bucket => bucket.sales), 0))
  const ticks = [1, .75, .5, .25, 0].map(step => max * step)
  const step = Math.ceil(buckets.length / 10)
  const months = buckets.length > 1 && buckets[0].key.length === 7
  const label = (bucket: Bucket) => new Intl.DateTimeFormat(ar ? 'ar-u-nu-latn' : 'en', months ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' }).format(new Date(`${bucket.from.slice(0, 10)}T12:00:00`))
  if (!buckets.some(bucket => bucket.sales || bucket.profit)) return <EmptyState title={t.noSales} detail={t.noSalesDetail} />
  return <div className="trend-chart" dir="ltr" role="img" aria-label={t.trend}>
    <div className="trend-axis">{ticks.map(tick => <span key={tick}>{compact(tick)}</span>)}</div>
    <div className="trend-plot">
      <div className="trend-grid">{ticks.map(tick => <span key={tick} />)}</div>
      <div className="trend-bars" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}>
        {buckets.map((bucket, index) => <div key={bucket.key} className={`trend-col${index < buckets.length / 2 ? ' tip-start' : ' tip-end'}`} tabIndex={0}>
          <span className="trend-bar is-sales" style={{ blockSize: `${Math.max(bucket.sales, 0) / max * 100}%` }} />
          <span className="trend-bar is-profit" style={{ blockSize: `${Math.max(bucket.profit, 0) / max * 100}%` }} />
          <span className="trend-tip" dir={ar ? 'rtl' : 'ltr'}>
            <strong><bdi dir="ltr">{formatDay(bucket.from)}{bucket.to !== bucket.from && <> – {formatDay(bucket.to)}</>}</bdi></strong>
            <span><i className="legend-swatch is-sales" />{t.netSales}<b><bdi dir="ltr">{formatMoney(bucket.sales, symbol)}</bdi></b></span>
            <span><i className="legend-swatch is-profit" />{t.grossProfit}<b><bdi dir="ltr">{formatMoney(bucket.profit, symbol)}</bdi></b></span>
            <span>{t.invoices}<b>{formatNumber(bucket.invoices, 'en', 0)}</b></span>
          </span>
        </div>)}
      </div>
      <div className="trend-labels" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}>{buckets.map((bucket, index) => <span key={bucket.key}>{index % step === 0 ? label(bucket) : ''}</span>)}</div>
    </div>
  </div>
}

function compact(value: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function PlRow({ label, value, base, money, total = false, grand = false }: { label: string; value: number; base: number; money: (value: number) => string; total?: boolean; grand?: boolean }) {
  const share = base ? Math.min(Math.abs(value) / base * 100, 100) : 0
  return <li className={`pl-row${total ? ' is-total' : ''}${grand ? ' is-grand' : ''}${value < 0 ? ' is-minus' : ''}`}>
    <span className="pl-label">{label}</span>
    <span className="pl-value"><bdi dir="ltr">{value < 0 ? '−' : ''}{money(Math.abs(value))}</bdi></span>
    <span className="pl-bar"><span style={{ inlineSize: `${share}%` }} /></span>
  </li>
}

function PaymentSplit({ report, ar, money }: { report: ReportOverview; ar: boolean; money: (value: number) => string }) {
  const t = ar ? copy.ar : copy.en
  const { cash, onAccount, cashCount, onAccountCount } = report.payments
  const total = cash + onAccount
  if (!total) return <p className="panel-empty">{t.noSales}</p>
  const cashShare = cash / total * 100
  return <div className="split">
    <div className="split-bar" role="img" aria-label={`${t.cash} ${formatNumber(cashShare, 'en', 0)}%`}><span className="is-cash" style={{ inlineSize: `${cashShare}%` }} /><span className="is-account" style={{ inlineSize: `${100 - cashShare}%` }} /></div>
    <dl className="split-legend">
      <div><dt><i className="legend-swatch is-cash" />{t.cash}</dt><dd><bdi dir="ltr">{money(cash)}</bdi><small>{formatNumber(cashShare, 'en', 0)}% · {formatNumber(cashCount, 'en', 0)} {t.invoicesShort}</small></dd></div>
      <div><dt><i className="legend-swatch is-account" />{t.onAccount}</dt><dd><bdi dir="ltr">{money(onAccount)}</bdi><small>{formatNumber(100 - cashShare, 'en', 0)}% · {formatNumber(onAccountCount, 'en', 0)} {t.invoicesShort}</small></dd></div>
    </dl>
  </div>
}

function FlowRow({ icon, label, value, note, tone }: { icon: IconName; label: string; value: string; note?: string; tone?: 'success' | 'danger' }) {
  return <div className="flow-row"><dt><span className={`flow-icon${tone ? ` tone-${tone}` : ''}`}><Icon name={icon} size={16} /></span>{label}</dt><dd><bdi dir="ltr">{value}</bdi>{note && <small>{note}</small>}</dd></div>
}

function BarList({ rows, empty }: { rows: Array<{ key: string; label: string; value: number; display: string; note?: string }>; empty: string }) {
  if (!rows.length) return <p className="panel-empty">{empty}</p>
  const max = Math.max(...rows.map(row => Math.abs(row.value)), 1)
  return <ul className="bar-list">{rows.map(row => <li key={row.key}>
    <div className="bar-list-text"><span>{row.label}{row.note && <small>{row.note}</small>}</span><strong><bdi dir="ltr">{row.display}</bdi></strong></div>
    <span className="bar-list-track"><span style={{ inlineSize: `${Math.max(Math.abs(row.value) / max * 100, 1.5)}%` }} /></span>
  </li>)}</ul>
}

const copy = {
  en: {
    title: 'Reports', export: 'Export CSV', print: 'Print', period: 'Period', from: 'From', to: 'To', branch: 'Branch', allBranches: 'All branches',
    loading: 'Loading report…', loadError: 'Could not load the report.', loadErrorDetail: 'Check the connection to the local service and try again.',
    vsPreviousDay: 'vs the day before', vsPreviousDays: (n: number) => `vs previous ${n} days`,
    netSales: 'Net sales', grossProfit: 'Gross profit', netProfit: 'Net profit', invoices: 'Invoices', averageInvoice: 'Average', margin: 'margin',
    trend: 'Sales and gross profit', profitAndLoss: 'Profit and loss', sales: 'Sales', salesReturns: 'Sales returns', costOfGoods: 'Cost of goods sold', expenses: 'Expenses',
    topItems: 'Top selling items', topItemsNote: 'By net sales, before returns', item: 'Item', quantity: 'Qty', profit: 'Profit',
    howPaid: 'How customers paid', cash: 'Paid now', onAccount: 'On account', moneyFlow: 'Money in and out', receipts: 'Receipts', payments: 'Payments', purchases: 'Purchases', purchaseReturns: 'Purchase returns', invoicesShort: 'invoices',
    expensesByAccount: 'Expenses by account', noExpenses: 'No expenses in this period.', byBranch: 'Sales by branch', byCashier: 'Sales by cashier', unknownUser: 'Not recorded',
    noSales: 'No sales in this period', noSalesDetail: 'Pick a longer period or another branch.',
  },
  ar: {
    title: 'التقارير', export: 'تصدير CSV', print: 'طباعة', period: 'الفترة', from: 'من', to: 'إلى', branch: 'الفرع', allBranches: 'كل الفروع',
    loading: 'جارٍ تحميل التقرير…', loadError: 'تعذر تحميل التقرير.', loadErrorDetail: 'تحقق من الاتصال بالخدمة المحلية ثم حاول مرة أخرى.',
    vsPreviousDay: 'مقارنة باليوم السابق', vsPreviousDays: (n: number) => `مقارنة بالـ ${n} يومًا السابقة`,
    netSales: 'صافي المبيعات', grossProfit: 'مجمل الربح', netProfit: 'صافي الربح', invoices: 'الفواتير', averageInvoice: 'المتوسط', margin: 'هامش',
    trend: 'المبيعات ومجمل الربح', profitAndLoss: 'الأرباح والخسائر', sales: 'المبيعات', salesReturns: 'مرتجعات المبيعات', costOfGoods: 'تكلفة البضاعة المباعة', expenses: 'المصروفات',
    topItems: 'الأصناف الأكثر مبيعًا', topItemsNote: 'حسب صافي المبيعات قبل المرتجعات', item: 'الصنف', quantity: 'الكمية', profit: 'الربح',
    howPaid: 'طريقة الدفع', cash: 'مدفوع فورًا', onAccount: 'آجل', moneyFlow: 'المقبوضات والمدفوعات', receipts: 'المقبوضات', payments: 'المدفوعات', purchases: 'المشتريات', purchaseReturns: 'مرتجعات المشتريات', invoicesShort: 'فاتورة',
    expensesByAccount: 'المصروفات حسب الحساب', noExpenses: 'لا توجد مصروفات في هذه الفترة.', byBranch: 'المبيعات حسب الفرع', byCashier: 'المبيعات حسب الكاشير', unknownUser: 'غير مسجل',
    noSales: 'لا توجد مبيعات في هذه الفترة', noSalesDetail: 'اختر فترة أطول أو فرعًا آخر.',
  },
}
