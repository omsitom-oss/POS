import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockFetch } from '../../test/fetchMock'
import { ReceiptsPage } from './ReceiptsPage'

const chequeReceipt = { moveNo: 8, receiptNo: 'CHQ-IN-031026-0001', type: 'RECEIPT', receiptDate: '2026-10-03', partnerId: 4, partnerName: 'Al Noor Clinic', treasuryId: 2, treasuryName: 'Current account', currencyId: 1, currencyCode: 'AED', currencySymbol: 'AED', amount: 250, partnerAmount: 250, partnerCurrencyCode: 'AED', partnerCurrencySymbol: 'AED', exchangeRate: 1, reason: null, description: null, method: 'CHEQUE', chequeId: 1, chequeNo: 'IN-100', chequeDueDate: '2026-11-01T00:00:00', chequeStatus: 'PENDING' }
const routes = [
  { path: '/api/receipts', body: [chequeReceipt] },
  { path: '/api/partners/options', body: [{ partnerId: 4, partnerCode: 'C-4', partnerName: 'Al Noor Clinic', status: 'ACTIVE' }] },
  { path: '/api/treasuries', body: [{ treasuryId: 2, treasuryCode: 'B-1', nameAr: 'حساب جاري', nameEn: 'Current account', treasureType: 'BANK', currencyId: 1, currencySymbol: 'AED', currencyCode: 'AED', isActive: true }] },
  { path: '/api/currencies', body: [{ currencyId: 1, currencyCode: 'AED', currencyNameEn: 'Dirham', currencyNameAr: 'درهم', symbol: 'AED', isPrimary: true, exchangeRate: 1, isActive: true, flagBase64: null }] },
  { path: /^\/api\/transactions\/partner\/4\/balance$/, body: { amount: 0, debit: 0, credit: 0, currencyId: 1, currencyCode: 'AED', currencySymbol: 'AED' } },
]

describe('ReceiptsPage', () => {
  it('shows the payment method and cheque number in the list', async () => {
    mockFetch(routes)
    render(<ReceiptsPage locale="en" />)
    const row = (await screen.findByText('CHQ-IN-031026-0001')).closest('tr')!
    expect(row).toHaveTextContent('Cheque IN-100 2026-11-01')
  })

  it('records a receipt paid by cheque with its number and due date', async () => {
    const fetchMock = mockFetch([...routes, { method: 'POST', path: '/api/receipts', status: 201, body: {} }])
    render(<ReceiptsPage locale="en" />)
    await userEvent.click(await screen.findByRole('button', { name: /^＋ Receipt$/ }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cheque' }))
    expect(within(dialog).getByText('Deposit to (bank)')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: /Save receipt/ }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Choose the partner')

    await userEvent.click(within(dialog).getByText('Choose partner'))
    await userEvent.click(within(dialog).getByText('Al Noor Clinic'))
    const amounts = within(dialog).getAllByRole('textbox').filter(input => input.classList.contains('receipt-number-input'))
    await userEvent.type(amounts[0], '250')
    await userEvent.click(within(dialog).getByRole('button', { name: /Save receipt/ }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter the cheque number and due date.')

    await userEvent.type(within(dialog).getByLabelText(/Cheque no\./), ' IN-200 ')
    await userEvent.click(within(dialog).getByRole('button', { name: /Save receipt/ }))
    const [, init] = await waitForPost(fetchMock)
    expect(JSON.parse(String(init?.body))).toMatchObject({ type: 'RECEIPT', method: 'CHEQUE', chequeNo: 'IN-200', partnerId: 4, treasuryId: 2, amount: 250, partnerAmount: 250 })
    expect(JSON.parse(String(init?.body)).chequeDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

async function waitForPost(fetchMock: ReturnType<typeof mockFetch>) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const call = fetchMock.mock.calls.find(([url, request]) => url === '/api/receipts' && request?.method === 'POST')
    if (call) return call
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('No POST /api/receipts')
}
