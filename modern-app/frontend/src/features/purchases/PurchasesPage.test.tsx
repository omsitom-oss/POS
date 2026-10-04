import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockFetch } from '../../test/fetchMock'
import { PurchasesPage } from './PurchasesPage'

const purchase = (purchaseId: number, status: string, purchaseType = 'LOCAL') => ({
  purchaseId, invoiceNo: `PUR-${String(purchaseId).padStart(4, '0')}`, purchaseDate: '2026-09-30T00:00:00', supplierName: 'Gulf Pharma',
  status, currencyCode: 'SDG', currencySymbol: 'SDG', total: 100 * purchaseId, lineCount: 1, purchaseType,
})

function routes(purchases: unknown[]) {
  return [
    { path: '/api/partners', body: [{ partnerId: 0, customerCode: 'SUP-1', businessName: 'Gulf Pharma', partnerTypeCode: 'SUPPLIER' }] },
    { path: '/api/partners/options', body: [{ partnerId: 9, partnerCode: 'SUP-1', partnerName: 'Gulf Pharma' }] },
    { path: '/api/items', body: [{ itemId: 1, nameAr: 'بنادول', nameEn: 'Panadol', sellPrice: 12, lastPurchasePrice: 10 }] },
    { path: '/api/items/1', body: { units: [{ unitSettingId: 5, unitEn: 'Box', unitAr: 'علبة', isBase: true, conversionToBase: 1 }] } },
    { path: '/api/currencies', body: [{ currencyId: 1, symbol: 'SDG', isPrimary: true, isActive: true }] },
    { path: '/api/purchases', body: purchases },
    { path: '/api/purchases/1', body: { ...purchase(1, 'POSTED'), discount: 0, lines: [{ purchaseLineId: 11, itemId: 1, itemName: 'Panadol', unitName: 'Box', quantity: 10, unitPrice: 10, lineTotal: 100 }] } },
    { method: 'POST', path: '/api/purchases', body: { purchaseId: 99 } },
  ]
}

function invoiceNumbers() {
  const [, body] = screen.getAllByRole('rowgroup')
  return within(body).queryAllByRole('row').map(row => within(row).getAllByRole('cell')[0].textContent)
}

describe('PurchasesPage', () => {
  it('lists final invoices first and filters drafts and imports by tab', async () => {
    mockFetch(routes([purchase(1, 'POSTED'), purchase(2, 'DRAFT'), purchase(3, 'DRAFT', 'IMPORT')]))
    render(<PurchasesPage locale="en" />)
    expect(await screen.findByText('PUR-0001')).toBeInTheDocument()
    expect(invoiceNumbers()).toEqual(['PUR-0001'])
    await userEvent.click(screen.getByRole('radio', { name: /Initial invoices/ }))
    expect(invoiceNumbers()).toEqual(['PUR-0002'])
    await userEvent.click(screen.getByRole('radio', { name: /Import invoices/ }))
    expect(invoiceNumbers()).toEqual(['PUR-0003'])
  })

  it('pages long invoice lists', async () => {
    mockFetch(routes(Array.from({ length: 20 }, (_, index) => purchase(index + 1, 'POSTED'))))
    render(<PurchasesPage locale="en" />)
    await screen.findByText('PUR-0001')
    expect(invoiceNumbers()).toHaveLength(15)
    expect(document.querySelector('.table-total')).toHaveTextContent('20')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(invoiceNumbers()).toEqual(['PUR-0016', 'PUR-0017', 'PUR-0018', 'PUR-0019', 'PUR-0020'])
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('opens the read-only detail of an invoice', async () => {
    mockFetch(routes([purchase(1, 'POSTED')]))
    render(<PurchasesPage locale="en" />)
    await userEvent.click(await screen.findByRole('button', { name: 'View' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Panadol')).toBeInTheDocument()
    expect(within(dialog).getByText('Purchase invoice PUR-0001')).toBeInTheDocument()
  })

  it('builds a new invoice from the item dialog and posts it', async () => {
    const fetch = mockFetch(routes([]))
    render(<PurchasesPage locale="en" />)
    await userEvent.click(await screen.findByRole('button', { name: /New invoice/ }))
    await userEvent.click(screen.getByPlaceholderText('Search or select supplier'))
    await userEvent.click(screen.getByRole('button', { name: 'Gulf Pharma' }))
    await userEvent.click(screen.getByRole('button', { name: /Add item/ }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByPlaceholderText('Search or select item'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Panadol' }))
    await within(dialog).findByDisplayValue('10')
    const quantity = within(dialog).getByDisplayValue('1')
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '3')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add item' }))
    expect(screen.getByText('Items total').nextSibling).toHaveTextContent('30.00')
    await userEvent.click(screen.getByRole('button', { name: 'Final invoice' }))
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      supplierPartnerId: 9, status: 'POSTED', currencyId: 1, discount: 0,
      lines: [{ itemId: 1, unitSettingId: 5, quantity: 3, unitPrice: 10 }],
    })
    expect(await screen.findByRole('button', { name: /New invoice/ })).toBeInTheDocument()
  })
})
