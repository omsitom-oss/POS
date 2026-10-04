import { useEffect, useMemo, useState } from 'react'
import { DataTable, type TableColumn } from '../../components/DataTable'
import { Button, Card, CheckInput, ConfirmDialog, EmptyState, ErrorState, FormField, IconButton, LoadingState, Modal, SearchInput, Select, StatusBadge, SwitchInput, TextInput } from '../../components/shared'
import { PageHeader, type Locale } from '../../layouts/AppLayout'
import { LocationsPage } from '../locations/LocationsPage'
import { Icon } from '../../components/icons'
import { CompanyProfilePage } from '../company-profile/CompanyProfilePage'
import { CurrenciesPage } from '../currencies/CurrenciesPage'
import { BranchesPage } from '../branches/BranchesPage'
import { RolesPage } from '../roles/RolesPage'
import { TreasuriesPage } from '../treasuries/TreasuriesPage'
import { BanksPage } from '../banks/BanksPage'
import { ApprovalSettingsPage } from './ApprovalSettingsPage'

type SettingType = { settingTypeId: number; code: string; nameAr: string; nameEn: string; isHierarchical: boolean; isActive: boolean; sortOrder: number; activeSettingCount?: number }
type Setting = { settingId: number; settingTypeId: number; parentSettingId: number | null; code: string | null; valueAr: string; valueEn: string; sortOrder: number; isActive: boolean; createdAt: string; updatedAt: string }
type TypeDraft = { nameAr: string; nameEn: string; isHierarchical: boolean; isActive: boolean }
const blankType: TypeDraft = { nameAr: '', nameEn: '', isHierarchical: false, isActive: true }
export type SettingsRoute = { typeCode: string | null; path: number[] }
type SettingsTab = 'basic' | 'items' | 'partners' | 'users' | 'finance'
type Draft = { valueAr: string; valueEn: string; parentSettingId: string; isActive: boolean }
const blank: Draft = { valueAr: '', valueEn: '', parentSettingId: '', isActive: true }
const typeDescriptions: Record<string, { en: string; ar: string }> = {
  UNIT: { en: 'Units of measurement used for items.', ar: 'وحدات القياس المستخدمة للأصناف.' },
  ITEM_CATEGORY: { en: 'Organize items into categories.', ar: 'تنظيم الأصناف ضمن تصنيفات.' },
  GENERIC: { en: 'Manage generic names used by items.', ar: 'إدارة الأسماء العلمية المستخدمة للأصناف.' },
  LOCATION: { en: 'Manage configurable locations.', ar: 'إدارة المواقع القابلة للتخصيص.' },
  PARTNER_TYPE: { en: 'Classify partners for daily operations.', ar: 'تصنيف الشركاء للاستخدام في العمليات اليومية.' },
}

