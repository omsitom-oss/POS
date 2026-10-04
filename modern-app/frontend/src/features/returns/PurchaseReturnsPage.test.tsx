import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockFetch } from '../../test/fetchMock'
import { PurchaseReturnsPage } from './PurchaseReturnsPage'

const invoice = {
  purchaseId: 12, invoiceNo: 'PO-1-00012', purchaseDate: '2026-09-28', supplierName: 'Gulf Pharma', currencySymbol: 'AED',
  subtotal: 150, discount: 10, total: 140, returnedTotal: 0, requiresApproval: true,
  lines: [{ purchaseLineId: 90, itemId: 1, itemCode: 'PAN', itemNameAr: 'بنادول', itemNameEn: 'Panadol', unitName: 'Box', batchNo: 'B-77', expiryDate: '2027-01-31', purchasedQuantity: 10, returnedQuantity: 0, availableQuantity: 6, returnableQuantity: 6, unitCost: 5 }],
}
const pending = { purchaseReturnId: 3, returnNo: 'PR-1-00003', returnDate: '2026-10-02', invoiceNo: 'PO-1-00010', supplierName: 'Gulf Pharma', currencySymbol: 'AED', total: 14, lineCount: 1, status: 'PENDING', reviewNote: null }
const routes = [
  { path: '/api/purchase-returns', body: [pending, { ...pending, purchaseReturnId: 2, returnNo: 'PR-1-00002', status: 'POSTED' }] },
  { path: '/api/purchase-returns/invoices', body: [{ invoiceId: 12, invoiceNo: 'PO-1-00012', invoiceDate: '2026-09-28', partnerName: 'Gulf Pharma', currencySymbol: 'AED', total: 140, returnedTotal: 0 }] },
  { path: '/api/purchase-returns/invoices/12', body: invoice },
]

describe('PurchaseReturnsPage', () => {
  it('sends a return for approval with stock-limited quantities', async () => {
    const fetchMock = mockFetch([...routes, { method: 'POST', path: '/api/purchase-returns', status: 201, body: { returnNo: 'PR-1-00004', status: 'PENDING' } }])
    render(<PurchaseReturnsPage locale="en" canApprove={false} />)
    await userEvent.click(await screen.findByRole('button', { name: /New return/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Return from this invoice' }))
    expect(await screen.findByText('B-77')).toBeInTheDocument()

    const input = screen.getByLabelText('Return quantity for Panadol')
    await userEvent.type(input, '7')
    expect(screen.getByText('At most 6')).toBeInTheDocument()
    await userEvent.clear(input)
    await userEvent.type(input, '3')
    // 3 at 5 = 15, less 10 * 15 / 150 of the invoice discount.
    expect(screen.getByText('Return total').nextSibling).toHaveTextContent('14.00 AED')
    await userEvent.click(screen.getByRole('button', { name: /Send for approval/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('change only once it is approved')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Return saved: PR-1-00004 (waiting for approval)')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls.find(([url, request]) => url === '/api/purchase-returns' && request?.method === 'POST')!
    expect(JSON.parse(String(init?.body))).toMatchObject({ purchaseId: 12, lines: [{ lineId: 90, quantity: 3 }] })
  })

  it('hides approval actions from users who cannot approve', async () => {
    mockFetch(routes)
    render(<PurchaseReturnsPage locale="en" canApprove={false} />)
    expect(await screen.findByText('PR-1-00003')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })

  it('approves a pending return with a note', async () => {
    const fetchMock = mockFetch([...routes, { method: 'POST', path: '/api/purchase-returns/3/approve', body: { ...pending, status: 'POSTED' } }])
    render(<PurchaseReturnsPage locale="en" canApprove />)
    const row = (await screen.findByText('PR-1-00003')).closest('tr')!
    expect(within(row).getByText('Pending approval')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Approve' }))
    await userEvent.type(within(screen.getByRole('dialog')).getByRole('textbox'), 'Supplier agreed')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('PR-1-00003: approved and posted')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/purchase-returns/3/approve')!
    expect(JSON.parse(String(init?.body))).toEqual({ note: 'Supplier agreed' })
  })

  it('filters by status', async () => {
    mockFetch(routes)
    render(<PurchaseReturnsPage locale="en" canApprove />)
    await screen.findByText('PR-1-00003')
    await userEvent.click(screen.getByRole('radio', { name: /Posted/ }))
    expect(screen.queryByText('PR-1-00003')).not.toBeInTheDocument()
    expect(screen.getByText('PR-1-00002')).toBeInTheDocument()
  })
})
