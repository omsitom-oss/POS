import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockFetch } from '../../test/fetchMock'
import { SalesPage } from './SalesPage'

const references = [
  { path: '/api/items', body: [{ itemId: 1, itemCode: '6291000000017', nameAr: 'بنادول', nameEn: 'Panadol', sellPrice: 12.5 }, { itemId: 2, itemCode: 'BRU-400', nameAr: 'بروفين', nameEn: 'Brufen', sellPrice: 8 }] },
  { path: '/api/treasuries', body: [{ treasuryId: 3, nameAr: 'الصندوق', nameEn: 'Front till', currencyId: 1, currencySymbol: 'AED', isActive: true }, { treasuryId: 4, nameAr: 'دولار', nameEn: 'USD till', currencyId: 2, currencySymbol: 'USD', isActive: true }] },
  { path: '/api/currencies', body: [{ currencyId: 1, symbol: 'AED', isPrimary: true }, { currencyId: 2, symbol: 'USD', isPrimary: false }] },
  { path: '/api/partners/options', body: [] },
  { path: '/api/sales', body: [] },
]

async function openNewInvoice() {
  await userEvent.click(await screen.findByRole('button', { name: /New invoice/ }))
}

async function scan(code: string) {
  const search = screen.getByRole('searchbox', { name: 'Search or scan barcode' })
  await userEvent.type(search, `${code}{Enter}`)
}

describe('SalesPage', () => {
  it('adds scanned items and recomputes the total with discount', async () => {
    mockFetch(references)
    render(<SalesPage locale="en" branchId={1} userId={7} />)
    await openNewInvoice()
    await scan('6291000000017')
    await scan('6291000000017')
    await scan('BRU-400')
    expect(screen.getByLabelText('Item quantity 1')).toHaveValue(2)
    expect(screen.getByLabelText('Item quantity 2')).toHaveValue(1)
    expect(screen.getByText('Subtotal').nextSibling).toHaveTextContent('33 AED')
    const discount = screen.getByText('Discount').closest('.form-field, label, div')!.querySelector('input')!
    await userEvent.clear(discount)
    await userEvent.type(discount, '3')
    expect(screen.getByText('Total', { selector: 'strong' }).nextSibling).toHaveTextContent('30 AED')
  })

  it('refuses to save without a treasury', async () => {
    const fetchMock = mockFetch(references)
    render(<SalesPage locale="en" branchId={1} userId={7} />)
    await openNewInvoice()
    await scan('BRU-400')
    await userEvent.click(screen.getByRole('button', { name: /Save invoice/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Complete the treasury, sale type, and lines.')
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('only offers treasuries in the primary currency and posts the sale', async () => {
    const fetchMock = mockFetch([...references, { method: 'POST', path: '/api/sales', body: { saleNo: 'S-000123' } }])
    render(<SalesPage locale="en" branchId={1} userId={7} />)
    await openNewInvoice()
    await scan('BRU-400')
    await userEvent.click(screen.getByRole('button', { name: /^Treasury/ }))
    expect(screen.queryByRole('option', { name: /USD till/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: /Front till/ }))
    await userEvent.click(screen.getByRole('button', { name: /Save invoice/ }))
    expect(await screen.findByText(/Invoice saved: S-000123/)).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls.find(([url, request]) => url === '/api/sales' && request?.method === 'POST')!
    expect(JSON.parse(String(init?.body))).toMatchObject({
      customerPartnerId: null, treasuryId: 3, currencyId: 1, branchId: 1, savedBy: 7, discount: 0,
      lines: [{ itemId: 2, quantity: 1, unitPrice: 8 }],
    })
  })

  it('renders right-to-left in Arabic', async () => {
    mockFetch(references)
    const { container } = render(<SalesPage locale="ar" branchId={1} userId={7} />)
    expect(await screen.findByRole('button', { name: /فاتورة جديدة/ })).toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('dir', 'rtl')
  })
})
