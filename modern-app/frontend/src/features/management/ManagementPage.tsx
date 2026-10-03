import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { DataTable, type TableColumn } from '../../components/DataTable'
import { Button, EmptyState, ErrorState, FormField, FormSection, IconButton, LoadingState, Modal, Select, StatusBadge, StatusToggle, TextInput } from '../../components/shared'
import { Icon } from '../../components/icons'
import { PageHeader, type Locale } from '../../layouts/AppLayout'

type CustomerRow = {
  publicId: string
  customerCode: string
  businessName: string
  partnerTypeCode: string
  contactPerson: string | null
  phone: string | null
  country: string | null
  status: string
  createdAt: string
}
type LocationCountry = { countryId: number; nameAr: string; nameEn: string; isActive: boolean }
type LocationCity = { cityId: number; countryId: number; nameAr: string; nameEn: string; isActive: boolean }
type PartnerTypeSetting = { settingId: number; code: string | null; valueAr: string; valueEn: string; isActive: boolean }
type CustomerDetails = CustomerRow & {
  mobile: string | null
  email: string | null
  address: string | null
  city: string | null
  taxNumber: string | null
  notes: string | null
  businessTypes: Array<{ code: string; name: string; description: string | null }>
}

type CustomerForm = {
  businessName: string
  partnerTypeCode: string
  contactPerson: string
  phone: string
  mobile: string
  email: string
  address: string
  city: string
  country: string
}

const initialForm: CustomerForm = {
  businessName: '', partnerTypeCode: 'CLIENT', contactPerson: '', phone: '', mobile: '',
  email: '', address: '', city: '', country: '',
}

