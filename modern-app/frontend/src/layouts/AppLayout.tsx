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

type NavItem = { id: string; en: string; ar: string; icon: IconName; match?: (section: string) => boolean }
type NavGroup = { en: string; ar: string; items: NavItem[] }

// One menu definition drives the sidebar, the active state and the breadcrumb.
const navGroups: NavGroup[] = [
  { en: '', ar: '', items: [{ id: 'home', en: 'Home', ar: 'الرئيسية', icon: 'dashboard' }] },
  { en: 'Sell', ar: 'البيع', items: [
    { id: 'sales', en: 'Sales', ar: 'المبيعات', icon: 'sales' },
    { id: 'sales-returns', en: 'Sales returns', ar: 'مرتجعات المبيعات', icon: 'swap' },
  ] },
  { en: 'Stock', ar: 'المخزون', items: [
    { id: 'inventory', en: 'Inventory', ar: 'المخزون', icon: 'inventory' },
    { id: 'items', en: 'Items', ar: 'الأصناف', icon: 'items' },
    { id: 'purchases', en: 'Purchases', ar: 'المشتريات', icon: 'purchases', match: section => section === 'purchases' || section === 'purchase-import' },
    { id: 'purchase-returns', en: 'Purchase returns', ar: 'مرتجعات المشتريات', icon: 'swap' },
  ] },
  { en: 'Money', ar: 'المالية', items: [
    { id: 'accounts', en: 'Accounts', ar: 'الحسابات', icon: 'currency' },
    { id: 'receipts', en: 'Receipts', ar: 'الإيصالات', icon: 'history' },
    { id: 'expenses', en: 'Expenses', ar: 'المنصرفات', icon: 'wallet' },
    { id: 'treasury-transfer', en: 'Treasury transfer', ar: 'تحويل بين الخزن', icon: 'bank' },
  ] },
  { en: 'Admin', ar: 'الإدارة', items: [
    { id: 'customers', en: 'Partners', ar: 'الشركاء', icon: 'customers', match: section => section === 'customers' || section === 'new-customer' || section.startsWith('customer:') },
    { id: 'reports', en: 'Reports', ar: 'التقارير', icon: 'reports' },
    { id: 'users', en: 'Users', ar: 'المستخدمون', icon: 'users' },
    { id: 'settings', en: 'Settings', ar: 'الإعدادات', icon: 'settings', match: section => section === 'settings' || section.startsWith('settings:') },
  ] },
]

const isActive = (item: NavItem, section: string) => item.match ? item.match(section) : section === item.id

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
  const designLabActive = activeSection.startsWith('lab:')
  const showDesignLab = import.meta.env.DEV || designLabActive
  const activeGroup = navGroups.find(group => group.items.some(item => isActive(item, activeSection)))
  const activeItem = activeGroup?.items.find(item => isActive(item, activeSection))
  const groupLabel = activeGroup && (rtl ? activeGroup.ar : activeGroup.en)
  const title = activeItem ? (rtl ? activeItem.ar : activeItem.en) : (rtl ? 'مختبر التصميم' : 'Design Lab')
  const languageTarget = rtl ? 'EN' : 'AR'
  const languageTitle = rtl ? 'التبديل إلى الإنجليزية' : 'Switch to Arabic'
  const labels = rtl
    ? { nav: 'التنقل الرئيسي', dev: 'التطوير', lab: 'مختبر التصميم', collapse: collapsed ? 'توسيع القائمة' : 'طي القائمة', theme: themeMode === 'light' ? 'التبديل إلى المظهر الداكن' : 'التبديل إلى المظهر الفاتح', operator: operatorName ?? 'مشغل محلي', database: 'قاعدة البيانات', offline: 'الخدمة المحلية غير متصلة' }
    : { nav: 'Main navigation', dev: 'Development', lab: 'Design Lab', collapse: collapsed ? 'Expand navigation' : 'Collapse navigation', theme: themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode', operator: operatorName ?? 'Local operator', database: 'Database', offline: 'Local service offline' }

  function navButton(id: string, label: string, glyph: IconName, active: boolean) {
    return <button key={id} className={`nav-item${active ? ' nav-item-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => onSectionChange(id)} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}><span className="nav-glyph"><Icon name={glyph} size={19} /></span><span className="nav-label">{label}</span></button>
  }

  return <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">E</span><span className="brand-copy"><strong>Elite POS</strong><small>{rtl ? 'نظام نقاط البيع' : 'Point of sale'}</small></span></div>
      <nav className="side-nav" aria-label={labels.nav}>
        {navGroups.map(group => <div key={group.en || 'home'} className="nav-group">
          {group.en && <div className="nav-caption">{rtl ? group.ar : group.en}</div>}
          {group.items.map(item => navButton(item.id, rtl ? item.ar : item.en, item.icon, isActive(item, activeSection)))}
        </div>)}
        {showDesignLab && <div className="nav-group">
          <div className="nav-caption">{labels.dev}</div>
          {navButton('lab:overview', labels.lab, 'design', designLabActive)}
          {designLabActive && <div className="nav-subitems">{demoSections.map(item => <button key={item.id} className={`nav-subitem${activeSection === item.id ? ' nav-subitem-active' : ''}`} onClick={() => onSectionChange(item.id)}><span className="nav-glyph"><Icon name={item.glyph} size={16} /></span><span>{rtl ? item.ar : item.en}</span></button>)}</div>}
        </div>}
      </nav>
      <div className="sidebar-bottom"><span className={`service-dot${serviceOnline ? ' service-online' : serviceOnline === false ? ' service-offline' : ''}`} /><span className="service-label">{serviceOnline ? `${labels.database} · ${serviceProvider ?? 'Local'}` : labels.offline}</span></div>
    </aside>
    <div className="main-column">
      <header className="top-bar">
        <div className="header-leading"><IconButton variant="quiet" className="sidebar-toggle" label={labels.collapse} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}><Icon name="menu" size={20} /></IconButton><div className="breadcrumb">{groupLabel && <><span>{groupLabel}</span><span className="breadcrumb-separator" aria-hidden="true">/</span></>}<strong>{title}</strong></div></div>
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

// The top bar already names the section, so the eyebrow is accepted for compatibility but not shown.
export function PageHeader({ title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return <div className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>
}
