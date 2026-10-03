import { useEffect, useState } from 'react'
import { DesignLabPage } from '../features/design-lab/DesignLabPage'
import { ManagementPage } from '../features/management/ManagementPage'
import { SettingsPage, type SettingsRoute } from '../features/settings/SettingsPage'
import { AppLayout, type Locale, type ThemeMode } from '../layouts/AppLayout'
import { CurrencyRatesDialog } from '../features/currencies/CurrencyRatesDialog'
import { UsersPage } from '../features/users/UsersPage'
import { ItemsPage } from '../features/items/ItemsPage'
import { ReceiptsPage } from '../features/receipts/ReceiptsPage'
import { AccountsPage } from '../features/accounts/AccountsPage'
import { TreasuryTransferPage } from '../features/accounts/TreasuryTransferPage'
import { PurchasesPage } from '../features/purchases/PurchasesPage'
import { LoginPage, type AuthSession } from '../features/auth/LoginPage'
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { ExpensesPage } from '../features/expenses/ExpensesPage'
import { ImportPurchasePage } from '../features/purchases/ImportPurchasePage'
import { SalesPage } from '../features/sales/SalesPage'
import { ReportsPage } from '../features/reports/ReportsPage'
import { clearSession, readSession, saveSession, sessionExpiredEvent } from './session'

type Health = { provider: string; connected: boolean; message: string }

