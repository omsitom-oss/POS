import { useMemo, useState } from 'react'
import { DataTable, type TableColumn } from '../../components/DataTable'
import { Button, Card, ConfirmDialog, CurrencyInput, DateInput, EmptyState, ErrorState, FormField, FormSection, LoadingState, Modal, NumberInput, SearchInput, Select, StatusBadge, Tabs, TextInput } from '../../components/shared'
import { useDemoNotice } from '../../app/useDemoNotice'
import { PageHeader, Toolbar, type Locale } from '../../layouts/AppLayout'
import { formatCurrency, formatDate } from '../../app/formatters'
import { customers, products, saleLines, type Product, type SaleLine } from './sampleData'


function stockTone(status: Product['status']): 'success' | 'warning' | 'danger' {
  if (status === 'In stock') return 'success'
  if (status === 'Low stock') return 'warning'
  return 'danger'
}

const productColumns: TableColumn<Product>[] = [
  { key: 'name', title: 'Item / product', value: row => row.name, render: row => <div className="product-cell"><strong>{row.name}</strong><span>{row.id} · {row.generic}</span></div> },
  { key: 'category', title: 'Category', value: row => row.category },
  { key: 'pack', title: 'Pack', value: row => row.pack, align: 'center' },
  { key: 'expiryDate', title: 'Expiry', value: row => row.expiryDate, align: 'center', render: row => formatDate(row.expiryDate, 'en') },
  { key: 'stock', title: 'On hand', value: row => row.stock, align: 'end', render: row => <span className={row.stock <= 12 ? 'numeric-warning' : 'numeric-value'}>{row.stock}</span> },
  { key: 'price', title: 'Unit price', value: row => row.price, align: 'end', render: row => <span className="currency-value">{formatCurrency(row.price, 'en')}</span> },
  { key: 'status', title: 'Status', value: row => row.status, sortable: false, render: row => <StatusBadge tone={stockTone(row.status)}>{row.status}</StatusBadge> },
]

const saleColumns: TableColumn<SaleLine>[] = [
  { key: 'name', title: 'Item', value: row => row.name, render: row => <div className="product-cell"><strong>{row.name}</strong><span>{row.unit}</span></div> },
  { key: 'quantity', title: 'Qty', value: row => row.quantity, align: 'center', render: row => <span className="qty-stepper"><button aria-label="Decrease quantity">−</button><strong>{row.quantity}</strong><button aria-label="Increase quantity">+</button></span> },
  { key: 'price', title: 'Price', value: row => row.price, align: 'end', render: row => formatCurrency(row.price, 'en') },
  { key: 'discount', title: 'Discount', value: row => row.discount, align: 'end', render: row => row.discount ? formatCurrency(row.discount, 'en') : '—' },
  { key: 'total', title: 'Line total', value: row => row.quantity * row.price - row.discount, align: 'end', render: row => <strong>{formatCurrency(row.quantity * row.price - row.discount, 'en')}</strong> },
]

