import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockFetch } from '../../test/fetchMock'
import { SalesReturnsPage } from './SalesReturnsPage'
import { refundPreview } from './returnModel'

const invoice = {
  saleId: 41, saleNo: 'SL-1-00041', saleDate: '2026-10-01', customerName: null, treasuryId: 3, currencyId: 1, currencySymbol: 'AED',
  subtotal: 62, discount: 2, total: 60, returnedTotal: 0,
  lines: [
    { saleLineId: 501, itemId: 1, itemCode: 'PAN', itemNameAr: 'بنادول', itemNameEn: 'Panadol', soldQuantity: 4, returnedQuantity: 0, returnableQuantity: 4, unitPrice: 8 },
    { saleLineId: 502, itemId: 2, itemCode: 'BRU', itemNameAr: 'بروفين', itemNameEn: 'Brufen', soldQuantity: 1, returnedQuantity: 0, returnableQuantity: 1, unitPrice: 30 },
  ],
}
const routes = [
  { path: '/api/sales-returns', body: [{ salesReturnId: 7, returnNo: 'SR-1-00007', returnDate: '2026-10-02', saleNo: 'SL-1-00030', customerName: 'Ahmed', treasuryNameAr: 'الصندوق', treasuryNameEn: 'Front till', currencySymbol: 'AED', total: 12.5, lineCount: 1 }] },
  { path: '/api/sales-returns/invoices', body: [{ invoiceId: 41, invoiceNo: 'SL-1-00041', invoiceDate: '2026-10-01', partnerName: null, currencySymbol: 'AED', total: 60, returnedTotal: 0 }] },
  { path: '/api/sales-returns/invoices/41', body: invoice },
  { path: '/api/treasuries', body: [{ treasuryId: 3, nameAr: 'الصندوق', nameEn: 'Front till', currencyId: 1, currencySymbol: 'AED', isActive: true }, { treasuryId: 4, nameAr: 'دولار', nameEn: 'USD till', currencyId: 2, currencySymbol: 'USD', isActive: true }] },
]

async function openInvoice() {
  await userEvent.click(await screen.findByRole('button', { name: /New return/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Return from this invoice' }))
  await screen.findByRole('heading', { name: 'SL-1-00041' })
}

describe('SalesReturnsPage', () => {
  it('lists posted returns', async () => {
    mockFetch(routes)
    render(<SalesReturnsPage locale="en" />)
    expect(await screen.findByText('SR-1-00007')).toBeInTheDocument()
    expect(screen.getByText('Front till')).toBeInTheDocument()
  })

  it('previews the refund with the invoice discount share and posts the return', async () => {
    const fetchMock = mockFetch([...routes, { method: 'POST', path: '/api/sales-returns', status: 201, body: { returnNo: 'SR-1-00008', total: 15.48 } }])
    render(<SalesReturnsPage locale="en" />)
    await openInvoice()
    await userEvent.type(screen.getByLabelText('Return quantity for Panadol'), '2')
    expect(screen.getByText('Return total').nextSibling).toHaveTextContent('15.48 AED')
    await userEvent.click(screen.getByRole('button', { name: /Save return/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('15.48 AED is paid out of Front till')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm return' }))
    expect(await screen.findByText('Return saved: SR-1-00008')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls.find(([url, request]) => url === '/api/sales-returns' && request?.method === 'POST')!
    expect(JSON.parse(String(init?.body))).toMatchObject({ saleId: 41, treasuryId: 3, lines: [{ lineId: 501, quantity: 2 }] })
  })

  it('explains a quantity over what is left instead of sending it', async () => {
    const fetchMock = mockFetch(routes)
    render(<SalesReturnsPage locale="en" />)
    await openInvoice()
    await userEvent.type(screen.getByLabelText('Return quantity for Brufen'), '2')
    expect(screen.getByText('At most 1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Save return/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Fix the highlighted quantities first.')
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('only offers treasuries in the invoice currency', async () => {
    mockFetch(routes)
    render(<SalesReturnsPage locale="en" />)
    await openInvoice()
    await userEvent.click(screen.getByRole('button', { name: 'Refund from treasury' }))
    expect(screen.queryByRole('option', { name: /USD till/ })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Front till/ })).toBeInTheDocument()
  })

  it('credits a customer invoice to the customer without a treasury', async () => {
    const onAccount = { ...invoice, customerPartnerId: 9, customerName: 'Al Noor Clinic', treasuryId: null }
    const fetchMock = mockFetch([...routes.map(route => route.path === '/api/sales-returns/invoices/41' ? { ...route, body: onAccount } : route), { method: 'POST', path: '/api/sales-returns', status: 201, body: { returnNo: 'SR-1-00009', total: 15.48 } }])
    render(<SalesReturnsPage locale="en" />)
    await openInvoice()
    expect(screen.queryByRole('button', { name: 'Refund from treasury' })).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent("credited to Al Noor Clinic's account")
    await userEvent.type(screen.getByLabelText('Return quantity for Panadol'), '2')
    await userEvent.click(screen.getByRole('button', { name: /Save return/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent("15.48 AED is credited to Al Noor Clinic's account")
    await userEvent.click(screen.getByRole('button', { name: 'Confirm return' }))
    expect(await screen.findByText('Return saved: SR-1-00009')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls.find(([url, request]) => url === '/api/sales-returns' && request?.method === 'POST')!
    expect(JSON.parse(String(init?.body))).toMatchObject({ saleId: 41, treasuryId: null })
  })

  it('renders right-to-left in Arabic', async () => {
    mockFetch(routes)
    const { container } = render(<SalesReturnsPage locale="ar" />)
    expect(await screen.findByRole('button', { name: /مرتجع جديد/ })).toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('dir', 'rtl')
  })
})

describe('refundPreview', () => {
  it('matches the server rule', () => {
    const totals = { subtotal: 62, discount: 2, total: 60, returnedTotal: 0 }
    expect(refundPreview(16, totals, false).net).toBe(15.48)
    expect(refundPreview(46, { ...totals, returnedTotal: 15.48 }, true).net).toBeCloseTo(44.52)
  })
})