function App() {
  const [locale, setLocale] = useState<Locale>('en')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try { return localStorage.getItem('elite-pos-theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  const [section, setSection] = useState(() => sectionFromPath(window.location.pathname))
  const settings = parseSettingsSection(section)
  const isManagement = section === 'customers' || section === 'new-customer' || section.startsWith('customer:')
  const customerPublicId = section.startsWith('customer:') ? section.slice('customer:'.length) : undefined
  const [health, setHealth] = useState<Health | null>(null)
  const [managementOnline, setManagementOnline] = useState<boolean | null>(null)
  const [ratesOpen, setRatesOpen] = useState(false)
  const [purchaseImportId, setPurchaseImportId] = useState<number | undefined>()
  const [session, setSession] = useState<AuthSession | null>(readSession)

  useEffect(() => {
    const expire = () => setSession(null)
    window.addEventListener(sessionExpiredEvent, expire)
    return () => window.removeEventListener(sessionExpiredEvent, expire)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  useEffect(() => {
    try { localStorage.setItem('elite-pos-theme', themeMode) } catch { /* Theme still applies for this session. */ }
    document.documentElement.dataset.theme = themeMode
    document.documentElement.style.colorScheme = themeMode
  }, [themeMode])

  useEffect(() => {
    const restoreLocation = () => setSection(sectionFromPath(window.location.pathname))
    window.addEventListener('popstate', restoreLocation)
    return () => window.removeEventListener('popstate', restoreLocation)
  }, [])

  function navigate(section: string) {
    const nextSection = section
    setSection(nextSection)
    const path = nextSection === 'sales' ? '/sales' : nextSection === 'reports' ? '/reports' : nextSection === 'settings' ? '/settings' : nextSection === 'users' ? '/users' : nextSection === 'items' ? '/items' : nextSection === 'accounts' ? '/accounts' : nextSection === 'treasury-transfer' ? '/accounts/transfer' : nextSection === 'receipts' ? '/receipts' : nextSection === 'expenses' ? '/expenses' : nextSection === 'purchases' ? '/purchases' : nextSection === 'purchase-import' ? '/purchases/import' : nextSection === 'inventory' ? '/inventory' : nextSection.startsWith('settings:') ? settingsPath(nextSection) : nextSection.startsWith('lab:') ? '/design-lab' : nextSection === 'customers' || nextSection.startsWith('customer:') ? '/customers' : '/settings'
    if (window.location.pathname !== path) window.history.pushState(null, '', path)
  }

  useEffect(() => {
    let active = true
    const refreshHealth = async () => {
      try {
        const response = await fetch('/api/health')
        if (!response.ok) throw new Error('Service is unavailable')
        const result = (await response.json()) as Health
        if (active) setHealth(result)
      } catch {
        if (active) setHealth({ provider: 'Unknown', connected: false, message: 'Local service is not running.' })
      }
    }
    void refreshHealth()
    const timer = window.setInterval(refreshHealth, 15000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (!isManagement) {
      return
    }
    let active = true
    fetch('/api/management/health')
      .then(response => { if (!response.ok) throw new Error('Management database unavailable'); return response.json() as Promise<{ connected: boolean }> })
      .then(result => { if (active) setManagementOnline(result.connected) })
      .catch(() => { if (active) setManagementOnline(false) })
    return () => { active = false }
  }, [isManagement])

  if (!session) return <LoginPage locale={locale} onLogin={setSession} themeMode={themeMode} onLocaleChange={setLocale} onThemeModeChange={setThemeMode} />
  if (session.mustChangePassword) return <ChangePasswordPage locale={locale} onChanged={() => { const next = { ...session, mustChangePassword: false }; saveSession(next); setSession(next) }} />

  const content = section === 'accounts'
    ? <AccountsPage locale={locale} />
    : section === 'treasury-transfer'
    ? <TreasuryTransferPage locale={locale} />
    : section === 'sales'
    ? <SalesPage locale={locale} branchId={session.branchId} userId={session.userId} />
    : section === 'reports'
    ? <ReportsPage locale={locale} />
    : section === 'purchases'
    ? <PurchasesPage locale={locale} onImport={(purchaseId) => { setPurchaseImportId(purchaseId); navigate('purchase-import') }} />
    : section === 'purchase-import'
    ? <ImportPurchasePage locale={locale} purchaseId={purchaseImportId} onBack={() => { setPurchaseImportId(undefined); navigate('purchases') }} />
    : section === 'inventory'
    ? <InventoryPage locale={locale} branchId={session.branchId} branchName={locale === 'ar' ? session.branchNameAr : session.branchNameEn} userId={session.userId} />
    : section === 'receipts'
    ? <ReceiptsPage locale={locale} />
    : section === 'expenses'
    ? <ExpensesPage locale={locale} />
    : section === 'items'
    ? <ItemsPage locale={locale} />
    : section === 'users'
    ? <UsersPage locale={locale} onBack={() => navigate('settings')} />
    : settings
    ? <SettingsPage locale={locale} view={settings} onNavigate={navigate} />
    : isManagement
    ? <ManagementPage locale={locale} view={section === 'new-customer' ? 'new-customer' : customerPublicId ? 'customer-details' : 'customers'} customerPublicId={customerPublicId} onNavigate={navigate} />
    : <DesignLabPage locale={locale} section={section.replace(/^lab:/, '')} />

  return <AppLayout locale={locale} onLocaleChange={setLocale} themeMode={themeMode} onThemeModeChange={setThemeMode} activeSection={section} onSectionChange={navigate} serviceOnline={isManagement ? managementOnline : health?.connected ?? null} serviceProvider={isManagement ? 'POSManagement' : health?.provider} operatorName={session.userName} branchName={locale === 'ar' ? session.branchNameAr : session.branchNameEn} onLogout={() => { void fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined); clearSession(); setSession(null) }} onExchangeRates={isManagement ? undefined : () => setRatesOpen(true)}><>{content}<CurrencyRatesDialog open={ratesOpen} locale={locale} onClose={() => setRatesOpen(false)} /></></AppLayout>
}

function sectionFromPath(path: string) {
  if (path === '/design-lab') return 'lab:overview'
  if (path === '/sales') return 'sales'
  if (path === '/reports') return 'reports'
  if (path === '/customers') return 'customers'
  if (path === '/users') return 'users'
  if (path === '/items') return 'items'
  if (path === '/accounts') return 'accounts'
  if (path === '/accounts/transfer') return 'treasury-transfer'
  if (path === '/receipts') return 'receipts'
  if (path === '/expenses') return 'expenses'
  if (path === '/purchases/import') return 'purchase-import'
  if (path === '/purchases') return 'purchases'
  if (path === '/inventory') return 'inventory'
  const settingsMatch = path.match(/^\/settings(?:\/([^/]+)(?:\/(.*))?)?\/?$/)
  if (settingsMatch?.[1]) {
    const code = decodeURIComponent(settingsMatch[1])
    const ids = (settingsMatch[2] ?? '').split('/').filter(Boolean).map(Number).filter(id => Number.isInteger(id) && id > 0)
    return `settings:${code}${ids.length ? `:${ids.join('/')}` : ''}`
  }
  return 'settings'
}

function parseSettingsSection(section: string): SettingsRoute | null {
  if (section === 'settings') return { typeCode: null, path: [] }
  if (!section.startsWith('settings:')) return null
  const [, typeCode, path = ''] = section.split(':')
  return { typeCode, path: path.split('/').filter(Boolean).map(Number).filter(id => Number.isInteger(id) && id > 0) }
}

function settingsPath(section: string) {
  const route = parseSettingsSection(section)
  if (!route?.typeCode) return '/settings'
  const path = route.path.length ? `/${route.path.join('/')}` : ''
  return `/settings/${encodeURIComponent(route.typeCode)}${path}`
}

export default App


