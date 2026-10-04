import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch } from '../../test/fetchMock'
import { HomePage } from './HomePage'

const summary = { salesTotal: 1500, salesCount: 3, salesReturnsTotal: 0, expensesTotal: 0 }

describe('HomePage', () => {
  it('shows today and what needs attention', async () => {
    mockFetch([
      { path: '/api/reports/summary', body: summary },
      { path: '/api/sales', body: [{ saleNo: 'S-1', saleDate: '2026-10-04T10:00:00', total: 500, currencySymbol: 'SDG', customerName: null }] },
      { path: '/api/inventory', body: [{ quantity: 0, minimumLevelForAlert: 5, isActive: true }, { quantity: 2, minimumLevelForAlert: 5, isActive: true }, { quantity: 9, minimumLevelForAlert: 5, isActive: true }] },
      { path: '/api/purchase-returns', body: [{ status: 'PENDING' }, { status: 'POSTED' }] },
      { path: '/api/currencies', body: [{ symbol: 'SDG', isPrimary: true }] },
    ])
    const onNavigate = vi.fn()
    render(<HomePage locale="en" branchId={1} onNavigate={onNavigate} />)
    expect(await screen.findByText('1,500.00 SDG')).toBeInTheDocument()
    expect(screen.getByText('1 item out of stock')).toBeInTheDocument()
    expect(screen.getByText('1 item below minimum level')).toBeInTheDocument()
    expect(screen.getByText('1 purchase return waiting for approval')).toBeInTheDocument()
    expect(screen.getByText('S-1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /New sale/ }))
    expect(onNavigate).toHaveBeenCalledWith('sales')
  })

  it('still renders when a source is not allowed', async () => {
    mockFetch([{ path: '/api/currencies', body: [{ symbol: 'SDG', isPrimary: true }] }])
    render(<HomePage locale="ar" branchId={1} onNavigate={() => undefined} />)
    expect(await screen.findByText('لا شيء يحتاج إلى متابعة الآن.')).toBeInTheDocument()
    expect(screen.getAllByText('غير متاح').length).toBeGreaterThan(0)
  })
})
