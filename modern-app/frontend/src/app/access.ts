// Which permission codes open each section. A section opens when the user holds any one of its codes.
// The API still enforces every action; this only keeps people away from pages that would answer 403.
// Sections not listed here (home, items, the design lab) open for every signed-in user.
const sectionPermissions: Record<string, readonly string[]> = {
  sales: ['SALES_CREATE', 'SALES_VIEW'],
  'sales-returns': ['SALES_RETURN', 'SALES_VIEW'],
  inventory: ['INVENTORY_VIEW'],
  purchases: ['PURCHASES_VIEW'],
  'purchase-import': ['PURCHASES_VIEW'],
  'purchase-returns': ['PURCHASE_RETURN', 'PURCHASES_VIEW'],
  accounts: ['TREASURY_VIEW'],
  receipts: ['TREASURY_VIEW'],
  expenses: ['TREASURY_VIEW'],
  'treasury-transfer': ['TREASURY_MANAGE'],
  customers: ['PARTNERS_MANAGE', 'SALES_VIEW', 'PURCHASES_VIEW', 'TREASURY_VIEW'],
  reports: ['REPORTS_VIEW'],
  users: ['USER_MANAGEMENT'],
  settings: ['SETTINGS_MANAGE', 'USER_MANAGEMENT'],
}

function sectionKey(section: string) {
  if (section === 'new-customer' || section.startsWith('customer:')) return 'customers'
  // Roles and users live under Settings but are user management; every other settings page is settings management.
  if (section.startsWith('settings:ROLES') || section.startsWith('settings:USERS')) return 'users'
  if (section.startsWith('settings:')) return 'settings-detail'
  return section
}

export function canOpenSection(section: string, permissions: readonly string[]) {
  const key = sectionKey(section)
  const required = key === 'settings-detail' ? ['SETTINGS_MANAGE'] : sectionPermissions[key]
  return !required || required.some(code => permissions.includes(code))
}
