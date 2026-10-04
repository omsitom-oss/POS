import { localDate } from '../../app/formatters'

export type ReportSummary = { from: string; to: string; salesTotal: number; purchasesTotal: number; expensesTotal: number; receiptsTotal: number; paymentsTotal: number; grossMargin: number; salesCount: number; purchaseCount: number; salesReturnsTotal: number; purchaseReturnsTotal: number }
export type ReportDay = { date: string; sales: number; returns: number; cost: number; invoices: number }
export type ReportItem = { itemId: number; itemCode: string; nameAr: string; nameEn: string; quantity: number; revenue: number; cost: number }
export type ReportExpense = { accountCode: string; nameAr: string; nameEn: string; amount: number }
export type ReportBranch = { branchId: number; nameAr: string; nameEn: string; sales: number; margin: number; invoices: number }
export type ReportCashier = { userId: number | null; userName: string | null; sales: number; invoices: number }
export type ReportOverview = { summary: ReportSummary; previous: ReportSummary; days: ReportDay[]; topItems: ReportItem[]; expenses: ReportExpense[]; payments: { cash: number; onAccount: number; cashCount: number; onAccountCount: number }; branches: ReportBranch[]; cashiers: ReportCashier[] }

export type Period = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'last-month' | 'custom'

export function periodOptions(ar: boolean): Array<{ value: Period; label: string }> {
  return [
    { value: 'today', label: ar ? 'اليوم' : 'Today' },
    { value: 'yesterday', label: ar ? 'أمس' : 'Yesterday' },
    { value: '7d', label: ar ? '7 أيام' : '7 days' },
    { value: '30d', label: ar ? '30 يومًا' : '30 days' },
    { value: 'month', label: ar ? 'هذا الشهر' : 'This month' },
    { value: 'last-month', label: ar ? 'الشهر الماضي' : 'Last month' },
    { value: 'custom', label: ar ? 'مخصص' : 'Custom' },
  ]
}

// The calendar range a preset covers, counted in the shop's local days.
export function periodRange(period: Exclude<Period, 'custom'>, today: Date = new Date()): { from: string; to: string } {
  const day = (offset: number) => { const date = new Date(today); date.setDate(date.getDate() + offset); return localDate(date) }
  switch (period) {
    case 'today': return { from: day(0), to: day(0) }
    case 'yesterday': return { from: day(-1), to: day(-1) }
    case '7d': return { from: day(-6), to: day(0) }
    case '30d': return { from: day(-29), to: day(0) }
    case 'month': return { from: localDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: day(0) }
    case 'last-month': return { from: localDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: localDate(new Date(today.getFullYear(), today.getMonth(), 0)) }
  }
}

export type Bucket = { key: string; from: string; to: string; sales: number; profit: number; invoices: number }

// Up to a month shows one bar per day; longer ranges roll up into weeks, then months, so bars stay readable.
export function bucketDays(days: ReportDay[]): Bucket[] {
  const size = days.length <= 31 ? 'day' : days.length <= 120 ? 'week' : 'month'
  const buckets: Bucket[] = []
  days.forEach((day, index) => {
    const key = size === 'day' ? day.date : size === 'week' ? String(Math.floor(index / 7)) : day.date.slice(0, 7)
    let bucket = buckets[buckets.length - 1]
    if (!bucket || bucket.key !== key) { bucket = { key, from: day.date, to: day.date, sales: 0, profit: 0, invoices: 0 }; buckets.push(bucket) }
    bucket.to = day.date
    bucket.sales += day.sales - day.returns
    bucket.profit += day.sales - day.returns - day.cost
    bucket.invoices += day.invoices
  })
  return buckets
}

// A round axis maximum (1, 2, 2.5 or 5 times a power of ten) just above the largest value.
export function niceMax(value: number) {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  return ([1, 2, 2.5, 5, 10].find(step => step * power >= value) ?? 10) * power
}

export function percentChange(current: number, previous: number) {
  if (!previous) return null
  return (current - previous) / Math.abs(previous) * 100
}

export function netSales(summary: ReportSummary) { return summary.salesTotal - summary.salesReturnsTotal }

// One CSV with a block per section. The byte-order mark lets Excel open Arabic names correctly.
export function reportCsv(report: ReportOverview, ar: boolean, branchName: string) {
  const s = report.summary
  const cell = (value: string | number) => { const text = typeof value === 'number' ? value.toFixed(2) : value; return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text }
  const rows: Array<Array<string | number>> = [
    [ar ? 'تقرير المبيعات والأرباح' : 'Sales and profit report'],
    [ar ? 'الفترة' : 'Period', s.from.slice(0, 10), s.to.slice(0, 10)],
    [ar ? 'الفرع' : 'Branch', branchName],
    [],
    [ar ? 'البند' : 'Measure', ar ? 'القيمة' : 'Value'],
    [ar ? 'المبيعات' : 'Sales', s.salesTotal],
    [ar ? 'مرتجعات المبيعات' : 'Sales returns', s.salesReturnsTotal],
    [ar ? 'صافي المبيعات' : 'Net sales', netSales(s)],
    [ar ? 'تكلفة البضاعة المباعة' : 'Cost of goods sold', netSales(s) - s.grossMargin],
    [ar ? 'مجمل الربح' : 'Gross profit', s.grossMargin],
    [ar ? 'المصروفات' : 'Expenses', s.expensesTotal],
    [ar ? 'صافي الربح' : 'Net profit', s.grossMargin - s.expensesTotal],
    [ar ? 'المشتريات' : 'Purchases', s.purchasesTotal],
    [ar ? 'مرتجعات المشتريات' : 'Purchase returns', s.purchaseReturnsTotal],
    [ar ? 'المقبوضات' : 'Receipts', s.receiptsTotal],
    [ar ? 'المدفوعات' : 'Payments', s.paymentsTotal],
    [ar ? 'فواتير البيع' : 'Sales invoices', String(s.salesCount)],
    [],
    [ar ? 'التاريخ' : 'Date', ar ? 'المبيعات' : 'Sales', ar ? 'المرتجعات' : 'Returns', ar ? 'التكلفة' : 'Cost', ar ? 'مجمل الربح' : 'Gross profit', ar ? 'الفواتير' : 'Invoices'],
    ...report.days.map(day => [day.date.slice(0, 10), day.sales, day.returns, day.cost, day.sales - day.returns - day.cost, String(day.invoices)]),
    [],
    [ar ? 'الكود' : 'Code', ar ? 'الصنف' : 'Item', ar ? 'الكمية' : 'Quantity', ar ? 'المبيعات' : 'Sales', ar ? 'التكلفة' : 'Cost', ar ? 'الربح' : 'Profit'],
    ...report.topItems.map(item => [item.itemCode, ar ? item.nameAr : item.nameEn, item.quantity, item.revenue, item.cost, item.revenue - item.cost]),
    [],
    [ar ? 'الحساب' : 'Account', ar ? 'المصروف' : 'Expense', ar ? 'المبلغ' : 'Amount'],
    ...report.expenses.map(row => [row.accountCode, ar ? row.nameAr : row.nameEn, row.amount]),
  ]
  return '﻿' + rows.map(row => row.map(cell).join(',')).join('\r\n')
}