export function SettingsPage({ locale, view, onNavigate }: { locale: Locale; view: SettingsRoute; onNavigate: (section: string) => void }) {
  const ar = locale === 'ar'
  const [types, setTypes] = useState<SettingType[]>([])
  const [typesLoading, setTypesLoading] = useState(true)
  const [typesRefresh, setTypesRefresh] = useState(0)
  const [showInactiveTypes] = useState(false)
  const [typeModalOpen, setTypeModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<SettingType | null>(null)
  const [typeDraft, setTypeDraft] = useState<TypeDraft>(blankType)
  const [typeSaving, setTypeSaving] = useState(false)
  const [typeError, setTypeError] = useState('')
  const [typeStatusTarget, setTypeStatusTarget] = useState<SettingType | null>(null)
  const [typeStatusBusy, setTypeStatusBusy] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('basic')
  const [items, setItems] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [loadedKey, setLoadedKey] = useState('')
  const [error, setError] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Setting | null>(null)
  const [draft, setDraft] = useState<Draft>(blank)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<Setting | null>(null)
  const [confirmError, setConfirmError] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)
  const [descendants, setDescendants] = useState<Setting[]>([])

  useEffect(() => {
    let current = true
    fetch(`/api/settings/types${showInactiveTypes ? '?includeInactive=true' : ''}`).then(async response => {
      if (!response.ok) throw new Error(await responseError(response))
      return response.json() as Promise<SettingType[]>
    }).then(data => { if (current) setTypes(data) }).catch(reason => { if (current) setError(message(reason)) }).finally(() => { if (current) setTypesLoading(false) })
    return () => { current = false }
  }, [showInactiveTypes, typesRefresh])

  const type = types.find(item => item.code === view.typeCode)
  const requestKey = [view.typeCode, showInactive, refresh].join('|')
  useEffect(() => {
    if (!view.typeCode || view.typeCode === 'COMPANY_PROFILE' || view.typeCode === 'CURRENCIES' || view.typeCode === 'BRANCHES' || view.typeCode === 'TREASURIES' || view.typeCode === 'BANKS' || view.typeCode === 'ROLES' || view.typeCode === 'USERS' || !types.length) return
    let current = true
    const query = type?.isHierarchical || showInactive ? '' : '?active=true'
    fetch(`/api/settings/types/${encodeURIComponent(view.typeCode)}/items${query}`).then(async response => {
      if (!response.ok) throw new Error(await responseError(response))
      return response.json() as Promise<Setting[]>
    }).then(data => { if (current) { setItems(data); setError('') } }).catch(reason => { if (current) setError(message(reason)) }).finally(() => { if (current) { setLoading(false); setLoadedKey(requestKey) } })
    return () => { current = false }
  }, [requestKey, view.typeCode, showInactive, refresh, type?.isHierarchical, types.length])
  const dataLoading = loading || loadedKey !== requestKey

  const byId = useMemo(() => new Map(items.map(item => [item.settingId, item])), [items])
  const current = view.path.length ? byId.get(view.path[view.path.length - 1]) : undefined
  const ancestors = useMemo(() => view.path.map(id => byId.get(id)).filter((item): item is Setting => Boolean(item)), [view.path, byId])
  const pathValid = (!type?.isHierarchical && view.path.length === 0 || type?.isHierarchical) && view.path.length === ancestors.length && ancestors.every((item, index) => item.parentSettingId === (index ? ancestors[index - 1].settingId : null))
  const childRows = useMemo(() => items.filter(item => item.parentSettingId === (current?.settingId ?? null) && (showInactive || item.isActive)), [items, current?.settingId, showInactive])
  const filteredChildren = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return query ? childRows.filter(item => [item.code, item.valueAr, item.valueEn].some(value => value?.toLocaleLowerCase().includes(query))) : childRows
  }, [childRows, search])
  const flatRows = useMemo(() => items.filter(item => item.parentSettingId === null && (showInactive || item.isActive)), [items, showInactive])

  function openAdd(parentId: number | null = null) {
    setEditing(null); setDraft({ ...blank, parentSettingId: parentId ? String(parentId) : '' }); setFormError(''); setModal(true)
  }
  function openEdit(item: Setting) {
    setEditing(item); setDraft({ valueAr: item.valueAr, valueEn: item.valueEn, parentSettingId: item.parentSettingId ? String(item.parentSettingId) : '', isActive: item.isActive }); setFormError(''); setModal(true)
  }
  async function save() {
    if (!draft.valueAr.trim() || !draft.valueEn.trim()) { setFormError(ar ? 'أدخل الاسم بالعربية والإنجليزية.' : 'Enter both Arabic and English names.'); return }
    if (!view.typeCode) return
    setSaving(true); setFormError('')
    const body = { valueAr: draft.valueAr.trim(), valueEn: draft.valueEn.trim(), parentSettingId: type?.isHierarchical && draft.parentSettingId ? Number(draft.parentSettingId) : null, isActive: draft.isActive }
    try {
      const response = await fetch(editing ? `/api/settings/items/${editing.settingId}` : `/api/settings/types/${encodeURIComponent(view.typeCode)}/items`, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(await responseError(response))
      setModal(false); setLoading(true); setRefresh(value => value + 1)
    } catch (reason) { setFormError(message(reason)) } finally { setSaving(false) }
  }
  async function requestDeactivate(item: Setting) {
    setConfirmTarget(item); setConfirmError('')
    if (!type?.isHierarchical) { setDescendants([]); return }
    const found: Setting[] = []
    const queue = [item.settingId]
    while (queue.length) {
      const parentId = queue.shift()!
      const children = items.filter(candidate => candidate.parentSettingId === parentId)
      found.push(...children); queue.push(...children.map(child => child.settingId))
    }
    setDescendants(found.filter(child => child.isActive))
  }
  async function updateStatus(item: Setting, active: boolean) {
    setSavingStatus(true); setConfirmError('')
    try {
      const response = await fetch(`/api/settings/items/${item.settingId}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' })
      if (!response.ok) throw new Error(await responseError(response))
      setConfirmTarget(null); setLoading(true); setRefresh(value => value + 1)
    } catch (reason) { setConfirmError(message(reason)) } finally { setSavingStatus(false) }
  }

  function openAddType() {
    setEditingType(null); setTypeDraft(blankType); setTypeError(''); setTypeModalOpen(true)
  }
  function openEditType(item: SettingType) {
    setEditingType(item); setTypeDraft({ nameAr: item.nameAr, nameEn: item.nameEn, isHierarchical: item.isHierarchical, isActive: item.isActive }); setTypeError(''); setTypeModalOpen(true)
  }
  async function saveType() {
    if (!typeDraft.nameAr.trim() || !typeDraft.nameEn.trim()) {
      setTypeError(ar ? 'أدخل الاسم بالعربية والإنجليزية.' : 'Enter both the Arabic and English names.')
      return
    }
    setTypeSaving(true); setTypeError('')
    const body = { nameAr: typeDraft.nameAr.trim(), nameEn: typeDraft.nameEn.trim(), isHierarchical: typeDraft.isHierarchical, isActive: typeDraft.isActive }
    try {
      const response = await fetch(editingType ? `/api/settings/types/${editingType.settingTypeId}` : '/api/settings/types', { method: editingType ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(await responseError(response))
      setTypeModalOpen(false); setTypesRefresh(value => value + 1)
    } catch (reason) { setTypeError(message(reason)) } finally { setTypeSaving(false) }
  }
  async function setTypeActive(item: SettingType, active: boolean) {
    setTypeStatusBusy(true); setTypeError('')
    try {
      const response = await fetch(`/api/settings/types/${item.settingTypeId}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' })
      if (!response.ok) throw new Error(await responseError(response))
      setTypeStatusTarget(null); setTypesRefresh(value => value + 1)
    } catch (reason) { setTypeError(message(reason)) } finally { setTypeStatusBusy(false) }
  }

  if (view.typeCode === 'LOCATION' && view.path.length === 0) return <LocationsPage locale={locale} onBack={() => onNavigate('settings')} />
  if (view.typeCode === 'COMPANY_PROFILE') return <CompanyProfilePage locale={locale} onBack={() => onNavigate('settings')} />
  if (view.typeCode === 'CURRENCIES') return <CurrenciesPage locale={locale} onBack={() => onNavigate('settings')} />
  if (view.typeCode === 'BRANCHES') return <BranchesPage locale={locale} onBack={() => onNavigate('settings')} />
  if (view.typeCode === 'TREASURIES') return <TreasuriesPage locale={locale} onBack={() => onNavigate('settings')} />
  if (view.typeCode === 'BANKS') return <BanksPage locale={locale} onBack={() => onNavigate('settings')} />
  if (view.typeCode === 'ROLES') return <RolesPage locale={locale} onBack={() => onNavigate('settings')} />
  if (view.typeCode === 'APPROVALS') return <ApprovalSettingsPage locale={locale} onBack={() => onNavigate('settings')} />
  const valueLabel = ar ? (type?.nameAr ?? 'قيمة') : (type?.nameEn ?? 'Value')
  const singular = ar ? ({ UNIT: 'وحدة', ITEM_CATEGORY: 'تصنيف', LOCATION: 'موقع', GENERIC: 'اسم علمي' }[view.typeCode ?? ''] ?? valueLabel) : ({ UNIT: 'Unit', ITEM_CATEGORY: 'Category', LOCATION: 'Location', GENERIC: 'Generic' }[view.typeCode ?? ''] ?? valueLabel)
  const actionLabels = ar
    ? { edit: 'تعديل', deactivate: 'تعطيل', reactivate: 'إعادة التفعيل' }
    : { edit: 'Edit', deactivate: 'Deactivate', reactivate: 'Reactivate' }
  const columns: TableColumn<Setting>[] = [
    { key: 'code', title: ar ? 'الرمز' : 'Code', value: item => item.code ?? '', render: item => <bdi dir="ltr" className="setting-code-cell">{item.code ?? ''}</bdi>, sortable: true, width: '18%' },
    { key: 'nameAr', title: ar ? 'الاسم بالعربية' : 'Arabic Name', value: item => item.valueAr, render: item => <bdi dir="rtl">{item.valueAr}</bdi>, sortable: true, width: '29%' },
    { key: 'nameEn', title: ar ? 'الاسم بالإنجليزية' : 'English Name', value: item => item.valueEn, render: item => <bdi dir="ltr">{item.valueEn}</bdi>, sortable: true, width: '29%' },
    { key: 'status', title: ar ? 'الحالة' : 'Status', value: item => item.isActive ? 'Active' : 'Inactive', render: item => <StatusBadge tone={item.isActive ? 'success' : 'danger'}>{item.isActive ? (ar ? 'نشط' : 'Active') : (ar ? 'غير نشط' : 'Inactive')}</StatusBadge> },
  ]
  const crumbs: Array<{ label: string; section: string }> = [{ label: ar ? 'الإعدادات' : 'Settings', section: 'settings' }]
  if (type) {
    crumbs.push({ label: ar ? type.nameAr : type.nameEn, section: `settings:${type.code}` })
    ancestors.forEach((item, index) => crumbs.push({ label: ar ? item.valueAr : item.valueEn, section: `settings:${type.code}:${view.path.slice(0, index + 1).join('/')}` }))
  }

  const typeDialogs = <>
    <Modal open={typeModalOpen} title={editingType ? (ar ? 'تعديل نوع الإعدادات' : 'Edit Setting Type') : (ar ? 'إضافة نوع إعدادات' : 'Add Setting Type')} description={ar ? 'إدارة القيمة المرجعية ثنائية اللغة المستخدمة في نقاط البيع.' : 'Maintain the bilingual reference category used by the POS.'} closeLabel={ar ? 'إغلاق' : 'Close'} onClose={() => !typeSaving && setTypeModalOpen(false)} busy={typeSaving} footer={<><Button variant="ghost" disabled={typeSaving} onClick={() => setTypeModalOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</Button><Button variant="primary" loading={typeSaving} onClick={() => void saveType()}>{ar ? 'حفظ' : 'Save'}</Button></>}>
      <div className="setting-type-form">
        <div className="setting-type-name-fields"><FormField label={ar ? 'الاسم بالعربية' : 'Arabic name'} required error={typeError && !typeDraft.nameAr.trim() ? typeError : undefined}><TextInput autoFocus dir="rtl" maxLength={150} value={typeDraft.nameAr} disabled={typeSaving} onChange={event => setTypeDraft({ ...typeDraft, nameAr: event.target.value })} /></FormField><FormField label={ar ? 'الاسم بالإنجليزية' : 'English name'} required error={typeError && !typeDraft.nameEn.trim() ? typeError : undefined}><TextInput dir="ltr" maxLength={150} value={typeDraft.nameEn} disabled={typeSaving} onChange={event => setTypeDraft({ ...typeDraft, nameEn: event.target.value })} /></FormField></div>
        <section className="setting-type-behavior"><h3>{ar ? 'السلوك' : 'Behavior'}</h3><div className="setting-type-behavior-grid"><SwitchInput label={ar ? 'هرمي' : 'Hierarchical'} hint={ar ? 'يدعم القيم المتداخلة' : 'Supports nested values'} checked={typeDraft.isHierarchical} disabled={typeSaving} onChange={event => setTypeDraft({ ...typeDraft, isHierarchical: event.target.checked })} /><SwitchInput label={ar ? 'نشط' : 'Active'} hint={ar ? 'متاح للاستخدام' : 'Available for use'} checked={typeDraft.isActive} disabled={typeSaving} onChange={event => setTypeDraft({ ...typeDraft, isActive: event.target.checked })} /></div></section>
        {typeError && typeDraft.nameAr.trim() && typeDraft.nameEn.trim() && <ErrorState title={ar ? 'تعذر الحفظ' : 'Could not save'} detail={typeError} />}
      </div>
    </Modal>
    <ConfirmDialog open={Boolean(typeStatusTarget)} title={ar ? 'تعطيل نوع الإعدادات؟' : 'Deactivate Setting Type?'} message={ar ? 'لن يكون نوع الإعدادات متاحاً للاستخدام النشط. ستبقى القيم والسجلات المرتبطة به دون تغيير.' : 'This setting type will no longer be available for normal active use. Its settings and related records will remain unchanged.'} confirmLabel={ar ? 'تعطيل' : 'Deactivate'} cancelLabel={ar ? 'إلغاء' : 'Cancel'} closeLabel={ar ? 'إغلاق' : 'Close'} danger busy={typeStatusBusy} onCancel={() => setTypeStatusTarget(null)} onConfirm={() => typeStatusTarget && void setTypeActive(typeStatusTarget, false)} />
    {typeError && !typeModalOpen && <div className="toast toast-error" role="alert"><span>{typeError}</span><Button variant="ghost" aria-label={ar ? 'إغلاق' : 'Dismiss'} onClick={() => setTypeError('')}><Icon name="close" size={16} /></Button></div>}
  </>

  if (!view.typeCode) return <div className="settings-page" dir={ar ? 'rtl' : 'ltr'}>
    <PageHeader eyebrow={ar ? 'إعدادات نقاط البيع' : 'POS SETTINGS'} title={ar ? 'الإعدادات' : 'Settings'} description={ar ? 'إدارة القيم المرجعية المستخدمة في Elite POS.' : 'Manage reference values used across Elite POS.'} actions={<Button variant="primary" onClick={openAddType}><Icon name="plus" size={18} />{ar ? 'إضافة نوع إعدادات' : 'Add Setting Type'}</Button>} />
    <nav className="settings-tabs" aria-label={ar ? 'تصنيفات الإعدادات' : 'Settings categories'}>{(['basic', 'items', 'partners', 'users', 'finance'] as SettingsTab[]).map(tab => <button type="button" key={tab} className={settingsTab === tab ? 'is-active' : ''} onClick={() => setSettingsTab(tab)}>{settingsTabLabel(tab, ar)}</button>)}</nav>
    {error ? <ErrorState title={ar ? 'تعذر تحميل أنواع الإعدادات' : 'Could not load setting types'} detail={error} /> : typesLoading ? <LoadingState /> : !types.length ? <EmptyState title={ar ? 'لا توجد أنواع إعدادات' : 'No setting types'} /> : <><div className={`setting-type-grid settings-tab-${settingsTab}`} style={{ display: 'none' }}>{types.filter(item => (showInactiveTypes || item.isActive) && settingsTabForCode(item.code) === settingsTab).map(item => {
      const description = typeDescriptions[item.code]
      return <article className={`setting-type-card${item.isActive ? '' : ' setting-type-inactive'}`} key={item.code}>
        <button type="button" className="setting-type-card-open" onClick={() => onNavigate(`settings:${item.code}`)}>
          <span className="setting-type-card-heading"><SettingTypeIcon code={item.code} /><strong>{ar ? item.nameAr : item.nameEn}</strong><span className="setting-card-chevron" aria-hidden="true">{ar ? '‹' : '›'}</span></span>
          <span className="setting-type-description">{description ? (ar ? description.ar : description.en) : ''}</span>
        </button>
        {!item.isActive && <StatusBadge tone="danger" className="setting-type-admin-status">{ar ? 'غير نشط' : 'Inactive'}</StatusBadge>}
        <div className={`setting-type-card-footer${ar ? ' is-arabic' : ''}`}>
          {Number.isFinite(item.activeSettingCount) && <span className="setting-type-count"><bdi dir="ltr">{formatCount(item.activeSettingCount ?? 0, ar)}</bdi><span>{countLabel(item.code, item.activeSettingCount ?? 0, ar)}</span></span>}
          <details className="setting-card-menu"><summary aria-label={ar ? 'إجراءات نوع الإعدادات' : 'Setting Type actions'}>•••</summary><div><button type="button" onClick={() => openEditType(item)}>{ar ? 'تعديل' : 'Edit'}</button>{item.isActive ? <button type="button" onClick={() => { setTypeStatusTarget(item); setTypeError('') }}>{ar ? 'تعطيل' : 'Deactivate'}</button> : <button type="button" onClick={() => void setTypeActive(item, true)}>{ar ? 'إعادة التفعيل' : 'Reactivate'}</button>}</div></details>
        </div>
      </article>
    })}<article className="setting-type-card company-profile-card"><button type="button" className="setting-type-card-open" onClick={() => onNavigate('settings:COMPANY_PROFILE')}><span className="setting-type-card-heading"><SettingTypeIcon code="COMPANY_PROFILE" /><strong>{ar ? 'ملف الشركة' : 'Company Profile'}</strong><span className="setting-card-chevron" aria-hidden="true"><Icon name={ar ? 'chevron-left' : 'chevron-right'} size={17} /></span></span><span className="setting-type-description">{ar ? 'بيانات الشركة المستخدمة في التقارير.' : 'Company details used in reports.'}</span></button><span className="setting-type-count company-profile-card-footer">{ar ? 'للتقارير والفواتير' : 'Reports and invoices'}</span></article><article className="setting-type-card company-profile-card"><button type="button" className="setting-type-card-open" onClick={() => onNavigate('settings:CURRENCIES')}><span className="setting-type-card-heading"><SettingTypeIcon code="CURRENCIES" /><strong>{ar ? 'العملات' : 'Currencies'}</strong><span className="setting-card-chevron" aria-hidden="true"><Icon name={ar ? 'chevron-left' : 'chevron-right'} size={17} /></span></span><span className="setting-type-description">{ar ? 'إدارة العملات والعملة الأساسية.' : 'Manage currencies and the primary currency.'}</span></button><span className="setting-type-count company-profile-card-footer">{ar ? 'بيانات مالية' : 'Financial setup'}</span></article><article className="setting-type-card company-profile-card"><button type="button" className="setting-type-card-open" onClick={() => onNavigate('settings:BRANCHES')}><span className="setting-type-card-heading"><SettingTypeIcon code="BRANCHES" /><strong>{ar ? 'الفروع' : 'Branches'}</strong><span className="setting-card-chevron" aria-hidden="true"><Icon name={ar ? 'chevron-left' : 'chevron-right'} size={17} /></span></span><span className="setting-type-description">{ar ? 'إدارة فروع نقاط البيع.' : 'Manage POS branches.'}</span></button><span className="setting-type-count company-profile-card-footer">{ar ? 'توجيه العمليات' : 'Operational routing'}</span></article></div></>}
    <article className="setting-type-card company-profile-card"><button type="button" className="setting-type-card-open" onClick={() => onNavigate('settings:ROLES')}><span className="setting-type-card-heading"><SettingTypeIcon code="ROLES" /><strong>{ar ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}</strong><span className="setting-card-chevron" aria-hidden="true"><Icon name={ar ? 'chevron-left' : 'chevron-right'} size={17} /></span></span><span className="setting-type-description">{ar ? 'إدارة الأدوار والصلاحيات.' : 'Manage roles and permissions.'}</span></button><span className="setting-type-count company-profile-card-footer">{ar ? 'الوصول والأمان' : 'Access and security'}</span></article>
    <SettingsHomeGrid types={types} showInactive={showInactiveTypes} tab={settingsTab} ar={ar} onNavigate={onNavigate} onEdit={openEditType} onSetActive={setTypeActive} />
    {typeDialogs}
  </div>

  if (!type) return <div className="settings-page" dir={ar ? 'rtl' : 'ltr'}><ErrorState title={ar ? 'نوع الإعدادات غير موجود' : 'Setting type not found'} detail={view.typeCode} /><Button onClick={() => onNavigate('settings')}>{ar ? 'العودة إلى الإعدادات' : 'Back to Settings'}</Button></div>
  const isHierarchical = type.isHierarchical
  const activeDescendants = descendants.length > 0
  return <div className="settings-page" dir={ar ? 'rtl' : 'ltr'}>
    <nav className="settings-breadcrumbs" aria-label={ar ? 'مسار التنقل' : 'Breadcrumb'}>{crumbs.map((crumb, index) => <span className="breadcrumb-item" key={`${crumb.section}-${index}`}>{index > 0 && <span className="breadcrumb-chevron" aria-hidden="true">{ar ? '‹' : '›'}</span>}{index === crumbs.length - 1 ? <strong aria-current="page">{crumb.label}</strong> : <button type="button" onClick={() => onNavigate(crumb.section)}>{crumb.label}</button>}</span>)}</nav>
    <PageHeader title={ancestors.length ? (ar ? current?.valueAr ?? valueLabel : current?.valueEn ?? valueLabel) : (ar ? type.nameAr : type.nameEn)} description={isHierarchical ? (ar ? 'تصفّح القيم حسب المستوى.' : 'Browse values one level at a time.') : (ar ? 'إدارة القيم المرجعية.' : 'Manage reference values.')} actions={<Button variant="primary" onClick={() => openAdd(isHierarchical ? current?.settingId ?? null : null)}><Icon name="plus" size={18} />{isHierarchical ? (current ? (ar ? `إضافة ضمن ${current.valueAr}` : `Add under ${current.valueEn}`) : (ar ? `إضافة ${singular}` : `Add ${singular}`)) : (ar ? `إضافة ${singular}` : `Add ${singular}`)}</Button>} />
    {isHierarchical && <div className="settings-list-toolbar"><SearchInput aria-label={ar ? 'بحث في الإعدادات' : 'Search settings'} placeholder={ar ? 'ابحث بالرمز أو الاسم' : 'Search code or name'} value={search} onChange={event => setSearch(event.target.value)} /><SwitchInput label={ar ? 'عرض غير النشط' : 'Show inactive'} checked={showInactive} onChange={event => setShowInactive(event.target.checked)} /></div>}
    {error ? <ErrorState title={ar ? 'تعذر تحميل الإعدادات' : 'Could not load settings'} detail={error} /> : dataLoading ? <LoadingState /> : !pathValid ? <ErrorState title={ar ? 'المسار غير صالح' : 'Invalid setting path'} detail={ar ? 'تعذر العثور على أحد المستويات.' : 'One of the requested levels could not be found.'} /> : !isHierarchical ? <DataTable columns={columns} rows={flatRows} rowKey={item => item.settingId} density="comfortable" dir={ar ? 'rtl' : 'ltr'} searchPlaceholder={ar ? 'ابحث بالرمز أو الاسم' : 'Search code or name'} searchLabel={ar ? 'بحث في الإعدادات' : 'Search settings'} toolbarEnd={<SwitchInput label={ar ? 'عرض غير النشط' : 'Show inactive'} checked={showInactive} onChange={event => setShowInactive(event.target.checked)} />} labels={ar ? { rows: 'قيم', actions: 'الإجراءات', selectVisibleRows: 'تحديد القيم الظاهرة', selectRow: id => `تحديد ${id}`, previous: 'السابق', next: 'التالي', showing: 'عرض', of: 'من' } : undefined} rowActions={item => <RowActions item={item} labels={actionLabels} onEdit={openEdit} onDeactivate={requestDeactivate} onReactivate={value => void updateStatus(value, true)} />} emptyTitle={ar ? 'لا توجد قيم' : 'No settings yet'} emptyDetail={ar ? 'أضف قيمة أو غيّر البحث.' : 'Add a value or change the search.'} />
      : filteredChildren.length ? <div className="setting-value-grid">{filteredChildren.map(item => <SettingValueCard key={item.settingId} item={item} childCount={items.filter(child => child.parentSettingId === item.settingId).length} ar={ar} onOpen={() => onNavigate(`settings:${type.code}:${[...view.path, item.settingId].join('/')}`)} onEdit={() => openEdit(item)} onDeactivate={() => void requestDeactivate(item)} onReactivate={() => void updateStatus(item, true)} />)}</div>
      : <div className="settings-drilldown-empty"><EmptyState title={search ? (ar ? 'لا توجد نتائج' : 'No results') : current ? (ar ? 'لا توجد عناصر هنا بعد' : 'Nothing here yet') : (ar ? 'لا توجد قيم جذر' : 'No root settings')} detail={search ? (ar ? 'جرّب عبارة بحث أخرى.' : 'Try another search.') : isHierarchical ? (ar ? 'أضف أول قيمة في هذا المستوى.' : 'Add the first value at this level.') : undefined} />{isHierarchical && !search && <Button variant="primary" onClick={() => openAdd(current?.settingId ?? null)}>{ar ? `إضافة ${singular}` : `Add ${singular}`}</Button>}</div>}
    <Modal open={modal} title={editing ? (ar ? `تعديل ${singular}` : `Edit ${singular}`) : (ar ? `إضافة ${singular}` : `Add ${singular}`)} closeLabel={ar ? 'إغلاق' : 'Close'} onClose={() => !saving && setModal(false)} busy={saving} footer={<><Button disabled={saving} onClick={() => setModal(false)}>{ar ? 'إلغاء' : 'Cancel'}</Button><Button variant="primary" loading={saving} onClick={() => void save()}>{ar ? 'حفظ' : 'Save'}</Button></>}>
      <div className="settings-form">
        {isHierarchical && editing && <FormField label={ar ? 'المستوى الأعلى' : 'Parent'}><Select value={draft.parentSettingId} disabled={saving} onChange={event => setDraft({ ...draft, parentSettingId: event.target.value })}><option value="">{ar ? 'بدون مستوى أعلى (جذر)' : 'No parent (root)'}</option>{items.filter(item => item.settingId !== editing.settingId && !isDescendant(item.settingId, editing.settingId, items)).map(item => <option key={item.settingId} value={item.settingId}>{ar ? item.valueAr : item.valueEn}</option>)}</Select></FormField>}
        {isHierarchical && !editing && <div className="setting-parent-summary"><span>{ar ? 'المستوى الأعلى' : 'Parent'}</span><strong>{current ? (ar ? current.valueAr : current.valueEn) : (ar ? 'جذر' : 'Root')}</strong></div>}
        <FormField label={ar ? 'الاسم بالعربية' : 'Arabic name'} required error={formError && !draft.valueAr.trim() ? formError : undefined}><TextInput autoFocus dir="rtl" maxLength={200} value={draft.valueAr} disabled={saving} onChange={event => setDraft({ ...draft, valueAr: event.target.value })} /></FormField>
        <FormField label={ar ? 'الاسم بالإنجليزية' : 'English name'} required error={formError && !draft.valueEn.trim() ? formError : undefined}><TextInput dir="ltr" maxLength={200} value={draft.valueEn} disabled={saving} onChange={event => setDraft({ ...draft, valueEn: event.target.value })} /></FormField>
        <CheckInput label={ar ? 'نشط' : 'Active'} checked={draft.isActive} disabled={saving} onChange={event => setDraft({ ...draft, isActive: event.target.checked })} />
        {formError && draft.valueAr.trim() && draft.valueEn.trim() && <ErrorState title={ar ? 'تعذر الحفظ' : 'Could not save'} detail={formError} />}
      </div>
    </Modal>
    <ConfirmDialog open={Boolean(confirmTarget)} title={ar ? 'تعطيل القيمة؟' : 'Deactivate setting?'} message={activeDescendants ? (ar ? 'عطّل القيم الفرعية النشطة أولاً. لن يتم تعطيل المستويات الفرعية تلقائياً.' : 'Deactivate active descendants first. Descendants will not be deactivated automatically.') : (ar ? `لن تظهر «${confirmTarget?.valueAr ?? ''}» في الاختيارات النشطة.` : `“${confirmTarget?.valueEn ?? ''}” will no longer appear in active selections.`)} confirmLabel={ar ? 'تعطيل' : 'Deactivate'} cancelLabel={ar ? 'إلغاء' : 'Cancel'} closeLabel={ar ? 'إغلاق' : 'Close'} danger busy={savingStatus} confirmDisabled={activeDescendants} onCancel={() => setConfirmTarget(null)} onConfirm={() => confirmTarget && void updateStatus(confirmTarget, false)} />
    {confirmError && <div className="toast toast-error" role="alert"><span>{confirmError}</span><Button variant="quiet" aria-label={ar ? 'إغلاق' : 'Dismiss'} onClick={() => setConfirmError('')}><Icon name="close" size={16} /></Button></div>}
  </div>
}

function SettingsHomeGrid({ types, showInactive, tab, ar, onNavigate, onEdit, onSetActive }: { types: SettingType[]; showInactive: boolean; tab: SettingsTab; ar: boolean; onNavigate: (section: string) => void; onEdit: (item: SettingType) => void; onSetActive: (item: SettingType, active: boolean) => void }) {
  const visible = types.filter(item => (showInactive || item.isActive) && settingsTabForCode(item.code) === tab)
  const typeCard = (item: SettingType) => <article className={`setting-type-card${item.isActive ? '' : ' setting-type-inactive'}`} key={item.code}><button type="button" className="setting-type-card-open" onClick={() => onNavigate(`settings:${item.code}`)}><span className="setting-type-card-heading"><SettingTypeIcon code={item.code} /><strong>{ar ? item.nameAr : item.nameEn}</strong><span className="setting-card-chevron" aria-hidden="true">{ar ? '‹' : '›'}</span></span><span className="setting-type-description">{typeDescriptions[item.code] ? (ar ? typeDescriptions[item.code].ar : typeDescriptions[item.code].en) : ''}</span></button>{!item.isActive && <StatusBadge tone="danger" className="setting-type-admin-status">{ar ? 'غير نشط' : 'Inactive'}</StatusBadge>}<div className={`setting-type-card-footer${ar ? ' is-arabic' : ''}`}><span className="setting-type-count"><bdi dir="ltr">{formatCount(item.activeSettingCount ?? 0, ar)}</bdi><span>{countLabel(item.code, item.activeSettingCount ?? 0, ar)}</span></span><details className="setting-card-menu"><summary aria-label={ar ? 'إجراءات نوع الإعدادات' : 'Setting Type actions'}>•••</summary><div><button type="button" onClick={() => onEdit(item)}>{ar ? 'تعديل' : 'Edit'}</button>{item.isActive ? <button type="button" onClick={() => onSetActive(item, false)}>{ar ? 'تعطيل' : 'Deactivate'}</button> : <button type="button" onClick={() => void onSetActive(item, true)}>{ar ? 'إعادة التفعيل' : 'Reactivate'}</button>}</div></details></div></article>
  const specialCard = (code: string, title: string, titleAr: string, description: string, descriptionAr: string, target: string, footer: string, footerAr: string) => <article className="setting-type-card company-profile-card" key={code}><button type="button" className="setting-type-card-open" onClick={() => onNavigate(target)}><span className="setting-type-card-heading"><SettingTypeIcon code={code} /><strong>{ar ? titleAr : title}</strong><span className="setting-card-chevron" aria-hidden="true"><Icon name={ar ? 'chevron-left' : 'chevron-right'} size={17} /></span></span><span className="setting-type-description">{ar ? descriptionAr : description}</span></button><span className="setting-type-count company-profile-card-footer">{ar ? footerAr : footer}</span></article>
  return <div className="setting-type-grid settings-home-tabs-grid">{visible.map(typeCard)}{tab === 'basic' && <>{specialCard('COMPANY_PROFILE', 'Company Profile', 'ملف الشركة', 'Company details used in reports.', 'بيانات الشركة المستخدمة في التقارير.', 'settings:COMPANY_PROFILE', 'Reports and invoices', 'للتقارير والفواتير')}{specialCard('BRANCHES', 'Branches', 'الفروع', 'Manage POS branches.', 'إدارة فروع نقاط البيع.', 'settings:BRANCHES', 'Operational routing', 'توجيه العمليات')}{specialCard('APPROVALS', 'Approval policies', 'سياسات الموافقات', 'Control review requirements for operational requests.', 'تحديد العمليات التي تحتاج موافقة المسؤول.', 'settings:APPROVALS', 'Workflow control', 'ضبط سير العمل')}</>}{tab === 'finance' && <>{specialCard('CURRENCIES', 'Currencies', 'العملات', 'Manage currencies and the primary currency.', 'إدارة العملات والعملة الأساسية.', 'settings:CURRENCIES', 'Financial setup', 'بيانات مالية')}{specialCard('TREASURIES', 'Treasures', 'الخزائن', 'Manage treasures and their currencies.', 'إدارة الخزائن وعملات الخزن.', 'settings:TREASURIES', 'Accounts', 'الحسابات')}{specialCard('BANKS', 'Banks', 'البنوك', 'Manage banks for bank treasures.', 'إدارة البنوك للخزائن البنكية.', 'settings:BANKS', 'Accounts', 'الحسابات')}</>}{tab === 'users' && <>{specialCard('USERS', 'Users', 'المستخدمون', 'Manage POS user accounts.', 'إدارة حسابات مستخدمي نقاط البيع.', 'users', 'Access', 'الوصول')}{specialCard('ROLES', 'Roles & Permissions', 'الأدوار والصلاحيات', 'Manage roles and permissions.', 'إدارة الأدوار والصلاحيات.', 'settings:ROLES', 'Security', 'الأمان')}</>}</div>
}
function settingsTabLabel(tab: SettingsTab, ar: boolean) { return ar ? ({ basic: 'الإعدادات الأساسية', items: 'الأصناف', partners: 'الشركاء', users: 'المستخدمون', finance: 'المالية' }[tab]) : ({ basic: 'Basic Settings', items: 'Items', partners: 'Partners', users: 'Users', finance: 'Finance' }[tab]) }
function settingsTabForCode(code: string): SettingsTab { if (code === 'UNIT' || code === 'ITEM_CATEGORY' || code === 'GENERIC') return 'items'; if (code === 'LOCATION' || code === 'COMPANY_PROFILE' || code === 'BRANCHES') return 'basic'; if (code === 'CURRENCIES' || code === 'TREASURIES' || code === 'BANKS') return 'finance'; if (code === 'USERS' || code === 'ROLES') return 'users'; return 'partners' }
function SettingTypeIcon({ code }: { code: string }) {
  const name = code === 'UNIT' ? 'items' : code === 'ITEM_CATEGORY' ? 'dashboard' : code === 'GENERIC' ? 'items' : code === 'LOCATION' ? 'globe' : code === 'PARTNER_TYPE' ? 'customers' : code === 'CURRENCIES' ? 'currency' : code === 'BRANCHES' ? 'city' : 'settings'
  return <span className="setting-type-icon"><Icon name={name} size={21} /></span>
}
function SettingValueCard({ item, childCount, ar, onOpen, onEdit, onDeactivate, onReactivate }: { item: Setting; childCount: number; ar: boolean; onOpen: () => void; onEdit: () => void; onDeactivate: () => void; onReactivate: () => void }) {
  return <Card className={`setting-value-card${!item.isActive ? ' is-inactive' : ''}`}>
    <button type="button" className="setting-value-open" onClick={onOpen}><strong>{ar ? item.valueAr : item.valueEn}</strong><span className="setting-card-chevron" aria-hidden="true">{ar ? '‹' : '›'}</span><small className={ar ? 'is-arabic-count' : ''}><bdi dir="ltr">{formatCount(childCount, ar)}</bdi><span>{ar ? 'عناصر' : childCount === 1 ? 'item' : 'items'}</span></small></button>
    {!item.isActive && <StatusBadge>{ar ? 'غير نشط' : 'Inactive'}</StatusBadge>}
    <div className="setting-card-actions"><ActionIcon kind="edit" label={ar ? 'تعديل' : 'Edit'} onClick={onEdit} />{item.isActive ? <ActionIcon kind="deactivate" label={ar ? 'تعطيل' : 'Deactivate'} onClick={onDeactivate} /> : <ActionIcon kind="reactivate" label={ar ? 'إعادة التفعيل' : 'Reactivate'} onClick={onReactivate} />}</div>
  </Card>
}
function RowActions({ item, labels, onEdit, onDeactivate, onReactivate }: { item: Setting; labels: { edit: string; deactivate: string; reactivate: string }; onEdit: (item: Setting) => void; onDeactivate: (item: Setting) => void; onReactivate: (item: Setting) => void }) {
  return <div className="settings-row-actions"><ActionIcon kind="edit" label={labels.edit} onClick={() => onEdit(item)} />{item.isActive ? <ActionIcon kind="deactivate" label={labels.deactivate} onClick={() => onDeactivate(item)} /> : <ActionIcon kind="reactivate" label={labels.reactivate} onClick={() => onReactivate(item)} />}</div>
}
function ActionIcon({ kind, label, onClick }: { kind: 'edit' | 'deactivate' | 'reactivate'; label: string; onClick: () => void }) {
  return <IconButton className={`settings-action-icon settings-action-${kind}`} label={label} title={label} onClick={onClick}><Icon name={kind === 'edit' ? 'edit' : kind === 'deactivate' ? 'disable' : 'enable'} size={18} /></IconButton>
}
function countLabel(code: string, count: number, ar: boolean) {
  if (ar) return code === 'UNIT' ? 'وحدة' : code === 'ITEM_CATEGORY' ? 'تصنيف' : code === 'GENERIC' ? 'اسم علمي' : code === 'LOCATION' ? 'موقع' : code === 'PARTNER_TYPE' ? 'نوع شريك' : 'قيمة'
  return code === 'UNIT' ? count === 1 ? 'unit' : 'units' : code === 'ITEM_CATEGORY' ? count === 1 ? 'category' : 'categories' : code === 'GENERIC' ? count === 1 ? 'generic' : 'generics' : code === 'LOCATION' ? count === 1 ? 'location' : 'locations' : code === 'PARTNER_TYPE' ? count === 1 ? 'partner type' : 'partner types' : count === 1 ? 'value' : 'values'
}
function formatCount(count: number, ar: boolean) {
  return new Intl.NumberFormat(ar ? 'ar' : 'en').format(count)
}
function isDescendant(candidate: number, ancestor: number, all: Setting[]) {
  let current = all.find(item => item.settingId === candidate)
  while (current?.parentSettingId) { if (current.parentSettingId === ancestor) return true; current = all.find(item => item.settingId === current!.parentSettingId) }
  return false
}
function message(reason: unknown) { return reason instanceof Error ? reason.message : 'Request failed' }
async function responseError(response: Response) {
  try { const data = await response.json(); return data.detail || data.error || `Request failed (${response.status})` } catch { return `Request failed (${response.status})` }
}







