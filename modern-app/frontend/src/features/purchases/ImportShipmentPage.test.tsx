import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockFetch } from '../../test/fetchMock'
import { ImportShipmentPage } from './ImportShipmentPage'
import { allocate } from './importModel'

const shipment = (status: string, costs: unknown[] = []) => ({
  purchaseId: 7, invoiceNo: 'PO-1-00007', status, branchId: 1, supplierPartnerId: 9, supplierName: 'Gulf Pharma', purchaseDate: '2026-10-04T00:00:00',
  currencyId: 2, currencyCode: 'SAR', currencySymbol: 'SR', exchangeRateToBase: 160, countryId: 3, supplierInvoiceNo: 'INV-77', shipmentReference: 'BL-9',
  allocationMethod: 'VALUE', goodsTotal: 1000, goodsBase: 160000, costsBase: 32300, landedBase: 192300, receivedAt: null,
  lines: [
    { purchaseLineId: 1, itemId: 1, itemName: 'Panadol', unitSettingId: 5, unitName: 'Box', quantity: 30, unitPrice: 20, lineTotal: 600, goodsBase: 96000, allocatedCostBase: 19380, landedTotalBase: 115380, landedUnitCostBase: 3846, expiryDate: '2028-05-31', batchNo: 'LOT-A', barcode: null },
    { purchaseLineId: 2, itemId: 2, itemName: 'Brufen', unitSettingId: 5, unitName: 'Box', quantity: 100, unitPrice: 4, lineTotal: 400, goodsBase: 64000, allocatedCostBase: 12920, landedTotalBase: 76920, landedUnitCostBase: 769.2, expiryDate: null, batchNo: null, barcode: null },
  ],
  costs,
})

const freight = { costId: 4, costType: 'FREIGHT', amount: 200, currencyId: 2, currencyCode: 'SAR', currencySymbol: 'SR', exchangeRateToBase: 160, baseAmount: 32000, payeeType: 'PARTNER', payeePartnerId: 12, payeeTreasuryId: null, payeeAccountCode: null, payeeName: 'Red Sea Lines', description: null, paidTo: null }
const customs = { costId: 5, costType: 'CUSTOMS', amount: 300, currencyId: 1, currencyCode: 'SDG', currencySymbol: 'SDG', exchangeRateToBase: 1, baseAmount: 300, payeeType: 'TREASURY', payeePartnerId: null, payeeTreasuryId: 3, payeeAccountCode: null, payeeName: 'Main till', description: 'Receipt 55', paidTo: 'Port broker' }

function routes(detail: unknown) {
  return [
    { path: '/api/items', body: [{ itemId: 1, nameAr: 'بنادول', nameEn: 'Panadol', lastPurchasePrice: 3200 }, { itemId: 2, nameAr: 'بروفين', nameEn: 'Brufen' }] },
    { path: '/api/partners', body: [{ customerCode: 'SUP-1', businessName: 'Gulf Pharma', partnerTypeCode: 'SUPPLIER', status: 'ACTIVE' }, { customerCode: 'SHP-1', businessName: 'Red Sea Lines', partnerTypeCode: 'SUPPLIER', status: 'ACTIVE' }] },
    { path: '/api/partners/options', body: [{ partnerId: 9, partnerCode: 'SUP-1', partnerName: 'Gulf Pharma', status: 'ACTIVE' }, { partnerId: 12, partnerCode: 'SHP-1', partnerName: 'Red Sea Lines', status: 'ACTIVE' }] },
    { path: '/api/locations/countries', body: [{ countryId: 3, nameAr: 'الهند', nameEn: 'India', isActive: true }] },
    { path: '/api/currencies', body: [{ currencyId: 1, currencyCode: 'SDG', symbol: 'SDG', currencyNameEn: 'Sudanese pound', currencyNameAr: 'جنيه', isPrimary: true, isActive: true, exchangeRate: 1 }, { currencyId: 2, currencyCode: 'SAR', symbol: 'SR', currencyNameEn: 'Saudi riyal', currencyNameAr: 'ريال', isPrimary: false, isActive: true, exchangeRate: 160 }] },
    { path: '/api/treasuries', body: [{ treasuryId: 3, nameAr: 'الخزنة', nameEn: 'Main till', currencyId: 1, currencySymbol: 'SDG', isActive: true }] },
    { path: '/api/imports/payable-accounts', body: [{ accountCode: '2200', nameAr: 'مستحقات', nameEn: 'Accrued import costs' }] },
    { path: '/api/imports/7', body: detail },
  ]
}

describe('import cost allocation', () => {
  it('shares costs by value or quantity and always adds up', () => {
    const lines = [{ value: 600, quantity: 30 }, { value: 400, quantity: 100 }]
    expect(allocate(lines, 32300, 'VALUE')).toEqual([19380, 12920])
    expect(allocate(lines, 130, 'QUANTITY')).toEqual([30, 100])
    const odd = allocate([{ value: 1, quantity: 1 }, { value: 1, quantity: 1 }, { value: 1, quantity: 1 }], 100, 'VALUE')
    expect(odd.reduce((sum, share) => sum + share, 0)).toBeCloseTo(100, 8)
  })
})

describe('ImportShipmentPage', () => {
  it('shows each cost with who is paid and the landed cost per unit', async () => {
    mockFetch(routes(shipment('DRAFT', [freight, customs])))
    render(<ImportShipmentPage locale="en" purchaseId={7} onBack={() => {}} />)

    expect(await screen.findByRole('heading', { name: /PO-1-00007/ })).toBeInTheDocument()
    expect(screen.getByText(/Owed to/)).toHaveTextContent('Red Sea Lines')
    expect(screen.getByText(/Paid from/)).toHaveTextContent('Main till to Port broker')
    const panadol = screen.getByText('Panadol').closest('tr')!
    expect(within(panadol).getByText('3,846.00')).toBeInTheDocument()
    expect(screen.getByText('No expiry')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Receive goods/ })).toBeEnabled()
  })

  it('asks to save changed items before the goods can be received', async () => {
    mockFetch(routes(shipment('DRAFT')))
    render(<ImportShipmentPage locale="en" purchaseId={7} onBack={() => {}} />)
    await screen.findByText('Brufen')

    await userEvent.click(within(screen.getByText('Brufen').closest('tr')!).getByRole('button', { name: 'Remove' }))

    expect(screen.getByText(/unsaved changes/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Receive goods/ })).toBeDisabled()
  })

  it('shows a received shipment read-only', async () => {
    mockFetch(routes(shipment('POSTED', [freight])))
    render(<ImportShipmentPage locale="en" purchaseId={7} onBack={() => {}} />)
    await screen.findByText('Panadol')
    expect(screen.queryByRole('button', { name: /Add item/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Receive goods/ })).not.toBeInTheDocument()
    expect(screen.getByText('Received')).toBeInTheDocument()
  })
})