const text = {
  en: {
    eyebrow: 'FOUNDATION · COMPONENT PREVIEW', title: 'Design Lab', desc: 'A working preview of the shared Elite POS interface. All records here are fictional.',
    overview: 'Overview', tables: 'Tables', forms: 'Forms', pos: 'POS grid', dialogs: 'Dialogs & states',
    layoutTitle: 'Application shell', layoutDesc: 'Compact navigation, clear page context, and one consistent workspace.',
    tableTitle: 'Standard data table', tableDesc: 'Shared sorting, search, selection, row actions, keyboard navigation and pagination.',
    denseTitle: 'Dense product table', denseDesc: 'Compact rows keep useful stock and price details visible at a glance.',
    formTitle: 'Typical edit form', formDesc: 'Consistent labels, field spacing, validation, and clear save actions.',
    posTitle: 'POS transaction grid', posDesc: 'Fast scanning, compact line details and a persistent amount summary.',
    dialogTitle: 'Dialogs and UI states', dialogDesc: 'Shared search/select, confirmation, validation, loading, empty and error patterns.',
    selectCustomer: 'Select customer', choose: 'Choose customer', confirm: 'Confirm action', save: 'Save changes', cancel: 'Cancel',
    name: 'Product name', generic: 'Generic name', category: 'Category', pack: 'Pack size', price: 'Selling price', expiry: 'Expiry date',
    productHint: 'Use the label operators recognize on the shelf.', nameRequired: 'Enter a product name.', priceRequired: 'Price must be greater than zero.',
    demoSave: 'Save demo form', customer: 'Customer', selected: 'Customer selected', total: 'Invoice total', subtotal: 'Subtotal', discount: 'Discount',
    loading: 'Loading demo rows…', showLoading: 'Show loading state', empty: 'Nothing to display', emptyDetail: 'New results will appear here.',
    errorTitle: 'Could not load records', errorDetail: 'The sample connection is unavailable. Try again.', retry: 'Retry sample', confirmMessage: 'This only resets the unsaved demo form. Continue?',
    records: 'sample products', selectedRows: 'selected rows', openPicker: 'Find a customer', filter: 'Filter products', density: 'Compact density', normal: 'Comfortable density',
    validated: 'Validation examples', loadingStates: 'Loading, empty and error states', good: 'Ready',
  },
  ar: {
    eyebrow: 'الأساسيات · معاينة المكونات', title: 'مختبر التصميم', desc: 'معاينة عملية لواجهة نقاط البيع المشتركة. جميع البيانات المعروضة تجريبية.',
    overview: 'نظرة عامة', tables: 'الجداول', forms: 'النماذج', pos: 'نقطة البيع', dialogs: 'النوافذ والحالات',
    layoutTitle: 'هيكل التطبيق', layoutDesc: 'تنقل مدمج وسياق واضح للصفحة ومساحة عمل موحدة.',
    tableTitle: 'جدول البيانات الموحد', tableDesc: 'فرز وبحث وتحديد وإجراءات وتنقل بلوحة المفاتيح وتقسيم صفحات.',
    denseTitle: 'جدول المنتجات المكثف', denseDesc: 'صفوف مدمجة تعرض المخزون والسعر بوضوح.',
    formTitle: 'نموذج تعديل', formDesc: 'تسميات ومسافات وتحقق موحدة مع إجراءات حفظ واضحة.',
    posTitle: 'جدول معاملة البيع', posDesc: 'إدخال سريع وتفاصيل مدمجة وملخص إجمالي ثابت.',
    dialogTitle: 'النوافذ وحالات الواجهة', dialogDesc: 'أنماط موحدة للبحث والتأكيد والتحقق والتحميل والفراغ والخطأ.',
    selectCustomer: 'اختيار العميل', choose: 'اختيار العميل', confirm: 'تأكيد الإجراء', save: 'حفظ التغييرات', cancel: 'إلغاء',
    name: 'اسم المنتج', generic: 'الاسم العلمي', category: 'الفئة', pack: 'حجم العبوة', price: 'سعر البيع', expiry: 'تاريخ الانتهاء',
    productHint: 'استخدم الاسم المعروف للموظفين على الرف.', nameRequired: 'أدخل اسم المنتج.', priceRequired: 'يجب أن يكون السعر أكبر من صفر.',
    demoSave: 'حفظ النموذج التجريبي', customer: 'العميل', selected: 'تم اختيار العميل', total: 'إجمالي الفاتورة', subtotal: 'المجموع', discount: 'الخصم',
    loading: 'جارٍ تحميل البيانات التجريبية…', showLoading: 'عرض حالة التحميل', empty: 'لا توجد بيانات للعرض', emptyDetail: 'ستظهر النتائج الجديدة هنا.',
    errorTitle: 'تعذر تحميل السجلات', errorDetail: 'الاتصال التجريبي غير متاح. حاول مرة أخرى.', retry: 'إعادة المحاولة', confirmMessage: 'سيؤدي ذلك إلى إعادة تعيين النموذج التجريبي غير المحفوظ فقط. هل تريد المتابعة؟',
    records: 'منتجات تجريبية', selectedRows: 'صفوف محددة', openPicker: 'البحث عن عميل', filter: 'تصفية المنتجات', density: 'كثافة مدمجة', normal: 'كثافة مريحة',
    validated: 'أمثلة التحقق', loadingStates: 'حالات التحميل والفراغ والخطأ', good: 'جاهز',
  },
}

