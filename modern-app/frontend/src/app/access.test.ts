import { describe, expect, it } from 'vitest'
import { canOpenSection } from './access'

describe('canOpenSection', () => {
  it('opens home, items and the design lab for everyone', () => {
    for (const section of ['home', 'items', 'lab:overview']) expect(canOpenSection(section, [])).toBe(true)
  })

  it('keeps sections it does not know closed', () => {
    expect(canOpenSection('something-new', ['USER_MANAGEMENT', 'SETTINGS_MANAGE'])).toBe(false)
  })

  it('needs any one of the section codes', () => {
    expect(canOpenSection('sales', ['SALES_CREATE'])).toBe(true)
    expect(canOpenSection('sales', ['SALES_VIEW'])).toBe(true)
    expect(canOpenSection('sales', ['INVENTORY_VIEW'])).toBe(false)
    expect(canOpenSection('treasury-transfer', ['TREASURY_VIEW'])).toBe(false)
    expect(canOpenSection('purchase-import', ['PURCHASES_VIEW'])).toBe(true)
  })

  it('treats customer pages as the partners section', () => {
    expect(canOpenSection('customer:abc', [])).toBe(false)
    expect(canOpenSection('new-customer', ['PARTNERS_MANAGE'])).toBe(true)
  })

  it('keeps roles with user management and other settings with settings management', () => {
    expect(canOpenSection('settings', ['USER_MANAGEMENT'])).toBe(true)
    expect(canOpenSection('settings:ROLES', ['USER_MANAGEMENT'])).toBe(true)
    expect(canOpenSection('settings:ROLES', ['SETTINGS_MANAGE'])).toBe(false)
    expect(canOpenSection('settings:BRANCHES', ['USER_MANAGEMENT'])).toBe(false)
    expect(canOpenSection('settings:BRANCHES', ['SETTINGS_MANAGE'])).toBe(true)
  })
})
