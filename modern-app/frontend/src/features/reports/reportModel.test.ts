import { describe, expect, it } from 'vitest'
import { bucketDays, niceMax, percentChange, periodRange, reportCsv, type ReportOverview } from './reportModel'

const day = (date: string, sales: number, cost = 0, returns = 0) => ({ date, sales, returns, cost, invoices: 1 })

describe('reportModel', () => {
  it('turns presets into calendar ranges', () => {
    const today = new Date(2026, 9, 4, 21, 30)
    expect(periodRange('today', today)).toEqual({ from: '2026-10-04', to: '2026-10-04' })
    expect(periodRange('7d', today)).toEqual({ from: '2026-09-28', to: '2026-10-04' })
    expect(periodRange('month', today)).toEqual({ from: '2026-10-01', to: '2026-10-04' })
    expect(periodRange('last-month', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('keeps one bar per day for a month and rolls longer ranges up', () => {
    const days = Array.from({ length: 30 }, (_, i) => day(`2026-09-${String(i + 1).padStart(2, '0')}`, 100, 60, i === 0 ? 10 : 0))
    const daily = bucketDays(days)
    expect(daily).toHaveLength(30)
    expect(daily[0]).toMatchObject({ sales: 90, profit: 30 })
    const long = Array.from({ length: 60 }, (_, i) => day(`d${i}`, 10))
    const weekly = bucketDays(long)
    expect(weekly).toHaveLength(9)
    expect(weekly[0].sales).toBe(70)
  })

  it('rounds the axis and compares periods', () => {
    expect(niceMax(8300)).toBe(10000)
    expect(niceMax(2100)).toBe(2500)
    expect(niceMax(0)).toBe(1)
    expect(percentChange(110, 100)).toBeCloseTo(10)
    expect(percentChange(5, 0)).toBeNull()
  })

  it('exports every section with a byte-order mark', () => {
    const summary = { from: '2026-10-01', to: '2026-10-04', salesTotal: 1000, purchasesTotal: 0, expensesTotal: 50, receiptsTotal: 0, paymentsTotal: 0, grossMargin: 300, salesCount: 4, purchaseCount: 0, salesReturnsTotal: 100, purchaseReturnsTotal: 0 }
    const report: ReportOverview = { summary, previous: summary, days: [day('2026-10-01', 1000, 600, 100)], topItems: [{ itemId: 1, itemCode: 'A1', nameAr: 'صنف', nameEn: 'Item, large', quantity: 2, revenue: 900, cost: 600 }], expenses: [{ accountCode: '5100', nameAr: 'رواتب', nameEn: 'Salaries', amount: 50 }], payments: { cash: 1000, onAccount: 0, cashCount: 4, onAccountCount: 0 }, branches: [], cashiers: [] }
    const csv = reportCsv(report, false, 'Main')
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Cost of goods sold,600.00')
    expect(csv).toContain('Net profit,250.00')
    expect(csv).toContain('A1,"Item, large",2.00,900.00,600.00,300.00')
    expect(csv).toContain('5100,Salaries,50.00')
    expect(reportCsv({ ...report, topItems: [{ ...report.topItems[0], itemCode: '=HYPERLINK(1)', nameEn: '-x' }] }, false, '@Main')).toContain("'=HYPERLINK(1),'-x,2.00")
  })
})