export function DesignLabPage({ locale, section }: { locale: Locale; section: string }) {
  const t = text[locale]
  const rtl = locale === 'ar'
  const tableLabels = {
    rows: rtl ? 'صفوف' : 'rows',
    actions: rtl ? 'الإجراءات' : 'Actions',
    selectVisibleRows: rtl ? 'تحديد الصفوف الظاهرة' : 'Select visible rows',
    selectRow: (key: string | number) => rtl ? `تحديد الصف ${key}` : `Select row ${key}`,
    previous: rtl ? 'السابق' : 'Previous',
    next: rtl ? 'التالي' : 'Next',
    showing: rtl ? 'عرض' : 'Showing',
    of: rtl ? 'من' : 'of',
  }
  const [selectedProducts, setSelectedProducts] = useState<Array<string | number>>([])
  const [selectedCustomer, setSelectedCustomer] = useState(customers[0])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact')
  const [formTab, setFormTab] = useState('general')
  const [form, setForm] = useState({ name: '', generic: '', category: 'Analgesics', pack: '', price: '', expiry: '' })
  const [submitted, setSubmitted] = useState(false)
  const { notice, showNotice } = useDemoNotice()
  const localeColumns = useMemo(() => productColumns.map(column => {
    const title = locale === 'ar' ? ({ 'Item / product': 'المنتج', Category: 'الفئة', Pack: 'العبوة', 'On hand': 'المتوفر', 'Unit price': 'سعر الوحدة', Status: 'الحالة' }[column.title] ?? column.title) : column.title
    if (column.key === 'expiryDate') return { ...column, title: locale === 'ar' ? 'الانتهاء' : title, render: (row: Product) => formatDate(row.expiryDate, locale) }
    if (column.key === 'price') return { ...column, title, render: (row: Product) => <span className="currency-value">{formatCurrency(row.price, locale)}</span> }
    if (column.key === 'status') return { ...column, title, render: (row: Product) => <StatusBadge tone={stockTone(row.status)}>{locale === 'ar' ? ({ 'In stock': 'متوفر', 'Low stock': 'مخزون منخفض', 'Out of stock': 'غير متوفر' }[row.status]) : row.status}</StatusBadge> }
    return { ...column, title }
  }), [locale])
  const localeSaleColumns = useMemo(() => saleColumns.map(column => {
    const arabicTitles: Record<string, string> = { Item: 'الصنف', Qty: 'الكمية', Price: 'السعر', Discount: 'الخصم', 'Line total': 'الإجمالي' }
    const title = rtl ? (arabicTitles[column.title] ?? column.title) : column.title
    if (column.key === 'quantity') return { ...column, title, render: (row: SaleLine) => <span className="qty-stepper"><button aria-label={rtl ? 'تقليل الكمية' : 'Decrease quantity'}>−</button><strong>{row.quantity}</strong><button aria-label={rtl ? 'زيادة الكمية' : 'Increase quantity'}>+</button></span> }
    if (column.key === 'price') return { ...column, title, render: (row: SaleLine) => formatCurrency(row.price, locale) }
    if (column.key === 'discount') return { ...column, title, render: (row: SaleLine) => row.discount ? formatCurrency(row.discount, locale) : '—' }
    if (column.key === 'total') return { ...column, title, render: (row: SaleLine) => <strong>{formatCurrency(row.quantity * row.price - row.discount, locale)}</strong> }
    return { ...column, title }
  }), [locale, rtl])
  const selectedCustomerColumns: TableColumn<typeof customers[number]>[] = [
    { key: 'name', title: rtl ? 'اسم العميل' : 'Customer', value: row => row.name, render: row => <div className="product-cell"><strong>{row.name}</strong><span>{row.id}</span></div> },
    { key: 'phone', title: rtl ? 'الهاتف' : 'Phone', value: row => row.phone },
    { key: 'balance', title: rtl ? 'الرصيد' : 'Balance', value: row => row.balance, align: 'end', render: row => formatCurrency(row.balance, locale) },
  ]

  const subtotal = saleLines.reduce((sum, row) => sum + row.quantity * row.price, 0)
  const discountTotal = saleLines.reduce((sum, row) => sum + row.discount, 0)
  const grandTotal = subtotal - discountTotal
  const nameError = submitted && !form.name.trim() ? t.nameRequired : undefined
  const priceError = submitted && (Number(form.price) <= 0 || !form.price) ? t.priceRequired : undefined

  function runLoadingDemo() {
    setLoading(true)
    window.setTimeout(() => setLoading(false), 1500)
  }

  function renderProducts(dense = false) {
    return <DataTable columns={localeColumns} rows={products} rowKey={row => row.id} searchPlaceholder={t.filter} searchLabel={t.filter} selectable selectedKeys={selectedProducts} onSelectionChange={setSelectedProducts} pageSize={dense ? 7 : 5} density={dense ? 'compact' : density} dir={rtl ? 'rtl' : 'ltr'} labels={tableLabels} rowActions={() => <Button size="small" variant="quiet" aria-label={rtl ? 'المزيد من الإجراءات' : 'More actions'} onClick={() => showNotice(t.good)}>⋯</Button>} />
  }

  return (
    <div className="design-lab" dir={rtl ? 'rtl' : 'ltr'}>
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.desc} actions={<div className="page-actions-inner"><StatusBadge tone="info">{products.length} {t.records}</StatusBadge><Button variant="primary" onClick={() => showNotice(rtl ? 'تم حفظ إعدادات العرض التجريبية' : 'Demo preferences saved')}>{rtl ? 'حفظ التفضيلات' : 'Save preferences'}</Button></div>} />

      {section === 'overview' && <>
        <div className="specimen-grid overview-grid">
          <Specimen title={t.layoutTitle} description={t.layoutDesc} className="span-2"><div className="layout-preview"><div className="preview-sidebar"><span className="preview-brand">E</span><i /><i /><i /><i /></div><div className="preview-content"><div className="preview-topline" /><div className="preview-title-line" /><div className="preview-subtitle-line" /><div className="preview-toolbar-line" /><div className="preview-table-head" /><div className="preview-table-row" /><div className="preview-table-row" /><div className="preview-table-row" /></div></div></Specimen>
          <Specimen title={rtl ? 'لغة واتجاه' : 'Language & direction'} description={rtl ? 'يدعم التخطيط العربية والإنجليزية من الجذر.' : 'Direction follows the selected language from the root.'}><div className="direction-demo"><div className="direction-option"><span>EN</span><strong>LTR</strong><span className="direction-arrow">→</span></div><div className="direction-option" dir="rtl"><span>عربي</span><strong>RTL</strong><span className="direction-arrow">←</span></div></div></Specimen>
        </div>
        <div className="specimen-grid two-col"><Specimen title={rtl ? 'الخط والأزرار والحالات' : 'Typography, buttons & status'} description={rtl ? 'النمط نفسه يعمل مع المظهر الفاتح والداكن.' : 'Shared typography and controls adapt to Light and Dark themes.'}><div className="design-system-preview"><h2>{rtl ? 'عنوان قسم' : 'Section heading'}</h2><p>{rtl ? 'نص واضح ومريح للاستخدام اليومي.' : 'Comfortable text for long daily use.'}</p><div className="toolbar-actions"><Button variant="primary">{rtl ? 'إجراء أساسي' : 'Primary action'}</Button><Button>{rtl ? 'ثانوي' : 'Secondary'}</Button><Button variant="danger">{rtl ? 'حذف' : 'Danger'}</Button></div><div className="toolbar-actions"><StatusBadge tone="success">{rtl ? 'نشط' : 'Active'}</StatusBadge><StatusBadge tone="warning">{rtl ? 'منخفض' : 'Low'}</StatusBadge><StatusBadge tone="info">{rtl ? 'معلومة' : 'Info'}</StatusBadge></div></div></Specimen><Specimen title={rtl ? 'التنقل الهرمي بالبطاقات' : 'Card-based hierarchy'} description={rtl ? 'استكشف كل مستوى مع مسار تنقل واضح.' : 'Browse one level at a time with clear breadcrumbs.'}><div className="setting-value-grid"><Card className="setting-value-card"><button className="setting-value-open" onClick={() => showNotice(rtl ? 'معاينة فقط' : 'Preview only')}><strong>{rtl ? 'إلكترونيات' : 'Electronics'}</strong><span className="setting-card-chevron">{rtl ? '‹' : '›'}</span><small>3 {rtl ? 'عناصر' : 'items'}</small></button></Card><Card className="setting-value-card"><button className="setting-value-open" onClick={() => showNotice(rtl ? 'معاينة فقط' : 'Preview only')}><strong>{rtl ? 'أغذية' : 'Food'}</strong><span className="setting-card-chevron">{rtl ? '‹' : '›'}</span><small>2 {rtl ? 'عناصر' : 'items'}</small></button></Card></div></Specimen></div>
        <Specimen title={t.tableTitle} description={t.tableDesc} actions={<span className="muted-caption">{selectedProducts.length} {t.selectedRows}</span>}>{renderProducts(false)}</Specimen>
        <div className="specimen-grid two-col"><Specimen title={t.validated} description={rtl ? 'رسائل مفهومة أسفل الحقول.' : 'Clear inline messages stay with their fields.'}><div className="mini-field-row"><FormField label={t.name} error={t.nameRequired}><TextInput value="" readOnly aria-invalid="true" /></FormField><FormField label={rtl ? 'البريد الإلكتروني' : 'Email'} hint={rtl ? 'اختياري' : 'Optional'}><TextInput value="operator@example.test" readOnly /></FormField></div></Specimen><Specimen title={t.loadingStates} description={rtl ? 'نفس أنماط الحالة في جميع الصفحات.' : 'The same state patterns can be reused on every page.'}><div className="state-samples"><StatusBadge tone="success">{t.good}</StatusBadge><EmptyState title={t.empty} /><ErrorState title={t.errorTitle} /></div></Specimen></div>
      </>}

      {section === 'tables' && <>
        <Toolbar><div className="toolbar-copy"><strong>{rtl ? 'جدول موحد' : 'One table system'}</strong><span>{rtl ? 'تغيير الكثافة هنا يطبق على كل جدول.' : 'Change density here to preview the shared row scale.'}</span></div><div className="toolbar-actions"><Button size="small" variant={density === 'compact' ? 'primary' : 'secondary'} onClick={() => setDensity('compact')}>{t.density}</Button><Button size="small" variant={density === 'comfortable' ? 'primary' : 'secondary'} onClick={() => setDensity('comfortable')}>{t.normal}</Button></div></Toolbar>
        <Specimen title={t.tableTitle} description={t.tableDesc} actions={<span className="muted-caption">{selectedProducts.length} {t.selectedRows}</span>}>{renderProducts(false)}</Specimen>
        <Specimen title={t.denseTitle} description={t.denseDesc}>{renderProducts(true)}</Specimen>
      </>}

      {section === 'forms' && <div className="specimen-grid form-grid"><Specimen title={t.formTitle} description={t.formDesc} className="span-2"><form className="edit-form" onSubmit={event => { event.preventDefault(); setSubmitted(true); if (form.name.trim() && Number(form.price) > 0) showNotice(rtl ? 'تم حفظ المنتج التجريبي' : 'Demo product saved') }} noValidate>
          <Tabs tabs={[{ id: 'general', label: rtl ? 'عام' : 'General' }, { id: 'stock', label: rtl ? 'المخزون' : 'Stock' }, { id: 'pricing', label: rtl ? 'التسعير' : 'Pricing' }]} value={formTab} onChange={setFormTab} />
          <div className="tab-panel-note">{formTab === 'general' ? (rtl ? 'الاسم والتصنيف ووحدة البيع' : 'Name, category and selling unit') : formTab === 'stock' ? (rtl ? 'معلومات العبوة والانتهاء' : 'Pack and expiry details') : (rtl ? 'سعر البيع والخصم' : 'Selling price and discount')}</div>
          <FormSection title={rtl ? 'بيانات المنتج' : 'Product details'} description={rtl ? 'حقول مشتركة بمسافات موحدة.' : 'Shared fields with a consistent rhythm.'}>
            <div className="form-grid-fields"><FormField label={t.name} required hint={t.productHint} error={nameError}><TextInput placeholder={rtl ? 'مثال: باراسيتامول ٥٠٠ ملغ' : 'e.g. Paracetamol 500 mg'} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} aria-invalid={Boolean(nameError)} /></FormField><FormField label={t.generic}><TextInput placeholder={rtl ? 'الاسم العلمي' : 'Generic name'} value={form.generic} onChange={event => setForm({ ...form, generic: event.target.value })} /></FormField><FormField label={t.category}><Select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}><option>Analgesics</option><option>Vitamins</option><option>Antibiotic</option><option>Respiratory</option></Select></FormField><FormField label={t.pack}><TextInput placeholder={rtl ? 'مثال: ٢٠ قرصاً' : 'e.g. 20 tablets'} value={form.pack} onChange={event => setForm({ ...form, pack: event.target.value })} /></FormField><FormField label={t.price} required error={priceError}><CurrencyInput placeholder="0.00" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} aria-invalid={Boolean(priceError)} /></FormField><FormField label={t.expiry}><DateInput value={form.expiry} onChange={event => setForm({ ...form, expiry: event.target.value })} /></FormField></div>
          </FormSection><div className="form-footer"><span className="muted-caption">{rtl ? 'الحقول المميزة بـ * مطلوبة' : '* Required fields'}</span><div className="toolbar-actions"><Button type="button" onClick={() => { setForm({ name: '', generic: '', category: 'Analgesics', pack: '', price: '', expiry: '' }); setSubmitted(false) }}>{t.cancel}</Button><Button type="submit" variant="primary">{t.demoSave}</Button></div></div>
        </form></Specimen><Specimen title={rtl ? 'حقول أساسية' : 'Input set'} description={rtl ? 'أنواع إدخال موحدة قابلة لإعادة الاستخدام.' : 'Consistent input types ready to reuse.'}><div className="stacked-fields"><FormField label={rtl ? 'بحث' : 'Search'}><SearchInput placeholder={rtl ? 'ابحث عن منتج' : 'Search products'} /></FormField><div className="mini-field-row"><FormField label={rtl ? 'الكمية' : 'Quantity'}><NumberInput defaultValue="2" min="0" /></FormField><FormField label={rtl ? 'التاريخ' : 'Date'}><DateInput defaultValue="2026-09-24" /></FormField></div></div></Specimen></div>}

      {section === 'pos' && <>
        <div className="pos-toolbar"><div className="customer-summary"><span className="customer-avatar">{selectedCustomer.name.slice(0, 1)}</span><div><small>{t.customer}</small><strong>{selectedCustomer.name}</strong></div><StatusBadge tone="success">{selectedCustomer.id}</StatusBadge></div><Button onClick={() => setPickerOpen(true)}>⌕ {t.openPicker}</Button><SearchInput placeholder={rtl ? 'مسح الباركود أو البحث عن منتج' : 'Scan barcode or find an item'} /></div>
        <Specimen title={t.posTitle} description={t.posDesc}><DataTable columns={localeSaleColumns} rows={saleLines} rowKey={row => row.id} pageSize={8} density="compact" dir={rtl ? 'rtl' : 'ltr'} labels={tableLabels} rowActions={() => <Button size="small" variant="quiet" aria-label={rtl ? 'حذف الصنف' : 'Remove line'}>×</Button>} /></Specimen>
        <div className="total-bar"><span className="muted-caption">{rtl ? '٣ أصناف · ٤ وحدات' : '3 items · 4 units'}</span><div className="totals"><div><span>{t.subtotal}</span><strong>{formatCurrency(subtotal, locale)}</strong></div><div><span>{t.discount}</span><strong className="discount-value">− {formatCurrency(discountTotal, locale)}</strong></div><div className="grand-total"><span>{t.total}</span><strong>{formatCurrency(grandTotal, locale)}</strong></div></div><Button variant="primary" size="medium" onClick={() => showNotice(rtl ? 'هذه معاينة فقط — لم يتم إنشاء فاتورة' : 'Preview only — no invoice was created')}>{rtl ? 'متابعة الدفع' : 'Continue to payment'}</Button></div>
      </>}

      {section === 'dialogs' && <div className="specimen-grid two-col"><Specimen title={rtl ? 'بحث واختيار' : 'Search and select'} description={rtl ? 'نافذة اختيار مشتركة مع جدول قابل للبحث.' : 'Reusable picker dialog with a searchable table.'}><div className="dialog-preview"><div className="customer-summary"><span className="customer-avatar">{selectedCustomer.name.slice(0, 1)}</span><div><small>{t.selected}</small><strong>{selectedCustomer.name}</strong></div></div><Button onClick={() => setPickerOpen(true)}>{t.openPicker}</Button></div></Specimen><Specimen title={rtl ? 'تأكيد' : 'Confirmation'} description={rtl ? 'إجراء واضح مع خيار الرجوع.' : 'A clear action with an easy way back.'}><div className="dialog-preview"><p className="muted-copy">{t.confirmMessage}</p><Button variant="danger" onClick={() => setConfirmOpen(true)}>{t.confirm}</Button></div></Specimen><Specimen title={t.loadingStates} description={rtl ? 'حالات قابلة لإعادة الاستخدام.' : 'Reusable feedback states for every feature.'}><div className="state-stack"><LoadingState label={t.loading} /><EmptyState title={t.empty} detail={t.emptyDetail} /><ErrorState title={t.errorTitle} detail={t.errorDetail} /><Button size="small" onClick={runLoadingDemo}>{t.showLoading}</Button></div></Specimen><Specimen title={rtl ? 'التحقق من الحقول' : 'Field validation'} description={rtl ? 'الخطأ بجانب الحقل المرتبط به.' : 'The error stays beside the field that needs attention.'}><div className="stacked-fields"><FormField label={t.name} required error={t.nameRequired}><TextInput aria-invalid="true" placeholder={t.name} /></FormField><FormField label={t.price} required error={t.priceRequired}><CurrencyInput aria-invalid="true" placeholder="0.00" /></FormField></div></Specimen></div>}

      <Modal open={pickerOpen} title={t.selectCustomer} closeLabel={rtl ? 'إغلاق' : 'Close'} onClose={() => setPickerOpen(false)} footer={<Button onClick={() => setPickerOpen(false)}>{t.cancel}</Button>}><DataTable columns={selectedCustomerColumns} rows={customers} rowKey={row => row.id} pageSize={6} dir={rtl ? 'rtl' : 'ltr'} labels={tableLabels} onRowActivate={row => { setSelectedCustomer(row); setPickerOpen(false); showNotice(`${t.selected}: ${row.name}`) }} /></Modal>
      <ConfirmDialog open={confirmOpen} title={t.confirm} message={t.confirmMessage} confirmLabel={rtl ? 'إعادة التعيين' : 'Reset demo'} cancelLabel={t.cancel} onCancel={() => setConfirmOpen(false)} onConfirm={() => { setForm({ name: '', generic: '', category: 'Analgesics', pack: '', price: '', expiry: '' }); setSubmitted(false); setConfirmOpen(false); showNotice(rtl ? 'تمت إعادة تعيين النموذج التجريبي' : 'Demo form reset') }} />
      {notice && <div className="toast" role="status">{notice}</div>}
      {loading && <div className="loading-overlay"><LoadingState label={t.loading} /></div>}
    </div>
  )
}

function Specimen({ title, description, actions, className = '', children }: { title: string; description?: string; actions?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return <section className={`specimen-card ${className}`}><header className="specimen-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div>{actions}</div>}</header>{children}</section>
}

