import { useCallback, useState } from 'react'
import { Button, Card, LoadingState, StatusBadge } from '../../components/shared'
import { Icon, type IconName } from '../../components/icons'
import { useLoadEffect } from '../../components/useLoadEffect'
import { PageHeader, type Locale } from '../../layouts/AppLayout'
import { formatMoney, localDate } from '../../app/formatters'

type Summary = { salesTotal: number; salesCount: number; salesReturnsTotal: number; expensesTotal: number }
type SaleRow = { saleNo: string; saleDate: string; total: number; currencySymbol: string; customerName?: string | null }
type StockRow = { quantity: number; minimumLevelForAlert: number; isActive: boolean }
type ReturnRow = { status: string }
type Currency = { symbol: string; isPrimary: boolean }
type HomeData = { today: Summary | null; yesterday: Summary | null; sales: SaleRow[] | null; stock: StockRow[] | null; returns: ReturnRow[] | null; symbol: string }

const dayOffset = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return localDate(date) }

// Each source loads on its own: a user without, say, report permission still sees the rest of the page.
async function getJson<T>(url: string): Promise<T | null> {
  try { const response = await fetch(url); return response.ok ? await response.json() as T : null } catch { return null }
}

export function HomePage({ locale, branchId, onNavigate, canOpen = () => true }: { locale: Locale; branchId: number; onNavigate: (section: string) => void; canOpen?: (section: string) => boolean }) {
  const ar = locale === 'ar'
  const [data, setData] = useState<HomeData | null>(null)
  const load = useCallback(async () => {
    const today = dayOffset(0), yesterday = dayOffset(-1), weekStart = dayOffset(-6)
    const [todaySummary, yesterdaySummary, sales, stock, returns, currencies] = await Promise.all([
      getJson<Summary>(`/api/reports/summary?from=${today}&to=${today}`),
      getJson<Summary>(`/api/reports/summary?from=${yesterday}&to=${yesterday}`),
      getJson<SaleRow[]>(`/api/sales?from=${weekStart}&to=${today}`),
      getJson<StockRow[]>(`/api/inventory?branchId=${branchId}`),
      getJson<ReturnRow[]>('/api/purchase-returns'),
      getJson<Currency[]>('/api/currencies'),
    ])
    setData({ today: todaySummary, yesterday: yesterdaySummary, sales, stock, returns, symbol: currencies?.find(currency => currency.isPrimary)?.symbol ?? '' })
  }, [branchId])
  useLoadEffect(load)

  const t = ar
    ? { title: 'اليوم', salesToday: 'مبيعات اليوم', invoices: 'فواتير اليوم', average: 'متوسط الفاتورة', returns: 'مرتجعات اليوم', vsYesterday: 'مقارنة بالأمس', week: 'المبيعات آخر 7 أيام', attention: 'يحتاج إلى متابعة', allClear: 'لا شيء يحتاج إلى متابعة الآن.', outOfStock: (n: number) => n === 1 ? 'صنف واحد نفد من المخزون' : `${n} أصناف نفدت من المخزون`, belowMin: (n: number) => n === 1 ? 'صنف واحد تحت الحد الأدنى' : `${n} أصناف تحت الحد الأدنى`, pendingReturns: (n: number) => n === 1 ? 'مرتجع شراء واحد بانتظار الموافقة' : `${n} مرتجعات شراء بانتظار الموافقة`, noCurrency: 'لم تُحدَّد العملة الأساسية', open: 'فتح', latest: 'آخر المبيعات', invoice: 'الفاتورة', date: 'التاريخ', customer: 'العميل', total: 'الإجمالي', walkIn: 'عميل نقدي', noSales: 'لا توجد مبيعات هذا الأسبوع.', newSale: 'بيع جديد', newPurchase: 'فاتورة شراء', newReceipt: 'إيصال', unavailable: 'غير متاح' }
    : { title: 'Today', salesToday: 'Sales today', invoices: 'Invoices today', average: 'Average invoice', returns: 'Returns today', vsYesterday: 'vs yesterday', week: 'Sales, last 7 days', attention: 'Needs attention', allClear: 'Nothing needs attention right now.', outOfStock: (n: number) => n === 1 ? '1 item out of stock' : `${n} items out of stock`, belowMin: (n: number) => n === 1 ? '1 item below minimum level' : `${n} items below minimum level`, pendingReturns: (n: number) => n === 1 ? '1 purchase return waiting for approval' : `${n} purchase returns waiting for approval`, noCurrency: 'No primary currency is set', open: 'Open', latest: 'Latest sales', invoice: 'Invoice', date: 'Date', customer: 'Customer', total: 'Total', walkIn: 'Walk-in', noSales: 'No sales this week.', newSale: 'New sale', newPurchase: 'New purchase', newReceipt: 'New receipt', unavailable: 'Not available' }

  const actions = <>{canOpen('receipts') && <Button onClick={() => onNavigate('receipts')}><Icon name="history" size={18} />{t.newReceipt}</Button>}{canOpen('purchases') && <Button onClick={() => onNavigate('purchases')}><Icon name="purchases" size={18} />{t.newPurchase}</Button>}{canOpen('sales') && <Button variant="primary" onClick={() => onNavigate('sales')}><Icon name="sales" size={18} />{t.newSale}</Button>}</>
  if (!data) return <div className="home-page"><PageHeader title={t.title} actions={actions} /><LoadingState /></div>

  const { today, yesterday, symbol } = data
  const average = (summary: Summary | null) => summary && summary.salesCount ? summary.salesTotal / summary.salesCount : 0
  const outOfStock = data.stock?.filter(row => row.isActive && row.quantity <= 0).length ?? 0
  const belowMin = data.stock?.filter(row => row.isActive && row.quantity > 0 && row.quantity < row.minimumLevelForAlert).length ?? 0
  const pendingReturns = data.returns?.filter(row => row.status === 'PENDING').length ?? 0
  const attention: Array<{ key: string; tone: 'danger' | 'warning' | 'info'; label: string; target: string; icon: IconName }> = [
    ...(outOfStock ? [{ key: 'out', tone: 'danger' as const, label: t.outOfStock(outOfStock), target: 'inventory', icon: 'inventory' as IconName }] : []),
    ...(belowMin ? [{ key: 'min', tone: 'warning' as const, label: t.belowMin(belowMin), target: 'inventory', icon: 'inventory' as IconName }] : []),
    ...(pendingReturns ? [{ key: 'ret', tone: 'info' as const, label: t.pendingReturns(pendingReturns), target: 'purchase-returns', icon: 'swap' as IconName }] : []),
    ...(!symbol ? [{ key: 'cur', tone: 'warning' as const, label: t.noCurrency, target: 'settings', icon: 'currency' as IconName }] : []),
  ].filter(item => canOpen(item.target))
  const days = Array.from({ length: 7 }, (_, index) => dayOffset(index - 6))
  const byDay = days.map(day => ({ day, total: (data.sales ?? []).filter(row => row.saleDate.slice(0, 10) === day).reduce((sum, row) => sum + row.total, 0) }))
  const peak = Math.max(...byDay.map(row => row.total), 1)
  const dayLabel = (day: string) => new Intl.DateTimeFormat(ar ? 'ar' : 'en', { weekday: 'short' }).format(new Date(`${day}T12:00:00`))

  return <div className="home-page">
    <PageHeader title={t.title} description={new Intl.DateTimeFormat(ar ? 'ar' : 'en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())} actions={actions} />
    <div className="kpi-grid">
      <Kpi label={t.salesToday} value={today ? formatMoney(today.salesTotal, symbol) : t.unavailable} change={today && yesterday ? change(today.salesTotal, yesterday.salesTotal) : null} note={t.vsYesterday} />
      <Kpi label={t.invoices} value={today ? String(today.salesCount) : t.unavailable} change={today && yesterday ? change(today.salesCount, yesterday.salesCount) : null} note={t.vsYesterday} />
      <Kpi label={t.average} value={today ? formatMoney(average(today), symbol) : t.unavailable} change={today && yesterday ? change(average(today), average(yesterday)) : null} note={t.vsYesterday} />
      <Kpi label={t.returns} value={today ? formatMoney(today.salesReturnsTotal, symbol) : t.unavailable} change={null} note="" />
    </div>
    <div className="home-grid">
      <Card className="home-panel">
        <div className="home-panel-head"><h2>{t.week}</h2><span>{symbol}</span></div>
        {data.sales ? <div className="day-bars" role="img" aria-label={t.week}>{byDay.map((row, index) => <div key={row.day} className={`day-bar${index === 6 ? ' is-today' : ''}`}><span className="day-bar-value">{row.total ? formatMoney(row.total) : '—'}</span><span className="day-bar-track"><span className="day-bar-fill" style={{ blockSize: `${Math.max(row.total / peak * 100, row.total ? 3 : 0)}%` }} /></span><span className="day-bar-label">{dayLabel(row.day)}</span></div>)}</div> : <p className="home-empty">{t.unavailable}</p>}
      </Card>
      <Card className="home-panel">
        <div className="home-panel-head"><h2>{t.attention}</h2>{attention.length > 0 && <StatusBadge tone="warning">{attention.length}</StatusBadge>}</div>
        {attention.length ? <ul className="attention-list">{attention.map(item => <li key={item.key}><span className={`attention-icon tone-${item.tone}`}><Icon name={item.icon} size={17} /></span><span>{item.label}</span><Button variant="ghost" size="small" onClick={() => onNavigate(item.target)}>{t.open}<Icon name="arrow-right" size={16} className="icon-flip-rtl" /></Button></li>)}</ul> : <p className="home-empty">{t.allClear}</p>}
      </Card>
    </div>
    <Card className="home-panel">
      <div className="home-panel-head"><h2>{t.latest}</h2>{canOpen('sales') && <Button variant="ghost" size="small" onClick={() => onNavigate('sales')}>{t.open}<Icon name="arrow-right" size={16} className="icon-flip-rtl" /></Button>}</div>
      {data.sales?.length ? <table className="data-table home-table"><thead><tr><th>{t.invoice}</th><th>{t.date}</th><th>{t.customer}</th><th className="align-end">{t.total}</th></tr></thead><tbody>{data.sales.slice(0, 6).map(row => <tr key={row.saleNo}><td className="doc-number">{row.saleNo}</td><td>{row.saleDate.slice(0, 10)}</td><td>{row.customerName ?? <span className="muted-cell">{t.walkIn}</span>}</td><td className="align-end money-cell"><bdi dir="ltr">{formatMoney(row.total, row.currencySymbol)}</bdi></td></tr>)}</tbody></table> : <p className="home-empty">{data.sales ? t.noSales : t.unavailable}</p>}
    </Card>
  </div>
}

function change(current: number, previous: number) {
  if (!previous) return null
  return (current - previous) / previous * 100
}

function Kpi({ label, value, change, note }: { label: string; value: string; change: number | null; note: string }) {
  return <Card className="kpi-card"><span className="kpi-label">{label}</span><strong className="kpi-value"><bdi dir="ltr">{value}</bdi></strong>{change !== null ? <span className={`kpi-change${change < 0 ? ' is-down' : ''}`}>{change < 0 ? '▼' : '▲'} {Math.abs(change).toFixed(1)}% {note}</span> : <span className="kpi-change is-muted">&nbsp;</span>}</Card>
}
