import { useState, type ReactNode } from 'react'
import { IconButton } from '../components/shared'
import { Icon, type IconName } from '../components/icons'

export type Locale = 'en' | 'ar'
export type ThemeMode = 'light' | 'dark'

const demoSections = [
  { id: 'lab:overview', en: 'Overview', ar: 'نظرة عامة', glyph: 'dashboard' as IconName },
  { id: 'lab:tables', en: 'Tables', ar: 'الجداول', glyph: 'inventory' as IconName },
  { id: 'lab:forms', en: 'Forms', ar: 'النماذج', glyph: 'edit' as IconName },
  { id: 'lab:pos', en: 'POS grid', ar: 'نقطة البيع', glyph: 'sales' as IconName },
  { id: 'lab:dialogs', en: 'Dialogs & states', ar: 'النوافذ والحالات', glyph: 'settings' as IconName },
]

export function AppLayout({ locale, onLocaleChange, themeMode, onThemeModeChange, activeSection, onSectionChange, children, serviceOnline, serviceProvider, onExchangeRates, operatorName, branchName, onLogout }: {
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  themeMode: ThemeMode
  onThemeModeChange: (mode: ThemeMode) => void
  activeSection: string
  onSectionChange: (section: string) => void
  children: ReactNode
  serviceOnline: boolean | null
  serviceProvider?: string
  onExchangeRates?: () => void
  operatorName?: string
  branchName?: string
  onLogout?: () => void
}) {
  const rtl = locale === 'ar'
  const [collapsed, setCollapsed] = useState(false)
  const [accountsExpanded, setAccountsExpanded] = useState(true)
  const managementActive = activeSection === 'customers' || activeSection === 'new-customer' || activeSection.startsWith('customer:')
  const settingsActive = activeSection === 'settings' || activeSection.startsWith('settings:')
  const usersActive = activeSection === 'users'
  const itemsActive = activeSection === 'items'
  const receiptsActive = activeSection === 'receipts'
  const expensesActive = activeSection === 'expenses'
  const purchasesActive = activeSection === 'purchases' || activeSection === 'purchase-import'
  const purchaseImportActive = activeSection === 'purchase-import'
  const inventoryActive = activeSection === 'inventory'
  const salesActive = activeSection === 'sales'
  const reportsActive = activeSection === 'reports'
  const transferActive = activeSection === 'treasury-transfer'
  const accountsActive = activeSection === 'accounts' || receiptsActive || expensesActive || transferActive
  const designLabActive = activeSection.startsWith('lab:')
  const languageTarget = rtl ? 'EN' : 'AR'
  const languageTitle = rtl ? 'التبديل إلى الإنجليزية' : 'Switch to Arabic'
  const title = salesActive ? (rtl ? 'المبيعات' : 'Sales') : reportsActive ? (rtl ? 'التقارير' : 'Reports') : managementActive ? (rtl ? 'إدارة الشركاء' : 'Partner Management') : purchaseImportActive ? (rtl ? 'استيراد بضاعة' : 'Import shipment') : purchasesActive ? (rtl ? 'المشتريات' : 'Purchases') : inventoryActive ? (rtl ? 'المخزون' : 'Inventory') : activeSection === 'accounts' ? (rtl ? 'الحسابات' : 'Accounts') : transferActive ? (rtl ? 'تحويل بين الخزن' : 'Treasury transfer') : receiptsActive ? (rtl ? 'الإيصالات' : 'Receipts') : expensesActive ? (rtl ? 'المنصرفات' : 'Expenses') : itemsActive ? (rtl ? 'الأصناف' : 'Items') : usersActive ? (rtl ? 'المستخدمون' : 'Users') : settingsActive ? (rtl ? 'الإعدادات' : 'Settings') : (rtl ? 'مختبر التصميم' : 'Design Lab')
  const labels = rtl
    ? { workspace: 'مساحة العمل', nav: 'التنقل الرئيسي', sales: 'المبيعات', accounts: 'الحسابات', receipts: 'الإيصالات', expenses: 'المنصرفات', purchases: 'المشتريات', inventory: 'المخزون', items: 'الأصناف', customers: 'الشركاء', suppliers: 'الموردون', settings: 'الإعدادات', reports: 'التقارير', users: 'المستخدمون', dev: 'التطوير', lab: 'مختبر التصميم', soon: 'قريباً', collapse: collapsed ? 'توسيع القائمة' : 'طي القائمة', theme: themeMode === 'light' ? 'التبديل إلى المظهر الداكن' : 'التبديل إلى المظهر الفاتح', language: 'اللغة', operator: operatorName ?? 'مشغل محلي', database: 'قاعدة البيانات' }
    : { workspace: 'Workspace', nav: 'Main navigation', sales: 'Sales', accounts: 'Accounts', receipts: 'Receipts', expenses: 'Expenses', purchases: 'Purchases', inventory: 'Inventory', items: 'Items', customers: 'Partners', suppliers: 'Suppliers', settings: 'Settings', reports: 'Reports', users: 'Users', dev: 'Development', lab: 'Design Lab', soon: 'Soon', collapse: collapsed ? 'Expand navigation' : 'Collapse navigation', theme: themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode', language: 'Language', operator: operatorName ?? 'Local operator', database: 'Database' }

  function navButton(id: string, label: string, glyph: IconName, disabled = false) {
    const active = id === 'sales' ? salesActive : id === 'reports' ? reportsActive : id === 'settings' ? settingsActive : id === 'customers' ? managementActive : id === 'users' ? usersActive : id === 'items' ? itemsActive : id === 'purchases' ? purchasesActive : id === 'inventory' ? inventoryActive : id === 'receipts' || id === 'accounts' ? receiptsActive : false
    return <button key={id} className={`nav-item${active ? ' nav-item-active' : ''}${disabled ? ' nav-disabled' : ''}`} onClick={() => !disabled && onSectionChange(id)} disabled={disabled} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}><span className="nav-glyph"><Icon name={glyph} size={19} /></span><span className="nav-label">{label}</span>{disabled ? <span className="nav-soon">{labels.soon}</span> : active && <span className="nav-current-dot" />}</button>
  }

  return <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">E</span><span className="brand-copy"><strong>Elite POS</strong><small>{rtl ? 'نظام نقاط البيع' : 'Point of sale'}</small></span></div>
      <nav className="side-nav" aria-label={labels.nav}>
        <div className="nav-caption">{labels.workspace}</div>
        {navButton('sales', labels.sales, 'sales')}
        <button className={`nav-item${accountsActive ? ' nav-item-active' : ''}`} onClick={() => setAccountsExpanded(value => !value)} title={collapsed ? labels.accounts : undefined} aria-label={collapsed ? labels.accounts : undefined} aria-expanded={accountsExpanded}><span className="nav-glyph"><Icon name="currency" size={19} /></span><span className="nav-label">{labels.accounts}</span><span className={`nav-expand-chevron${accountsExpanded ? ' is-open' : ''}`} aria-hidden="true"><Icon name="chevron-down" size={16} /></span>{accountsActive && <span className="nav-current-dot" />}</button>
        <div className={`nav-subitems accounts-subitems${accountsExpanded ? ' is-expanded' : ''}`}><button className={`nav-subitem${activeSection === 'accounts' ? ' nav-subitem-active' : ''}`} onClick={() => onSectionChange('accounts')}><span className="nav-glyph"><Icon name="dashboard" size={16} /></span><span>{rtl ? 'نظرة عامة' : 'Overview'}</span></button><button className={`nav-subitem${receiptsActive ? ' nav-subitem-active' : ''}`} onClick={() => onSectionChange('receipts')}><span className="nav-glyph"><Icon name="history" size={16} /></span><span>{labels.receipts}</span></button><button className={`nav-subitem${expensesActive ? ' nav-subitem-active' : ''}`} onClick={() => onSectionChange('expenses')}><span className="nav-glyph"><Icon name="arrow-right" size={16} /></span><span>{labels.expenses}</span></button><button className={`nav-subitem${transferActive ? ' nav-subitem-active' : ''}`} onClick={() => onSectionChange('treasury-transfer')}><span className="nav-glyph"><Icon name="currency" size={16} /></span><span>{rtl ? 'تحويل بين الخزن' : 'Treasury transfer'}</span></button></div>
        {navButton('purchases', labels.purchases, 'purchases')}
        {navButton('inventory', labels.inventory, 'inventory')}
        {navButton('items', labels.items, 'items')}
        {navButton('customers', labels.customers, 'customers')}
        {navButton('suppliers', labels.suppliers, 'suppliers', true)}
        {navButton('settings', labels.settings, 'settings')}
        {navButton('reports', labels.reports, 'reports')}
        {navButton('users', labels.users, 'users')}
        <div className="nav-divider" />
        <div className="nav-caption">{labels.dev}</div>
        <button className={`nav-item${designLabActive ? ' nav-item-active' : ''}`} onClick={() => onSectionChange('lab:overview')} title={collapsed ? labels.lab : undefined} aria-label={collapsed ? labels.lab : undefined}><span className="nav-glyph"><Icon name="design" size={19} /></span><span className="nav-label">{labels.lab}</span>{designLabActive && <span className="nav-current-dot" />}</button>
        {designLabActive && <div className="nav-subitems">{demoSections.map(item => <button key={item.id} className={`nav-subitem${activeSection === item.id ? ' nav-subitem-active' : ''}`} onClick={() => onSectionChange(item.id)}><span className="nav-glyph"><Icon name={item.glyph} size={16} /></span><span>{rtl ? item.ar : item.en}</span></button>)}</div>}
      </nav>
      <div className="sidebar-bottom"><span className={`service-dot${serviceOnline ? ' service-online' : serviceOnline === false ? ' service-offline' : ''}`} /><span className="service-label">{serviceOnline ? `${labels.database} · ${serviceProvider ?? 'Local'}` : 'Local service'}</span></div>
    </aside>
    <div className="main-column">
      <header className="top-bar">
        <div className="header-leading"><IconButton variant="quiet" className="sidebar-toggle" label={labels.collapse} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}><Icon name="menu" size={20} /></IconButton><div className="breadcrumb"><span>{labels.workspace}</span>{(transferActive || receiptsActive || expensesActive) && <><span className="breadcrumb-separator" aria-hidden="true">/</span><span>{labels.accounts}</span></>}<span className="breadcrumb-separator" aria-hidden="true">/</span><strong>{title}</strong></div></div>
        <div className="top-actions">
          {onExchangeRates && <IconButton variant="quiet" className="exchange-rates-toggle" label={rtl ? 'أسعار الصرف' : 'Exchange rates'} title={rtl ? 'أسعار الصرف' : 'Exchange rates'} onClick={onExchangeRates}><Icon name="currency" size={21} /></IconButton>}
          <IconButton className="theme-toggle" variant="quiet" label={labels.theme} title={labels.theme} onClick={() => onThemeModeChange(themeMode === 'light' ? 'dark' : 'light')}><Icon name={themeMode === 'light' ? 'moon' : 'sun'} size={21} /></IconButton>
          <IconButton variant="quiet" className="locale-toggle" label={languageTitle} title={languageTitle} onClick={() => onLocaleChange(rtl ? 'en' : 'ar')}>{languageTarget}</IconButton>
          <span className="top-divider" aria-hidden="true" />
          <div className="user-chip"><span className="user-avatar" aria-hidden="true">{(operatorName ?? (rtl ? 'م' : 'E')).slice(0, 1).toUpperCase()}</span><span className="user-name"><strong>{labels.operator}</strong>{branchName && <small>{branchName}</small>}</span></div>
          {onLogout && <IconButton variant="quiet" className="logout-button" label={rtl ? 'تسجيل الخروج' : 'Log out'} onClick={onLogout}><Icon name="logout" size={19} className="icon-flip-rtl" /></IconButton>}
        </div>
      </header>
      <main className="main-content">{children}</main>
    </div>
  </div>
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return <div className="page-header"><div>{eyebrow && <div className="page-eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>
}
