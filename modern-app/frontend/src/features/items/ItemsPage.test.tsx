import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockFetch } from '../../test/fetchMock'
import { ItemsPage } from './ItemsPage'

const item = {
  itemId: 1, itemCode: 'ITM-0001', nameAr: 'بنادول', nameEn: 'Panadol', manufacturerName: 'GSK', imageBase64: null,
  categorySettingId: null, genericSettingId: null, categoryAr: null, categoryEn: null, baseUnitAr: 'حبة', baseUnitEn: 'Tablet',
  sellPrice: 2, lastPurchasePrice: 1.5, minimumLevelForAlert: 10, isActive: true,
}
const units = [{ settingId: 5, valueAr: 'علبة', valueEn: 'Box' }, { settingId: 6, valueAr: 'حبة', valueEn: 'Tablet' }]

function routes() {
  return [
    { path: '/api/items', body: [item] },
    { path: '/api/items/1', body: { item, units: [{ unitSettingId: 5, conversionToBase: 20, isBase: false, sortOrder: 0 }, { unitSettingId: 6, conversionToBase: 1, isBase: true, sortOrder: 1 }], priceHistory: [{ itemPriceHistoryId: 1, previousPrice: 1.8, newPrice: 2, userId: 3, userName: 'Omer', changedAt: '2026-09-01T10:00:00Z' }] } },
    { path: '/api/settings/types/ITEM_CATEGORY/items', body: [] },
    { path: '/api/settings/types/UNIT/items', body: units },
    { path: '/api/settings/types/GENERIC/items', body: [] },
    { path: '/api/currencies', body: [{ isPrimary: true, symbol: 'SDG' }] },
    { method: 'PUT', path: '/api/items/1', body: '' },
  ]
}

describe('ItemsPage', () => {
  it('opens an item with its unit hierarchy and price history, and saves it unchanged', async () => {
    const fetch = mockFetch(routes())
    render(<ItemsPage locale="en" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByDisplayValue('Panadol')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('tab', { name: /Units/ }))
    expect(within(dialog).getByText('1 Box = 20 Tablet')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('tab', { name: /Pricing/ }))
    expect(within(dialog).getByText('Omer')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    const put = fetch.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({
      nameEn: 'Panadol', sellPrice: 2, minimumLevelForAlert: 10,
      units: [{ unitSettingId: 5, conversionToBase: 20, isBase: false, sortOrder: 0 }, { unitSettingId: 6, conversionToBase: 1, isBase: true, sortOrder: 1 }],
    })
  })
})