const words = {
  en: {
    customers: 'Partners', eyebrow: 'MANAGEMENT', description: 'Manage Elite POS partner registrations.', add: 'Add partner',
    code: 'Partner code', business: 'Business name', partnerType: 'Partner type', client: 'Client', supplier: 'Supplier', both: 'Client & supplier', type: 'Primary business type', contact: 'Contact', phone: 'Phone',
    country: 'Country', status: 'Status', created: 'Created', open: 'Open', search: 'Search partners',
    addTitle: 'Add partner', addDescription: 'Register a business partner in Elite POS Management.', required: 'Required',
    contactPerson: 'Contact person', mobile: 'Mobile', email: 'Email', address: 'Address', city: 'City',
    choosePartnerType: 'Choose a partner type', save: 'Create partner', cancel: 'Cancel', loading: 'Loading partners…',
    loadError: 'Could not load partner information', retry: 'Try again', edit: 'Edit', activate: 'Activate', deactivate: 'Deactivate', inactive: 'Inactive',
    saved: 'Partner created.', validation: 'Enter a business name and choose a partner type.',
    detail: 'Partner details', publicId: 'Public identifier', businessTypes: 'Business types',
    licenses: 'Licenses', deployments: 'Deployments', installations: 'Installations', notImplemented: 'Not implemented yet',
    active: 'Active', noCustomers: 'No partners yet', noCustomersDetail: 'Add a partner to begin the Management registry.',
    back: 'Back to partners', licenseNote: 'License history will appear here when license management is implemented.',
    deploymentNote: 'Deployment configuration will appear here when deployment management is implemented.',
    installationNote: 'Registered workstations will appear here when installation management is implemented.',
  },
  ar: {
    customers: 'الشركاء', eyebrow: 'الإدارة', description: 'إدارة تسجيل شركاء Elite POS.', add: 'إضافة شريك',
    code: 'رمز الشريك', business: 'اسم النشاط التجاري', partnerType: 'نوع الشريك', client: 'عميل', supplier: 'مورد', both: 'عميل ومورد', type: 'نوع النشاط الأساسي', contact: 'جهة الاتصال', phone: 'الهاتف',
    country: 'الدولة', status: 'الحالة', created: 'تاريخ الإنشاء', open: 'فتح', search: 'البحث عن الشركاء',
    addTitle: 'إضافة شريك', addDescription: 'تسجيل شريك تجاري في إدارة Elite POS.', required: 'مطلوب',
    contactPerson: 'اسم جهة الاتصال', mobile: 'الهاتف المحمول', email: 'البريد الإلكتروني', address: 'العنوان', city: 'المدينة',
    choosePartnerType: 'اختر نوع الشريك', save: 'إنشاء الشريك', cancel: 'إلغاء', loading: 'جارٍ تحميل الشركاء…',
    loadError: 'تعذر تحميل معلومات الشريك', retry: 'إعادة المحاولة', edit: 'تعديل', activate: 'تفعيل', deactivate: 'تعطيل', inactive: 'غير نشط',
    saved: 'تم إنشاء الشريك.', validation: 'أدخل اسم الشريك واختر نوعه.',
    detail: 'تفاصيل الشريك', publicId: 'المعرّف العام', businessTypes: 'أنواع الأنشطة',
    licenses: 'التراخيص', deployments: 'عمليات النشر', installations: 'التثبيتات', notImplemented: 'غير متاح بعد',
    active: 'نشط', noCustomers: 'لا يوجد شركاء بعد', noCustomersDetail: 'أضف شريكاً لبدء سجل الإدارة.',
    back: 'العودة إلى الشركاء', licenseNote: 'سيظهر سجل التراخيص عند تنفيذ إدارة التراخيص.',
    deploymentNote: 'سيظهر إعداد النشر عند تنفيذ إدارة النشر.',
    installationNote: 'ستظهر محطات العمل المسجلة عند تنفيذ إدارة التثبيتات.',
  },
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { errors?: Record<string, string[]>; message?: string } | null
    const message = body?.errors ? Object.values(body.errors).flat().join(' ') : body?.message
    throw new Error(message || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}
type PartnerAccount = { amount: number; debit: number; credit: number; currencyId: number; currencyCode: string; currencySymbol: string; currencyNameEn: string; currencyNameAr: string; flagBase64: string | null }

const englishNumberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const englishTensWords = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const arabicNumberWords = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر']
const arabicTensWords = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']

function numberWordsUnderThousand(value: number, locale: Locale): string {
  if (value < 20) return locale === 'ar' ? arabicNumberWords[value] : englishNumberWords[value]
  if (value < 100) {
    const tens = Math.floor(value / 10)
    const ones = value % 10
    if (!ones) return locale === 'ar' ? arabicTensWords[tens] : englishTensWords[tens]
    return locale === 'ar' ? `${arabicNumberWords[ones]} و${arabicTensWords[tens]}` : `${englishNumberWords[ones]}-${englishTensWords[tens]}`
  }
  const hundreds = Math.floor(value / 100)
  const remainder = value % 100
  const hundred = locale === 'ar' ? (hundreds === 1 ? 'مائة' : `${arabicNumberWords[hundreds]} مائة`) : `${englishNumberWords[hundreds]} hundred`
  return remainder ? `${hundred} ${locale === 'ar' ? 'و' : 'and'} ${numberWordsUnderThousand(remainder, locale)}` : hundred
}

function amountInWords(value: number, locale: Locale) {
  const absolute = Math.abs(value)
  const integer = Math.floor(absolute)
  const fraction = Math.round((absolute - integer) * 100)
  const scales = locale === 'ar' ? ['', 'ألف', 'مليون', 'مليار'] : ['', 'thousand', 'million', 'billion']
  if (integer === 0 && fraction === 0) return locale === 'ar' ? 'صفر' : 'zero'
  let remaining = integer
  let scaleIndex = 0
  const parts: string[] = []
  while (remaining > 0) {
    const group = remaining % 1000
    if (group) {
      const groupWords = numberWordsUnderThousand(group, locale)
      parts.unshift(scales[scaleIndex] ? `${groupWords} ${scales[scaleIndex]}` : groupWords)
    }
    remaining = Math.floor(remaining / 1000)
    scaleIndex += 1
  }
  const separator = locale === 'ar' ? ' و' : ' '
  const result = parts.join(separator)
  if (!fraction) return result
  return `${result}${locale === 'ar' ? ' فاصلة ' : ' point '}${numberWordsUnderThousand(fraction, locale)}`
}

function usePartnerTypes() {
  const [types, setTypes] = useState<PartnerTypeSetting[]>([])
  useEffect(() => { requestJson<PartnerTypeSetting[]>('/api/settings/types/PARTNER_TYPE/items?active=true').then(setTypes).catch(() => setTypes([])) }, [])
  return types
}

function partnerTypeLabel(code: string, t: typeof words.en) {
  if (code === 'SUPPLIER') return t.supplier
  if (code === 'BOTH') return t.both
  if (code === 'CLIENT') return t.client
  return code
}

function usePartnerLocations(countryName: string) {
  const [countries, setCountries] = useState<LocationCountry[]>([])
  const [loadedCities, setLoadedCities] = useState<{ countryId: number; cities: LocationCity[] } | null>(null)
  const countryId = countries.find(item => item.nameEn === countryName || item.nameAr === countryName)?.countryId
  useEffect(() => { requestJson<LocationCountry[]>('/api/locations/countries').then(setCountries).catch(() => setCountries([])) }, [])
  useEffect(() => {
    if (countryId === undefined) return
    requestJson<LocationCity[]>(`/api/locations/countries/${countryId}/cities`).then(cities => cities, () => []).then(cities => setLoadedCities({ countryId, cities }))
  }, [countryId])
  // Cities belong to the selected country only; another country's list is never shown while the new one loads.
  const cities = countryId !== undefined && loadedCities?.countryId === countryId ? loadedCities.cities : []
  return { countries, cities }
}

export function ManagementPage({ locale, view, customerPublicId, onNavigate }: {
  locale: Locale
  view: 'customers' | 'new-customer' | 'customer-details'
  customerPublicId?: string
  onNavigate: (destination: string) => void
}) {
  if (view === 'new-customer') return <><CustomersList locale={locale} onNavigate={onNavigate} /><AddCustomer locale={locale} onNavigate={onNavigate} /></>
  if (view === 'customer-details') return <><CustomersList locale={locale} onNavigate={onNavigate} /><CustomerDetailsPage locale={locale} publicId={customerPublicId ?? ''} onNavigate={onNavigate} /></>
  return <CustomersList locale={locale} onNavigate={onNavigate} />
}

async function loadCustomers() {
  return requestJson<CustomerRow[]>('/api/partners')
}

function CustomersList({ locale, onNavigate }: { locale: Locale; onNavigate: (destination: string) => void }) {
  const t = words[locale]
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editCustomer, setEditCustomer] = useState<CustomerDetails | null>(null)

  useEffect(() => {
    let active = true
    loadCustomers()
      .then(result => { if (active) { setRows(result); setError('') } })
      .catch(() => { if (active) setError(words[locale].loadError) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [locale])

  function retry() {
    setLoading(true)
    setError('')
    loadCustomers()
      .then(setRows)
      .catch(() => setError(words[locale].loadError))
      .finally(() => setLoading(false))
  }

  const columns = useMemo<TableColumn<CustomerRow>[]>(() => [
    { key: 'customerCode', title: t.code, value: row => row.customerCode },
    { key: 'businessName', title: t.business, value: row => row.businessName, width: '28%' },
    { key: 'partnerTypeCode', title: t.partnerType, value: row => row.partnerTypeCode, render: row => partnerTypeLabel(row.partnerTypeCode, t) },
    { key: 'phone', title: t.phone, value: row => row.phone ?? '' },
    { key: 'country', title: t.country, value: row => row.country ?? '' },
    { key: 'status', title: t.status, value: row => row.status, render: row => <StatusBadge tone={row.status === 'ACTIVE' ? 'success' : 'danger'}>{row.status === 'ACTIVE' ? t.active : t.inactive}</StatusBadge> },
    { key: 'createdAt', title: t.created, value: row => row.createdAt, render: row => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', { dateStyle: 'medium' }).format(new Date(row.createdAt)) },
  ], [locale, t])

  async function openEdit(row: CustomerRow) {
    try { setEditCustomer(await requestJson<CustomerDetails>(`/api/partners/${encodeURIComponent(row.publicId)}`)) } catch { setError(t.loadError) }
  }

  return <>
  <div className="management-page">
    <PageHeader eyebrow={t.eyebrow} title={t.customers} description={t.description} actions={<Button variant="primary" onClick={() => onNavigate('new-customer')}>＋ {t.add}</Button>} />
    {error ? <div className="management-state"><ErrorState title={error} detail="" /><Button onClick={retry}>{t.retry}</Button></div>
      : loading ? <LoadingState label={t.loading} />
        : rows.length === 0 ? <EmptyState title={t.noCustomers} detail={t.noCustomersDetail} />
          : <DataTable columns={columns} rows={rows} rowKey={row => row.publicId} searchLabel={t.search} searchPlaceholder={t.search} onRowActivate={row => onNavigate(`customer:${row.publicId}`)} rowActions={row => <div className="settings-row-actions"><IconButton label={t.open} onClick={() => onNavigate(`customer:${row.publicId}`)}><Icon name="view" size={18} /></IconButton><IconButton label={t.edit} onClick={() => void openEdit(row)}><Icon name="edit" size={18} /></IconButton><IconButton label={row.status === 'ACTIVE' ? t.deactivate : t.activate} onClick={() => void updatePartnerStatus(row)}><Icon name={row.status === 'ACTIVE' ? 'disable' : 'enable'} size={18} /></IconButton></div>} dir={locale === 'ar' ? 'rtl' : 'ltr'} emptyTitle={t.noCustomers} emptyDetail={t.noCustomersDetail} />}
  </div>
  {editCustomer && <EditPartner locale={locale} customer={editCustomer} onCancel={() => setEditCustomer(null)} onSaved={result => { setRows(current => current.map(row => row.publicId === result.publicId ? { ...row, businessName: result.businessName, partnerTypeCode: result.partnerTypeCode, phone: result.phone, status: result.status } : row)); setEditCustomer(null) }} />}
  </>

  async function updatePartnerStatus(row: CustomerRow) {
    const nextStatus = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      const details = await requestJson<CustomerDetails>(`/api/partners/${encodeURIComponent(row.publicId)}`)
      await requestJson(`/api/partners/by-public/${encodeURIComponent(row.publicId)}`, { method: 'PUT', body: JSON.stringify({ partnerName: details.businessName, partnerTypeCode: details.partnerTypeCode, phone: details.phone, email: details.email, address: details.address, city: details.city, country: details.country, status: nextStatus }) })
      setRows(current => current.map(item => item.publicId === row.publicId ? { ...item, status: nextStatus } : item))
    } catch { setError(t.loadError) }
  }
}

function AddCustomer({ locale, onNavigate }: { locale: Locale; onNavigate: (destination: string) => void }) {
  const t = words[locale]
  const [form, setForm] = useState(initialForm)
  const partnerTypes = usePartnerTypes()
  const { countries, cities } = usePartnerLocations(form.country)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [active, setActive] = useState(true)
  const setValue = (key: keyof CustomerForm, value: string) => setForm(current => ({ ...current, [key]: value }))
  const requiredError = submitted && !form.businessName.trim() ? t.required : ''
  const partnerTypeError = submitted && !form.partnerTypeCode ? t.required : ''
  // Once partner types load, swap the CLIENT placeholder for the stored code of the Client type.
  const [typesApplied, setTypesApplied] = useState<PartnerTypeSetting[] | null>(null)
  if (typesApplied !== partnerTypes) {
    setTypesApplied(partnerTypes)
    const defaultType = partnerTypes.find(item => item.valueEn === 'Client' || item.valueAr === 'عميل')
    if (defaultType?.code) setForm(current => current.partnerTypeCode === 'CLIENT' ? { ...current, partnerTypeCode: defaultType.code! } : current)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitted(true); setError('')
    if (!form.businessName.trim() || !form.partnerTypeCode) { setError(t.validation); return }
    setSaving(true)
    try {
      const customer = await requestJson<CustomerDetails>('/api/partners', { method: 'POST', body: JSON.stringify({ partnerName: form.businessName, partnerTypeCode: form.partnerTypeCode, phone: form.phone, email: form.email, address: form.address, city: form.city, country: form.country, status: active ? 'ACTIVE' : 'INACTIVE' }) })
      onNavigate(`customer:${customer.publicId}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : t.loadError) } finally { setSaving(false) }
  }
  return <Modal open title={t.addTitle} description={t.addDescription} closeLabel={t.cancel} onClose={() => onNavigate('customers')} busy={saving} footer={null}>
    <form className="management-form partner-modal-wide" onSubmit={submit} noValidate><FormSection title={locale === 'ar' ? 'معلومات الشريك' : 'Partner information'}><div className="partner-status-top"><StatusToggle checked={active} activeLabel={t.active} inactiveLabel={t.inactive} onChange={event => setActive(event.target.checked)} /></div>
      <div className="form-grid-fields">
        <FormField label={t.business} required error={requiredError}><TextInput autoFocus maxLength={200} value={form.businessName} onChange={event => setValue('businessName', event.target.value)} aria-invalid={Boolean(requiredError)} /></FormField>
        <FormField label={t.partnerType} required error={partnerTypeError}><Select value={form.partnerTypeCode} onChange={event => setValue('partnerTypeCode', event.target.value)} aria-invalid={Boolean(partnerTypeError)}><option value="">{t.choosePartnerType}</option>{partnerTypes.map(item => <option key={item.settingId} value={item.code ?? ''}>{locale === 'ar' ? item.valueAr : item.valueEn}</option>)}</Select></FormField>
        <FormField label={t.contactPerson}><TextInput maxLength={150} value={form.contactPerson} onChange={event => setValue('contactPerson', event.target.value)} /></FormField>
        <FormField label={t.phone}><TextInput maxLength={50} value={form.phone} onChange={event => setValue('phone', event.target.value)} /></FormField>
        <FormField label={t.mobile}><TextInput maxLength={50} value={form.mobile} onChange={event => setValue('mobile', event.target.value)} /></FormField>
        <FormField label={t.email}><TextInput type="email" maxLength={254} value={form.email} onChange={event => setValue('email', event.target.value)} /></FormField>
        <FormField label={t.country}><Select value={form.country} onChange={event => setForm(current => ({ ...current, country: event.target.value, city: '' }))}><option value="">{locale === 'ar' ? 'اختر الدولة' : 'Select country'}</option>{countries.filter(item => item.isActive).map(item => <option key={item.countryId} value={locale === 'ar' ? item.nameAr : item.nameEn}>{locale === 'ar' ? item.nameAr : item.nameEn}</option>)}</Select></FormField>
        <FormField label={t.city}><Select value={form.city} disabled={!form.country} onChange={event => setValue('city', event.target.value)}><option value="">{locale === 'ar' ? 'اختر المدينة' : 'Select city'}</option>{cities.filter(item => item.isActive).map(item => <option key={item.cityId} value={locale === 'ar' ? item.nameAr : item.nameEn}>{locale === 'ar' ? item.nameAr : item.nameEn}</option>)}</Select></FormField>
        <FormField label={t.address}><TextInput maxLength={500} value={form.address} onChange={event => setValue('address', event.target.value)} /></FormField>
      </div>
    </FormSection>{error && <div className="management-form-error" role="alert">{error}</div>}<div className="management-form-actions"><Button type="button" onClick={() => onNavigate('customers')}>{t.cancel}</Button><Button variant="primary" type="submit" loading={saving}>{t.save}</Button></div></form>
  </Modal>
}
function CustomerDetailsPage({ locale, publicId, onNavigate }: { locale: Locale; publicId: string; onNavigate: (destination: string) => void }) {
  const t = words[locale]
  const [customer, setCustomer] = useState<CustomerDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [detailTab, setDetailTab] = useState<'info' | 'accounts'>('info')
  const [loadedAccounts, setLoadedAccounts] = useState<{ customer: CustomerDetails; accounts: PartnerAccount[] } | null>(null)
  useEffect(() => {
    let active = true
    requestJson<CustomerDetails>(`/api/partners/${encodeURIComponent(publicId)}`)
      .then(result => { if (active) setCustomer(result) })
      .catch(() => { if (active) setError(words[locale].loadError) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [locale, publicId])
  useEffect(() => {
    if (detailTab !== 'accounts' || !customer) return
    void fetch(`/api/transactions/partner/by-public/${customer.publicId}/balances`).then(response => response.ok ? response.json() as Promise<PartnerAccount[]> : []).catch(() => []).then(accounts => setLoadedAccounts({ customer, accounts }))
  }, [detailTab, customer])
  const accounts = loadedAccounts?.customer === customer ? loadedAccounts.accounts : []
  const accountsLoading = detailTab === 'accounts' && Boolean(customer) && loadedAccounts?.customer !== customer

  if (loading) return <LoadingState label={t.loading} />
  if (error || !customer) return <div className="management-page"><ErrorState title={error || t.loadError} /><Button onClick={() => onNavigate('customers')}>{t.back}</Button></div>
  if (editing) return <EditPartner locale={locale} customer={customer} onCancel={() => setEditing(false)} onSaved={result => { setCustomer(result); setEditing(false) }} />
  const details: Array<[string, string | null]> = [
    [t.code, customer.customerCode], [t.business, customer.businessName],
    [t.contactPerson, customer.contactPerson], [t.phone, customer.phone], [t.mobile, customer.mobile],
    [t.email, customer.email], [t.address, customer.address], [t.city, customer.city],
    [t.country, customer.country],
  ]
  return <Modal open title={customer.businessName} description={t.detail} closeLabel={t.back} onClose={() => onNavigate('customers')} footer={null}>
    <div className="partner-modal-wide">
      <div className="partner-view-actions"><span className="page-eyebrow">{customer.customerCode}</span><Button onClick={() => setEditing(true)}>{t.edit}</Button></div>
      <div className="item-editor-tabs partner-editor-tabs" role="tablist" aria-label={locale === 'ar' ? 'تبويبات الشريك' : 'Partner tabs'}>
        <button type="button" role="tab" aria-selected={detailTab === 'info'} className={detailTab === 'info' ? 'is-active' : ''} onClick={() => setDetailTab('info')}><Icon name="info" size={17} />{locale === 'ar' ? 'المعلومات' : 'Information'}</button>
        <button type="button" role="tab" aria-selected={detailTab === 'accounts'} className={detailTab === 'accounts' ? 'is-active' : ''} onClick={() => setDetailTab('accounts')}><Icon name="currency" size={17} />{locale === 'ar' ? 'الحسابات' : 'Accounts'}</button>
      </div>
      {detailTab === 'accounts' ? <section className="partner-accounts-panel">{accountsLoading ? <LoadingState label={locale === 'ar' ? 'جارٍ تحميل الحسابات…' : 'Loading accounts…'} /> : accounts.length === 0 ? <div className="partner-accounts-empty"><h3>{locale === 'ar' ? 'لا توجد حسابات' : 'No accounts yet'}</h3><p>{locale === 'ar' ? 'ستظهر حسابات الشريك بعد تسجيل حركة مالية.' : 'Partner accounts appear after a financial movement is recorded.'}</p></div> : <div className="partner-account-cards">{accounts.map(account => <article className={`partner-account-card currency-${account.currencyCode.toLowerCase()}`} key={account.currencyId}><div className="partner-account-card-heading"><div className="partner-account-currency-group"><span className="partner-account-icon">{account.currencySymbol}</span><div><div className="partner-account-currency">{account.flagBase64 && <img className="partner-account-flag" src={account.flagBase64} alt="" />}{locale === 'ar' ? account.currencyNameAr : account.currencyNameEn}</div></div></div><StatusBadge tone={account.amount < 0 ? 'success' : account.amount > 0 ? 'danger' : 'neutral'}>{account.amount < 0 ? (locale === 'ar' ? 'دائن' : 'Credit') : account.amount > 0 ? (locale === 'ar' ? 'مدين' : 'Debit') : (locale === 'ar' ? 'متوازن' : 'Balanced')}</StatusBadge></div><div className="partner-account-available">{locale === 'ar' ? 'الرصيد' : 'Balance'}</div><strong className={`partner-account-balance ${account.amount < 0 ? 'is-credit' : account.amount > 0 ? 'is-debit' : ''}`}>{Math.abs(account.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small className="partner-account-balance-words">{amountInWords(account.amount, locale)}</small></article>)}</div>}</section> : <section className="customer-details-panel">
        <div className="customer-detail-heading"><div><h2>{customer.businessName}</h2><span>{customer.partnerTypeCode === 'SUPPLIER' ? t.supplier : customer.partnerTypeCode === 'BOTH' ? t.both : t.client}</span></div><StatusBadge tone={customer.status === 'ACTIVE' ? 'success' : 'danger'}>{customer.status === 'ACTIVE' ? t.active : t.inactive}</StatusBadge></div>
        <dl className="customer-detail-grid">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}<div><dt>{t.created}</dt><dd>{new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(customer.createdAt))}</dd></div></dl>
      </section>}
    </div>
  </Modal>
}
function EditPartner({ locale, customer, onCancel, onSaved }: { locale: Locale; customer: CustomerDetails; onCancel: () => void; onSaved: (customer: CustomerDetails) => void }) {
  const ar = locale === 'ar'
  const t = words[locale]
  const [form, setForm] = useState({ partnerName: customer.businessName, partnerTypeCode: customer.partnerTypeCode, phone: customer.phone ?? '', email: customer.email ?? '', address: customer.address ?? '', city: customer.city ?? '', country: customer.country ?? '' })
  const partnerTypes = usePartnerTypes()
  const { countries, cities } = usePartnerLocations(form.country)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(customer.status === 'ACTIVE')
  const set = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }))
  // Map the customer's stored type code onto the loaded partner type settings.
  const [typesApplied, setTypesApplied] = useState<{ types: PartnerTypeSetting[]; code: string } | null>(null)
  if (typesApplied?.types !== partnerTypes || typesApplied.code !== customer.partnerTypeCode) {
    setTypesApplied({ types: partnerTypes, code: customer.partnerTypeCode })
    const selected = partnerTypes.find(item => item.valueEn === (customer.partnerTypeCode === 'CLIENT' ? 'Client' : customer.partnerTypeCode === 'SUPPLIER' ? 'Supplier' : customer.partnerTypeCode === 'BOTH' ? 'Client & supplier' : ''))
    if (selected?.code) setForm(current => ({ ...current, partnerTypeCode: selected.code! }))
  }
  async function save() {
    if (!form.partnerName.trim() || !form.partnerTypeCode) { setError(ar ? 'أدخل اسم الشريك ونوعه.' : 'Enter the partner name and type.'); return }
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/partners/by-public/${customer.publicId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, status: active ? 'ACTIVE' : 'INACTIVE' }) })
      if (!response.ok) throw new Error(await response.text())
      onSaved(await response.json() as CustomerDetails)
    } catch (reason) { setError(reason instanceof Error ? reason.message : (ar ? 'تعذر حفظ الشريك.' : 'Could not save partner.')) } finally { setSaving(false) }
  }
  return <Modal open title={ar ? 'تعديل الشريك' : 'Edit partner'} description={t.detail} closeLabel={t.cancel} onClose={onCancel} footer={null}>
    <section className="management-form partner-modal-wide partner-edit-form"><div className="partner-status-top"><StatusToggle checked={active} activeLabel={t.active} inactiveLabel={t.inactive} onChange={event => setActive(event.target.checked)} /></div><div className="form-grid-fields">
      <FormField label={ar ? 'اسم الشريك' : 'Partner name'} required><TextInput autoFocus value={form.partnerName} onChange={e => set('partnerName', e.target.value)} /></FormField>
      <FormField label={ar ? 'نوع الشريك' : 'Partner type'} required><Select value={form.partnerTypeCode} onChange={e => set('partnerTypeCode', e.target.value)}>{partnerTypes.map(item => <option key={item.settingId} value={item.code ?? ''}>{ar ? item.valueAr : item.valueEn}</option>)}</Select></FormField>
      <FormField label={t.phone}><TextInput value={form.phone} onChange={e => set('phone', e.target.value)} /></FormField>
      <FormField label={t.email}><TextInput type="email" value={form.email} onChange={e => set('email', e.target.value)} /></FormField>
      <FormField label={t.country}><Select value={form.country} onChange={e => setForm(current => ({ ...current, country: e.target.value, city: '' }))}><option value="">{ar ? 'اختر الدولة' : 'Select country'}</option>{countries.filter(item => item.isActive).map(item => <option key={item.countryId} value={ar ? item.nameAr : item.nameEn}>{ar ? item.nameAr : item.nameEn}</option>)}</Select></FormField>
      <FormField label={t.city}><Select value={form.city} disabled={!form.country} onChange={e => set('city', e.target.value)}><option value="">{ar ? 'اختر المدينة' : 'Select city'}</option>{cities.filter(item => item.isActive).map(item => <option key={item.cityId} value={ar ? item.nameAr : item.nameEn}>{ar ? item.nameAr : item.nameEn}</option>)}</Select></FormField>
      <FormField label={t.address}><TextInput value={form.address} onChange={e => set('address', e.target.value)} /></FormField>
      </div>{error && <div className="management-form-error" role="alert">{error}</div>}<div className="management-form-actions"><Button onClick={onCancel}>{t.cancel}</Button><Button variant="primary" loading={saving} onClick={() => void save()}>{ar ? 'حفظ التغييرات' : 'Save changes'}</Button></div></section>
  </Modal>
}



