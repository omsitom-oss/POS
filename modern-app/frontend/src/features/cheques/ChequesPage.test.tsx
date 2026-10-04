import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockFetch } from '../../test/fetchMock'
import { ChequesPage } from './ChequesPage'
import { addDays, allowedActions, dueDateTotals, today, type Cheque } from './chequeModel'

const base: Cheque = {
  chequeId: 1, branchId: 1, direction: 'IN', chequeNo: 'IN-100', dueDate: addDays(today(), 3), partnerId: 4, partnerName: 'Al Noor Clinic',
  treasuryId: 2, treasuryNameAr: 'حساب جاري', treasuryNameEn: 'Current account', bankNameAr: 'بنك دبي', bankNameEn: 'Dubai Bank',
  currencyId: 1, currencyCode: 'AED', currencySymbol: 'AED', amount: 250, partnerAmount: 250, partnerCurrencySymbol: 'AED',
  voucherNo: 'CHQ-IN-031026-0001', voucherDate: today(), description: null, status: 'PENDING', statusDate: today(), statusByName: 'admin', statusAt: null, savedByName: 'admin', createdAt: today(),
}
const issued: Cheque = { ...base, chequeId: 2, direction: 'OUT', chequeNo: 'OUT-7', partnerName: 'Gulf Pharma', amount: 90, voucherNo: 'CHQ-OUT-031026-0002', dueDate: addDays(today(), -2) }
const bounced: Cheque = { ...base, chequeId: 3, chequeNo: 'IN-99', status: 'BOUNCED', amount: 40, voucherNo: 'CHQ-IN-011026-0001' }
const treasuries = [
  { treasuryId: 2, nameAr: 'حساب جاري', nameEn: 'Current account', treasureType: 'BANK', currencyId: 1, isActive: true, branchId: 1 },
  { treasuryId: 5, nameAr: 'حساب التوفير', nameEn: 'Savings account', treasureType: 'BANK', currencyId: 1, isActive: true, branchId: 1 },
  { treasuryId: 6, nameAr: 'الصندوق', nameEn: 'Cash till', treasureType: 'CASH', currencyId: 1, isActive: true, branchId: 1 },
]
const routes = [{ path: '/api/cheques', body: [base, issued, bounced] }, { path: '/api/treasuries', body: treasuries }]

describe('ChequesPage', () => {
  it('lists cheques with due-soon and past-due summaries', async () => {
    mockFetch(routes)
    render(<ChequesPage locale="en" canManage />)
    expect(await screen.findByText('IN-100')).toBeInTheDocument()
    expect(screen.getByText('Received, due in 7 days').parentElement).toHaveTextContent('250.00 AED')
    expect(screen.getByText('Past due, not cleared').parentElement).toHaveTextContent('90.00 AED')
    expect(within(screen.getByText('OUT-7').closest('tr')!).getByText('past due')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Issued' }))
    expect(screen.queryByText('IN-100')).not.toBeInTheDocument()
    expect(screen.getByText('OUT-7')).toBeInTheDocument()
  })

  it('clears a received cheque on the chosen date with a note', async () => {
    const fetchMock = mockFetch([...routes, { method: 'POST', path: '/api/cheques/1/actions', body: { cheque: { ...base, status: 'CLEARED' }, events: [] } }])
    render(<ChequesPage locale="en" canManage />)
    const row = (await screen.findByText('IN-100')).closest('tr')!
    expect(within(screen.getByText('IN-99').closest('tr')!).queryByRole('button', { name: 'Update' })).not.toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Update' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getAllByRole('button', { pressed: false }).map(button => button.textContent)).toEqual(['Clear', 'Bounce', 'Return to customer'])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Clear', pressed: false }))
    expect(dialog).toHaveTextContent('The bank balance goes up')
    await userEvent.type(within(dialog).getByRole('textbox'), 'Statement 12')
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Clear' }).at(-1)!)
    expect(await screen.findByText('Cheque IN-100: Cleared')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/cheques/1/actions')!
    expect(JSON.parse(String(init?.body))).toEqual({ action: 'CLEAR', date: today(), note: 'Statement 12' })
  })

  it('deposits a received cheque to another bank treasury', async () => {
    const fetchMock = mockFetch([...routes, { method: 'POST', path: '/api/cheques/1/actions', body: { cheque: { ...base, status: 'DEPOSITED', treasuryId: 5 }, events: [] } }])
    render(<ChequesPage locale="en" canManage />)
    await userEvent.click(within((await screen.findByText('IN-100')).closest('tr')!).getByRole('button', { name: 'Update' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByText('Current account'))
    expect(within(dialog).queryByText('Cash till')).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByText('Savings account'))
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Deposit' }).at(-1)!)
    expect(await screen.findByText('Cheque IN-100: Deposited')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/cheques/1/actions')!
    expect(JSON.parse(String(init?.body))).toMatchObject({ action: 'DEPOSIT', treasuryId: 5 })
  })

  it('shows the server refusal inside the dialog', async () => {
    mockFetch([...routes, { method: 'POST', path: '/api/cheques/1/actions', status: 400, body: { detail: 'The date cannot be before the voucher date.' } }])
    render(<ChequesPage locale="en" canManage />)
    await userEvent.click(within((await screen.findByText('IN-100')).closest('tr')!).getByRole('button', { name: 'Update' }))
    await userEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Deposit' }).at(-1)!)
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('before the voucher date')
  })

  it('offers no status moves without the permission but still shows the history', async () => {
    mockFetch([...routes, { path: '/api/cheques/1', body: { cheque: base, events: [{ chequeEventId: 5, fromStatus: null, toStatus: 'PENDING', eventDate: today(), moveNo: 3, note: null, savedByName: 'sara', savedAt: '2026-10-03T08:00:00' }] } }])
    render(<ChequesPage locale="ar" canManage={false} />)
    const row = (await screen.findByText('IN-100')).closest('tr')!
    expect(within(row).queryByRole('button', { name: 'تحديث' })).not.toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'السجل' }))
    expect(await within(screen.getByRole('dialog')).findByText('sara')).toBeInTheDocument()
  })

  it('totals by due date leave out bounced cheques', async () => {
    mockFetch(routes)
    render(<ChequesPage locale="en" canManage />)
    await screen.findByText('IN-100')
    await userEvent.click(screen.getByRole('tab', { name: 'By due date' }))
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('90.00')
    expect(rows[1]).toHaveTextContent('250.00')
  })
})

describe('cheque rules', () => {
  it('match the moves the server allows', () => {
    expect(allowedActions('IN', 'DEPOSITED')).toEqual(['CLEAR', 'BOUNCE'])
    expect(allowedActions('OUT', 'PENDING')).toEqual(['CLEAR', 'BOUNCE', 'CANCEL'])
    expect(allowedActions('OUT', 'CLEARED')).toEqual(['BOUNCE'])
    expect(allowedActions('IN', 'RETURNED')).toEqual([])
  })

  it('net received against issued per due date and currency', () => {
    const day = '2026-11-01T00:00:00'
    const totals = dueDateTotals([{ ...base, dueDate: day }, { ...issued, dueDate: day, status: 'CLEARED' }, { ...base, chequeId: 9, dueDate: day, currencySymbol: 'USD', amount: 10 }])
    expect(totals).toEqual([
      { dueDate: '2026-11-01', currencySymbol: 'AED', received: 250, issued: 90, count: 2 },
      { dueDate: '2026-11-01', currencySymbol: 'USD', received: 10, issued: 0, count: 1 },
    ])
  })
})
