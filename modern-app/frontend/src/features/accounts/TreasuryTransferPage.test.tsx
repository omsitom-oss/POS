import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockFetch } from '../../test/fetchMock'
import { TreasuryTransferPage } from './TreasuryTransferPage'

const currencies = [
  { currencyId: 1, currencyCode: 'SDG', currencyNameEn: 'Pound', currencyNameAr: 'جنيه', symbol: 'SDG', isPrimary: true, exchangeRate: null, isActive: true, flagBase64: null },
  { currencyId: 2, currencyCode: 'USD', currencyNameEn: 'Dollar', currencyNameAr: 'دولار', symbol: 'USD', isPrimary: false, exchangeRate: 600, isActive: true, flagBase64: null },
]
const treasuries = [
  { treasuryId: 1, nameAr: 'الصندوق', nameEn: 'Main till', currencyId: 1, currencySymbol: 'SDG', currencyCode: 'SDG', isActive: true },
  { treasuryId: 2, nameAr: 'دولار', nameEn: 'Dollar safe', currencyId: 2, currencySymbol: 'USD', currencyCode: 'USD', isActive: true },
  { treasuryId: 3, nameAr: 'بنك', nameEn: 'Bank SDG', currencyId: 1, currencySymbol: 'SDG', currencyCode: 'SDG', isActive: true },
]
const statement = (debit: number) => ({ rows: [{ foreignDebit: debit, foreignCredit: 0 }] })

function setup() {
  mockFetch([
    { path: '/api/treasuries', body: treasuries },
    { path: '/api/currencies', body: currencies },
    { path: '/api/transactions/treasury/1', body: statement(1_200_000) },
    { path: '/api/transactions/treasury/2', body: statement(50) },
    { path: '/api/transactions/treasury/3', body: statement(10) },
  ])
  render(<TreasuryTransferPage locale="en" />)
}

async function choose(index: number, name: RegExp) {
  await userEvent.click(screen.getAllByRole('button', { name: /Choose treasury|·/ })[index])
  await userEvent.click(await screen.findByRole('option', { name }))
}

const amountInputs = () => screen.getAllByPlaceholderText('0.00') as HTMLInputElement[]

describe('TreasuryTransferPage', () => {
  it('converts the amount with the pair rate and shows both balances', async () => {
    setup()
    await choose(0, /Main till/)
    expect(await screen.findByText('Available: 1,200,000.00 SDG')).toBeInTheDocument()
    await choose(1, /Dollar safe/)
    expect(await screen.findByText('Available after transfer: 50.00 USD')).toBeInTheDocument()
    expect(screen.getByDisplayValue('600')).toBeInTheDocument()
    await userEvent.type(amountInputs()[0], '1200')
    expect(amountInputs()[1]).toHaveValue(2)
    await userEvent.clear(amountInputs()[1])
    await userEvent.type(amountInputs()[1], '3')
    expect(amountInputs()[0]).toHaveValue(1800)
  })

  it('copies the amount for treasuries in the same currency', async () => {
    setup()
    await choose(0, /Main till/)
    await choose(1, /Bank SDG/)
    await userEvent.type(amountInputs()[0], '75')
    await waitFor(() => expect(amountInputs()[1]).toHaveValue(75))
    expect(amountInputs()[1]).toBeDisabled()
  })
})
