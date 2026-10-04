import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockFetch } from '../../test/fetchMock'
import { ReportsPage } from './ReportsPage'

const summary = { from: '2026-10-01', to: '2026-10-04', salesTotal: 1000, purchasesTotal: 400, expensesTotal: 50, receiptsTotal: 0, paymentsTotal: 0, grossMargin: 300, salesCount: 4, purchaseCount: 1, salesReturnsTotal: 100, purchaseReturnsTotal: 0 }
const overview = {
  summary, previous: { ...summary, salesTotal: 600, salesReturnsTotal: 0, grossMargin: 200 },
  days: [{ date: '2026-10-01', sales: 1000, returns: 100, cost: 600, invoices: 4 }],
  topItems: [{ itemId: 1, itemCode: 'A1', nameAr: 'بنادول', nameEn: 'Panadol', quantity: 2, revenue: 900, cost: 600 }],
  expenses: [{ accountCode: '5100', nameAr: 'رواتب', nameEn: 'Salaries', amount: 50 }],
  payments: { cash: 700, onAccount: 300, cashCount: 3, onAccountCount: 1 },
  branches: [{ branchId: 1, nameAr: 'الرئيسي', nameEn: 'Main', sales: 600, margin: 200, invoices: 2 }, { branchId: 2, nameAr: 'المارينا', nameEn: 'Marina', sales: 400, margin: 100, invoices: 2 }],
  cashiers: [{ userId: 1, userName: 'sara', sales: 1000, invoices: 4 }],
}

describe('ReportsPage', () => {
  it('shows profit, items and the branch breakdown, and reloads for a branch', async () => {
    const fetch = mockFetch([
      { path: '/api/reports/overview', body: overview },
      { path: '/api/currencies', body: [{ symbol: 'AED', isPrimary: true }] },
      { path: '/api/branches', body: [{ branchId: 1, nameAr: 'الرئيسي', nameEn: 'Main' }, { branchId: 2, nameAr: 'المارينا', nameEn: 'Marina' }] },
    ])
    render(<ReportsPage locale="en" canAllBranches />)
    expect(await screen.findByText('Panadol')).toBeInTheDocument()
    expect(screen.getAllByText('900.00 AED').length).toBeGreaterThan(0)
    expect(screen.getByText('33.3% margin')).toBeInTheDocument()
    expect(screen.getAllByText('250.00 AED').length).toBeGreaterThan(0)
    expect(screen.getByText('Sales by branch')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'This month' }))
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes('/api/reports/overview') && String(url).includes('-01&'))).toBe(true))
  })

  it('shows sales by cashier for a single-branch user', async () => {
    mockFetch([{ path: '/api/reports/overview', body: overview }, { path: '/api/currencies', body: [] }])
    render(<ReportsPage locale="ar" branchName="الفرع الرئيسي" />)
    expect(await screen.findByText('المبيعات حسب الكاشير')).toBeInTheDocument()
    expect(screen.getByText('بنادول')).toBeInTheDocument()
    expect(screen.queryByText('المبيعات حسب الفرع')).not.toBeInTheDocument()
  })

  it('says when the report cannot load', async () => {
    mockFetch([{ path: '/api/reports/overview', status: 500, body: '' }])
    render(<ReportsPage locale="en" />)
    expect(await screen.findByText('Could not load the report.')).toBeInTheDocument()
  })
})
