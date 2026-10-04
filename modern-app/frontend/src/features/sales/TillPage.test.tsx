import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { mockFetch } from '../../test/fetchMock'
import { TillPage } from './TillPage'

const references = [
  { path: '/api/items', body: [{ itemId: 1, itemCode: '6291000000017', nameAr: 'بنادول', nameEn: 'Panadol', sellPrice: 12.5 }, { itemId: 2, itemCode: 'BRU-400', nameAr: 'بروفين', nameEn: 'Brufen', sellPrice: 8 }] },
  { path: '/api/treasuries', body: [{ treasuryId: 3, nameAr: 'الصندوق', nameEn: 'Front till', currencyId: 1, currencySymbol: 'AED', isActive: true }, { treasuryId: 4, nameAr: 'دولار', nameEn: 'USD till', currencyId: 2, currencySymbol: 'USD', isActive: true }] },
  { path: '/api/currencies', body: [{ currencyId: 1, symbol: 'AED', isPrimary: true }, { currencyId: 2, symbol: 'USD', isPrimary: false }] },
  { path: '/api/partners/options', body: [{ partnerId: 9, partnerName: 'Clinic', status: 'ACTIVE', partnerTypeCode: 'CLIENT' }] },
  { path: /\/api\/inventory\/\d+\/batches/, body: [{ purchaseLineId: 1, batchNo: 'B7', expiryDate: '2027-05-01', availableQuantity: 4 }] },
  { method: 'POST', path: '/api/sales', body: { saleNo: 'S-1' } },
]

const sentSale = (fetchMock: ReturnType<typeof mockFetch>) => JSON.parse(String(fetchMock.mock.calls.find(([url, init]) => url === '/api/sales' && init?.method === 'POST')![1]!.body))

async function open() {
  const view = render(<TillPage locale="en" branchId={1} userId={7} branchName="Main" onExit={() => undefined} />)
  const scan = await screen.findByLabelText('Scan or find item')
  return { ...view, scan }
}

describe('TillPage', () => {
  beforeEach(() => localStorage.clear())

  it('adds and increments scanned items and shows the earliest batch', async () => {
    mockFetch(references)
    const { scan } = await open()
    await userEvent.type(scan, '6291000000017{Enter}')
    await userEvent.type(scan, '6291000000017{Enter}')
    expect(screen.getByLabelText('Quantity of Panadol')).toHaveValue(2)
    expect(await screen.findByText('Batch B7')).toBeInTheDocument()
  })

  it('says when a barcode is unknown', async () => {
    mockFetch(references)
    const { scan } = await open()
    await userEvent.type(scan, 'ZZZ{Enter}')
    expect(await screen.findByText('No item with barcode ZZZ')).toBeInTheDocument()
  })

  it('needs a drawer for cash and then posts the sale with change', async () => {
    const fetchMock = mockFetch(references)
    const { scan } = await open()
    await userEvent.type(scan, 'BRU-400{Enter}')
    await userEvent.click(screen.getByRole('button', { name: /^Pay/ }))
    expect(await screen.findByText('Choose the drawer at the top first.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Drawer/ }))
    expect(screen.queryByRole('option', { name: /USD till/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: /Front till/ }))
    expect(localStorage.getItem('elite-pos-till-drawer-7')).toBe('3')
    await userEvent.type(screen.getByLabelText('Amount tendered'), '10')
    expect(screen.getByText('Change').nextSibling).toHaveTextContent(/2.00\s?AED/)
    await userEvent.click(screen.getByRole('button', { name: /^Pay/ }))
    await waitFor(() => expect(screen.getByText(/Invoice saved S-1/)).toBeInTheDocument())
    expect(sentSale(fetchMock)).toMatchObject({ treasuryId: 3, customerPartnerId: null, currencyId: 1, lines: [{ itemId: 2, quantity: 1, unitPrice: 8 }] })
  })

  it('blocks a short tender', async () => {
    mockFetch(references)
    localStorage.setItem('elite-pos-till-drawer-7', '3')
    const { scan } = await open()
    await userEvent.type(scan, 'BRU-400{Enter}')
    await userEvent.type(screen.getByLabelText('Amount tendered'), '5')
    expect(screen.getByText('Short by').nextSibling).toHaveTextContent(/3.00\s?AED/)
    await userEvent.click(screen.getByRole('button', { name: /^Pay/ }))
    expect(await screen.findByText('The tendered amount is less than the total.')).toBeInTheDocument()
  })

  it('puts a customer sale on account with no treasury', async () => {
    const fetchMock = mockFetch(references)
    const { scan } = await open()
    await userEvent.type(scan, 'BRU-400{Enter}')
    await userEvent.selectOptions(screen.getByLabelText('Customer'), '9')
    await userEvent.click(screen.getByRole('button', { name: /Put on account/ }))
    await waitFor(() => expect(screen.getByText(/Invoice saved/)).toBeInTheDocument())
    expect(sentSale(fetchMock)).toMatchObject({ customerPartnerId: 9, treasuryId: null })
  })
})
