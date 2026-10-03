import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, DateInput, EmptyState, ErrorState, FormField, LoadingState, Modal, SearchInput, TableFooter, TextInput } from '../../components/shared'
import { usePagination } from '../../components/usePagination'
import { Icon } from '../../components/icons'
import { PageHeader, type Locale } from '../../layouts/AppLayout'

type Receipt = { moveNo: number; receiptNo: string; type: 'RECEIPT' | 'PAYMENT'; receiptDate: string; partnerId: number; partnerName: string | null; treasuryId: number; treasuryName: string | null; currencyId: number; currencyCode: string; currencySymbol: string; amount: number; partnerAmount: number; partnerCurrencyCode: string; partnerCurrencySymbol: string; exchangeRate: number; reason: string | null; description: string | null }
type Partner = { partnerId: number; partnerCode: string; partnerName: string; status: string }
type Treasury = { treasuryId: number; treasuryCode: string; nameAr: string; nameEn: string; treasureType: string; currencyId: number; currencySymbol: string; currencyCode: string; isActive: boolean }
type Currency = { currencyId: number; currencyCode: string; currencyNameEn: string; currencyNameAr: string; symbol: string; isPrimary: boolean; exchangeRate: number | null; isActive: boolean; flagBase64: string | null }
type PartnerBalance = { amount: number; debit: number; credit: number; currencyId: number; currencyCode: string; currencySymbol: string }
type CompanyProfile = { companyName: string; companyAddress: string; companyPhone1: string; companyPhone2: string; companyMobileNo: string; companyFax: string; companyEmail: string; companyWebsite: string; logoBase64: string | null; logoContentType: string | null }

const today = () => new Date().toISOString().slice(0, 10)
const formatAmount = (value: number | string) => (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const escapeHtml = (value: string | null | undefined) => (value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
const smallNumberWordsEn = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const tensNumberWordsEn = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const smallNumberWordsAr = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر']
const tensNumberWordsAr = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
function numberWords(value: number, ar: boolean): string {
  const small = ar ? smallNumberWordsAr : smallNumberWordsEn
  const tens = ar ? tensNumberWordsAr : tensNumberWordsEn
  if (value < 20) return small[value]
  if (value < 100) return value % 10 ? (ar ? `${small[value % 10]} و${tens[Math.floor(value / 10)]}` : `${tens[Math.floor(value / 10)]}-${small[value % 10]}`) : tens[Math.floor(value / 10)]
  if (value < 1000) return `${ar ? (value < 200 ? 'مائة' : `${small[Math.floor(value / 100)]} مائة`) : `${small[Math.floor(value / 100)]} hundred`}${value % 100 ? ` ${ar ? 'و' : 'and'} ${numberWords(value % 100, ar)}` : ''}`
  const scale = value >= 1000000 ? (ar ? 'مليون' : 'million') : (ar ? 'ألف' : 'thousand')
  const divisor = value >= 1000000 ? 1000000 : 1000
  return `${numberWords(Math.floor(value / divisor), ar)} ${scale}${value % divisor ? ` ${ar ? 'و' : 'and'} ${numberWords(value % divisor, ar)}` : ''}`
}
function amountWords(value: number, ar: boolean) {
  const absolute = Math.abs(value)
  const integer = Math.floor(absolute)
  const fraction = Math.round((absolute - integer) * 100)
  const result = numberWords(integer, ar)
  return fraction ? `${result}${ar ? ' فاصلة ' : ' point '}${numberWords(fraction, ar)}` : result
}

function SearchableSelect({ value, onChange, placeholder, options }: { value: string; onChange: (value: string) => void; placeholder: string; options: { value: string; label: string; icon?: ReactNode; suffix?: ReactNode }[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find(option => option.value === value)
  const filtered = options.filter(option => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 100)
  return <div className="searchable-select">
    <button type="button" className="text-input searchable-select-trigger" onClick={() => { setOpen(current => !current); setQuery('') }} aria-expanded={open}><span className="searchable-select-value">{selected?.icon}<span>{selected?.label ?? placeholder}</span>{selected?.suffix}</span><span className="searchable-select-chevron">⌄</span></button>
    {open && <div className="searchable-select-menu"><input autoFocus className="text-input searchable-select-search" placeholder="Search…" value={query} onChange={event => setQuery(event.target.value)} /><div className="searchable-select-options">{filtered.length === 0 ? <div className="searchable-select-empty">No matches</div> : filtered.map(option => <button type="button" key={option.value} className={option.value === value ? 'is-selected' : ''} onClick={() => { onChange(option.value); setOpen(false); setQuery('') }}>{option.icon}<span>{option.label}</span>{option.suffix}</button>)}</div></div>}
  </div>
}

function FormattedNumberInput({ value, onChange, onBlur, className = '', disabled = false }: { value: string; onChange: (value: string) => void; onBlur?: () => void; className?: string; disabled?: boolean }) {
  const [focused, setFocused] = useState(false)
  const displayValue = value === '' ? '' : focused ? value : formatAmount(value)
  return <input type="text" inputMode="decimal" disabled={disabled} className={`text-input numeric-input ${className}`} value={displayValue} onFocus={() => setFocused(true)} onChange={event => onChange(event.target.value.replace(/,/g, ''))} onBlur={() => { setFocused(false); onBlur?.() }} />
}

export function ReceiptsPage({ locale, variant = 'receipts' }: { locale: Locale; variant?: 'receipts' | 'expenses' }) {
  const ar = locale === 'ar'
  const expensesView = variant === 'expenses'
  const [rows, setRows] = useState<Receipt[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [treasuries, setTreasuries] = useState<Treasury[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [partnerBalance, setPartnerBalance] = useState<PartnerBalance | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RECEIPT' | 'PAYMENT'>(expensesView ? 'PAYMENT' : 'ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastEditedAmount, setLastEditedAmount] = useState<'treasury' | 'partner'>('treasury')
  const [draft, setDraft] = useState({ type: 'RECEIPT' as 'RECEIPT' | 'PAYMENT', partnerId: '', treasuryId: '', partnerCurrencyId: '', amount: '', partnerAmount: '', exchangeRate: '1', reason: '', description: '', receiptDate: today() })

  async function load() {
    setLoading(true); setError('')
    try {
      const [receiptResponse, partnerResponse, treasuryResponse, currencyResponse] = await Promise.all([
        fetch(`/api/receipts${typeFilter === 'ALL' ? '' : `?type=${typeFilter}`}`),
        fetch('/api/partners/options'),
        fetch('/api/treasuries'),
        fetch('/api/currencies'),
      ])
      if (!receiptResponse.ok || !partnerResponse.ok || !treasuryResponse.ok || !currencyResponse.ok) throw new Error(ar ? 'تعذر تحميل بيانات الإيصالات.' : 'Could not load receipt data.')
      setRows(await receiptResponse.json()); setPartners(await partnerResponse.json()); setTreasuries(await treasuryResponse.json()); setCurrencies(await currencyResponse.json())
    } catch (e) { setError(e instanceof Error ? e.message : (ar ? 'تعذر تنفيذ العملية.' : 'Request failed.')) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [typeFilter, expensesView])
  useEffect(() => {
    if (!draft.partnerId || !draft.partnerCurrencyId) { setPartnerBalance(null); return }
    const controller = new AbortController()
    void fetch(`/api/transactions/partner/${draft.partnerId}/balance?currencyId=${draft.partnerCurrencyId}`, { signal: controller.signal }).then(response => response.ok ? response.json() : null).then(value => setPartnerBalance(value)).catch(() => undefined)
    return () => controller.abort()
  }, [draft.partnerId, draft.partnerCurrencyId])

  function currencyRate(currencyId: number) { const currency = currencies.find(item => item.currencyId === currencyId); return currency?.isPrimary ? 1 : currency?.exchangeRate ?? null }
  function pairRate(treasuryCurrencyId: number | undefined, partnerCurrencyId: number | undefined) { const treasuryRate = treasuryCurrencyId ? currencyRate(treasuryCurrencyId) : null; const partnerRate = partnerCurrencyId ? currencyRate(partnerCurrencyId) : null; return treasuryRate && partnerRate ? partnerRate / treasuryRate : null }
  function recalculate(next: typeof draft, source: 'treasury' | 'partner') {
    const treasury = treasuries.find(item => item.treasuryId.toString() === next.treasuryId)
    const partnerCurrencyId = Number(next.partnerCurrencyId)
    const rate = pairRate(treasury?.currencyId, partnerCurrencyId)
    if (!rate) return { ...next, exchangeRate: '' }
    if (source === 'treasury') { const amount = Number(next.amount) || 0; return { ...next, partnerAmount: amount ? String(Number((amount / rate).toFixed(4))) : '', exchangeRate: String(Number(rate.toFixed(8))) } }
    const partnerAmount = Number(next.partnerAmount) || 0; return { ...next, amount: partnerAmount ? String(Number((partnerAmount * rate).toFixed(4))) : '', exchangeRate: String(Number(rate.toFixed(8))) }
  }
  function recalculateAtRate(next: typeof draft, rateValue: string, source: 'treasury' | 'partner') {
    const treasury = treasuries.find(item => item.treasuryId.toString() === next.treasuryId)
    if (treasury && treasury.currencyId.toString() === next.partnerCurrencyId) {
      if (source === 'treasury') { const amount = Number(next.amount) || 0; return { ...next, exchangeRate: '1', partnerAmount: amount ? String(Number(amount.toFixed(4))) : '' } }
      const partnerAmount = Number(next.partnerAmount) || 0
      return { ...next, exchangeRate: '1', amount: partnerAmount ? String(Number(partnerAmount.toFixed(4))) : '' }
    }
    const rate = Number(rateValue)
    if (!rate || rate <= 0) return { ...next, exchangeRate: rateValue }
    if (source === 'treasury') { const amount = Number(next.amount) || 0; return { ...next, exchangeRate: rateValue, partnerAmount: amount ? String(Number((amount / rate).toFixed(4))) : '' } }
    const partnerAmount = Number(next.partnerAmount) || 0
    return { ...next, exchangeRate: rateValue, amount: partnerAmount ? String(Number((partnerAmount * rate).toFixed(4))) : '' }
  }
  function open(type: 'RECEIPT' | 'PAYMENT' = 'RECEIPT') { const treasury = treasuries.find(item => item.isActive); setDraft({ type, partnerId: '', treasuryId: treasury?.treasuryId.toString() ?? '', partnerCurrencyId: treasury?.currencyId.toString() ?? '', amount: '', partnerAmount: '', exchangeRate: '1', reason: '', description: '', receiptDate: today() }); setLastEditedAmount('treasury'); setError(''); setModal(true) }
  async function save() {
    if (!draft.partnerId || !draft.treasuryId || !draft.partnerCurrencyId || Number(draft.amount) <= 0 || Number(draft.partnerAmount) <= 0 || Number(draft.exchangeRate) <= 0) { setError(ar ? 'اختر الشريك والخزينة والعملة وأدخل مبالغ صحيحة.' : 'Choose the partner, treasury and currency and enter valid amounts.'); return }
    if (Math.abs(Number(draft.partnerAmount) * Number(draft.exchangeRate) - Number(draft.amount)) > 0.01) { setError(ar ? 'المبلغ المستلم يجب أن يساوي مبلغ الشريك مضروباً في سعر الصرف.' : 'The treasury amount must equal the partner amount multiplied by the exchange rate.'); return }
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: draft.type, partnerId: Number(draft.partnerId), treasuryId: Number(draft.treasuryId), partnerCurrencyId: Number(draft.partnerCurrencyId), amount: Number(draft.amount), partnerAmount: Number(draft.partnerAmount), exchangeRate: Number(draft.exchangeRate), reason: draft.reason.trim() || null, description: draft.description.trim() || null, receiptDate: draft.receiptDate }) })
      if (!response.ok) throw new Error(await response.text())
      setModal(false); await load()
    } catch (e) { setError(e instanceof Error ? e.message : (ar ? 'تعذر حفظ الإيصال.' : 'Could not save receipt.')) } finally { setSaving(false) }
  }

  const selectedTreasury = treasuries.find(item => item.treasuryId.toString() === draft.treasuryId)
  const selectedCurrency = currencies.find(item => item.currencyId.toString() === draft.partnerCurrencyId)
  const sameCurrency = Boolean(selectedTreasury && selectedCurrency && selectedTreasury.currencyId === selectedCurrency.currencyId)
  const localAmount = (Number(draft.partnerAmount) || 0) * (Number(draft.exchangeRate) || 0)
  async function printReceipt(receipt: Receipt) {
    const printWindow = window.open('', '_blank', 'width=900,height=900')
    if (!printWindow) return
    try {
      const profileResponse = await fetch('/api/company-profile')
      const profile = profileResponse.ok ? await profileResponse.json() as CompanyProfile : null
      const isReceipt = receipt.type === 'RECEIPT'
      const treasury = treasuries.find(item => item.treasuryId === receipt.treasuryId)
      const isBank = treasury?.treasureType?.toUpperCase().includes('BANK') ?? false
      const methodLabel = isBank ? (ar ? 'بنكي' : 'Bank') : (ar ? 'نقدي' : 'Cash')
      const title = isReceipt ? (ar ? `إيصال استلام ${methodLabel}` : `${methodLabel} receipt`) : (ar ? `إيصال دفع ${methodLabel}` : `${methodLabel} payment`)
      const amountLabel = isReceipt ? (ar ? 'المبلغ المستلم' : 'Amount received') : (ar ? 'المبلغ المدفوع' : 'Amount paid')
      const partyLabel = isReceipt ? (ar ? 'استلمنا من السيد /' : 'Received from /') : (ar ? 'دفعنا للسيد /' : 'Paid to /')
      const currency = currencies.find(item => item.currencyId === receipt.currencyId)
      const currencyName = ar ? (currency?.currencyNameAr || receipt.currencyCode) : (currency?.currencyNameEn || receipt.currencyCode)
      const qrCode = '<img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(receipt.receiptNo) + '" alt="QR" />'
      const contactLine = (icon: string, value: string | null | undefined) => value ? '<div><span class="contact-icon">' + icon + '</span>' + escapeHtml(value) + '</div>' : ''
      const contact = contactLine('📍', profile?.companyAddress) + contactLine('☎', profile?.companyPhone1 || profile?.companyMobileNo) + contactLine('📠', profile?.companyPhone2 || profile?.companyFax) + contactLine('🌐', profile?.companyWebsite)
      const logo = profile?.logoBase64 && profile.logoContentType ? '<img class="logo" src="data:' + escapeHtml(profile.logoContentType) + ';base64,' + profile.logoBase64 + '" alt="" />' : ''
      const row = (label: string, value: string) => '<div class="row"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>'
      const copy = '<section class="copy"><header class="receipt-header"><div class="brand">' + logo + '<div><h1>' + escapeHtml(profile?.companyName || (ar ? 'الشركة' : 'Company')) + '</h1></div></div><div class="contact">' + contact + '</div></header><div class="rule"></div><div class="receipt-title"><h2>' + escapeHtml(title) + '</h2></div><div class="meta-area"><div class="receipt-meta ' + (ar ? 'meta-rtl' : 'meta-ltr') + '">' + row(ar ? 'رقم الإيصال' : 'Receipt no.', receipt.receiptNo) + row(ar ? 'التاريخ' : 'Date', receipt.receiptDate.slice(0, 10)) + '</div>' + qrCode + '</div><div class="line-item"><span>' + escapeHtml(partyLabel) + '</span><strong>' + escapeHtml(receipt.partnerName || '—') + '</strong></div><div class="line-item"><span>' + escapeHtml(amountLabel + ' /') + '</span><strong>' + escapeHtml(formatAmount(receipt.amount)) + ' ' + escapeHtml(receipt.currencySymbol) + '</strong></div><div class="line-item"><span>' + escapeHtml(ar ? 'وذلك قيمة /' : 'Amount in words /') + '</span><strong>' + escapeHtml(amountWords(receipt.amount, ar)) + ' ' + escapeHtml(currencyName) + '</strong></div><div class="line-item"><span>' + escapeHtml(ar ? 'نوع العملية /' : 'Payment method /') + '</span><strong>' + escapeHtml(methodLabel) + '</strong></div><div class="line-item details-line"><span>' + escapeHtml(ar ? 'التفاصيل /' : 'Details /') + '</span><strong>' + escapeHtml(receipt.description || receipt.reason || '—') + '</strong></div><div class="signature-row"><div></div><div><div class="signature-line"></div><strong>' + escapeHtml(ar ? 'توقيع المستلم' : 'Receiver signature') + '</strong></div></div></section>'
      printWindow.document.write('<!doctype html><html lang="' + (ar ? 'ar' : 'en') + '" dir="' + (ar ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><title>' + escapeHtml(title) + ' ' + escapeHtml(receipt.receiptNo) + '</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#102548;background:#fff;font:15px Arial,sans-serif}.preview-actions{display:flex;justify-content:center;gap:10px;padding:14px;background:#17212b}.preview-actions button{padding:9px 20px;border:0;border-radius:5px;cursor:pointer}.copy{padding:5px 2mm 12px;min-height:128mm}.receipt-header{display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:16px}.logo{width:92px;height:78px;object-fit:contain}.brand h1{margin:0;font-size:34px;color:#12284a}.contact{text-align:right;font-size:15px;line-height:1.65}.contact-icon{display:inline-block;width:22px;margin-inline-end:6px;font-weight:700}.rule{border-top:2px solid #12284a;margin-top:8px}.receipt-title{text-align:center;margin:16px 0 12px}.receipt-title h2{display:inline-block;margin:0;padding:9px 38px;border-radius:10px;color:#fff;background:#102b55;font-size:26px}.meta-area{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.receipt-meta{width:38%}.meta-ltr{margin-left:0;margin-right:auto}.meta-rtl{margin-left:auto;margin-right:0}.receipt-meta .row{display:flex;justify-content:flex-start;gap:10px;padding:4px 0;border-bottom:0}.receipt-meta .row span{min-width:100px}.receipt-meta .row strong{font-weight:700}.qr-code{width:96px;height:96px;object-fit:contain}.line-item{display:grid;grid-template-columns:22% 1fr;align-items:end;gap:8px;padding:14px 0 7px;border-bottom:1px dotted #7c8999;min-height:38px}.line-item span{font-weight:700;font-size:17px}.line-item strong{text-align:start;font-size:20px}.details-line{min-height:74px}.signature-row{display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:54px;text-align:center;direction:ltr}.signature-line{border-top:2px solid #12284a;margin-bottom:10px}.signature-row strong{font-size:16px}.footer{margin-top:18px;padding-top:8px;border-top:1px solid #c2cad3;text-align:center;font-size:11px;color:#52606d}.cut{border-top:2px dashed #8a98a8;margin:3mm 0}.preview-actions+main{padding:0 7mm}@media print{.preview-actions{display:none}.copy{min-height:128mm}.cut{margin:1mm 0}}</style></head><body><div class="preview-actions"><button onclick="window.print()">' + (ar ? 'طباعة' : 'Print') + '</button><button onclick="window.close()">' + (ar ? 'إغلاق' : 'Close') + '</button></div><main>' + copy + '<div class="cut"></div>' + copy + '</main></body></html>')
      printWindow.document.close()
    } catch {
      printWindow.document.body.innerHTML = '<p style="font:16px Arial;padding:24px">' + (ar ? 'تعذر تجهيز الإيصال للطباعة.' : 'Could not prepare the receipt for printing.') + '</p>'
    }
  }
  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase()
    return rows.filter(item => !q || [item.receiptNo, item.partnerName ?? '', item.treasuryName ?? '', item.currencySymbol, item.description ?? ''].some(value => value.toLocaleLowerCase().includes(q)))
  }, [rows, search])

  const visiblePage = usePagination(visible)
  return <div className="receipts-page" dir={ar ? 'rtl' : 'ltr'}>
    <PageHeader eyebrow={ar ? 'المعاملات المالية' : 'FINANCE'} title={expensesView ? (ar ? 'المنصرفات' : 'Expenses') : (ar ? 'إيصالات الاستلام والدفع' : 'Receipts & payments')} description={expensesView ? (ar ? 'تسجيل ومراجعة المبالغ المصروفة من الخزائن.' : 'Record and review amounts paid from treasuries.') : (ar ? 'تسجيل ومراجعة الحركات المالية المرتبطة بالشركاء والخزائن.' : 'Record and review partner and treasury movements.')} actions={<div className="receipt-header-actions">{!expensesView && <Button variant="secondary" onClick={() => open('PAYMENT')}>＋ {ar ? 'إيصال دفع' : 'Payment receipt'}</Button>}{!expensesView && <Button variant="primary" onClick={() => open('RECEIPT')}>＋ {ar ? 'إيصال استلام' : 'Receipt'}</Button>}{expensesView && <Button variant="primary" onClick={() => open('PAYMENT')}>＋ {ar ? 'إضافة منصرف' : 'Add expense'}</Button>}</div>} />
    <section className="receipts-toolbar"><SearchInput aria-label={expensesView ? (ar ? 'بحث في المنصرفات' : 'Search expenses') : (ar ? 'بحث في الإيصالات' : 'Search receipts')} placeholder={expensesView ? (ar ? 'ابحث برقم المنصرف أو المستفيد' : 'Search expense or partner') : (ar ? 'ابحث برقم الإيصال أو الشريك' : 'Search receipt or partner')} value={search} onChange={e => setSearch(e.target.value)} />{!expensesView && <div className="receipt-filters" role="tablist" aria-label={ar ? 'نوع الإيصال' : 'Receipt type'}><button className={typeFilter === 'ALL' ? 'is-active' : ''} onClick={() => setTypeFilter('ALL')} role="tab" aria-selected={typeFilter === 'ALL'}>{ar ? 'الكل' : 'All'}</button><button className={typeFilter === 'RECEIPT' ? 'is-active' : ''} onClick={() => setTypeFilter('RECEIPT')} role="tab" aria-selected={typeFilter === 'RECEIPT'}>{ar ? 'استلام' : 'Receipts'}</button><button className={typeFilter === 'PAYMENT' ? 'is-active' : ''} onClick={() => setTypeFilter('PAYMENT')} role="tab" aria-selected={typeFilter === 'PAYMENT'}>{ar ? 'دفع' : 'Payments'}</button></div>}</section>
    {error && !modal && <ErrorState title={ar ? 'تعذر تنفيذ العملية' : 'Request failed'} detail={error} />}
    {loading ? <LoadingState label={expensesView ? (ar ? 'جارٍ تحميل المنصرفات…' : 'Loading expenses…') : (ar ? 'جارٍ تحميل الإيصالات…' : 'Loading receipts…')} /> : visible.length === 0 ? <EmptyState title={expensesView ? (ar ? 'لا توجد منصرفات' : 'No expenses yet') : (ar ? 'لا توجد إيصالات' : 'No receipts yet')} detail={expensesView ? (ar ? 'أضف أول منصرف للبدء.' : 'Add an expense to begin.') : (ar ? 'أضف إيصال استلام أو دفع للبدء.' : 'Add a receipt or payment to begin.')} /> : <div className="receipts-table-wrap"><table className="receipts-table"><thead><tr><th>{expensesView ? (ar ? 'رقم المنصرف' : 'Expense no.') : (ar ? 'رقم الإيصال' : 'Receipt no.')}</th><th>{ar ? 'النوع' : 'Type'}</th><th>{ar ? 'التاريخ' : 'Date'}</th><th>{ar ? 'المستفيد' : 'Partner'}</th><th>{ar ? 'الخزينة' : 'Treasury'}</th><th>{ar ? 'المبلغ' : 'Amount'}</th><th>{ar ? 'مبلغ الشريك' : 'Partner amount'}</th><th>{ar ? 'سعر الصرف' : 'Rate'}</th><th>{ar ? 'البيان' : 'Description'}</th><th>{ar ? 'طباعة' : 'Print'}</th></tr></thead><tbody>{visiblePage.rows.map(item => <tr key={item.moveNo}><td><code>{item.receiptNo}</code></td><td><span className={`receipt-type-badge ${item.type === 'RECEIPT' ? 'receipt-type-in' : 'receipt-type-out'}`}>{item.type === 'RECEIPT' ? (ar ? 'استلام' : 'Receipt') : (expensesView ? (ar ? 'منصرف' : 'Expense') : (ar ? 'دفع' : 'Payment'))}</span></td><td>{item.receiptDate.slice(0, 10)}</td><td>{item.partnerName ?? '—'}</td><td>{item.treasuryName ?? '—'}</td><td className="numeric-cell">{formatAmount(item.amount)} <small>{item.currencySymbol}</small></td><td className="numeric-cell">{formatAmount(item.partnerAmount)} <small>{item.partnerCurrencySymbol}</small></td><td className="numeric-cell">1 {item.partnerCurrencySymbol} = {formatAmount(item.exchangeRate)} {item.currencySymbol}</td><td>{item.description ?? item.reason ?? '—'}</td><td><Button variant="icon" aria-label={ar ? 'طباعة' : 'Print'} title={ar ? 'طباعة' : 'Print'} onClick={() => void printReceipt(item)}>⎙</Button></td></tr>)}</tbody></table><TableFooter total={visible.length} locale={locale} pager={visiblePage.pager} /></div>}
    <Modal open={modal} title={draft.type === 'RECEIPT' ? (ar ? 'إيصال استلام' : 'Receipt') : (ar ? 'إيصال دفع' : 'Payment receipt')} titleIcon="currency" description={ar ? 'أدخل بيانات الحركة المالية.' : 'Enter the financial movement details.'} closeLabel={ar ? 'إغلاق' : 'Close'} busy={saving} onClose={() => !saving && setModal(false)} footer={<><Button variant="ghost" disabled={saving} onClick={() => setModal(false)}>{ar ? 'إلغاء' : 'Cancel'}</Button><Button variant="primary" loading={saving} onClick={() => void save()}>{ar ? 'حفظ الإيصال' : 'Save receipt'}</Button></>}>
      <div className="receipt-form"><div className="receipt-form-grid"><FormField label={ar ? 'التاريخ' : 'Date'} required><DateInput value={draft.receiptDate} onChange={e => setDraft({ ...draft, receiptDate: e.target.value })} /></FormField><FormField label={ar ? 'المستفيد' : 'Partner'} required><SearchableSelect value={draft.partnerId} onChange={value => setDraft({ ...draft, partnerId: value })} placeholder={ar ? 'اختر الشريك' : 'Choose partner'} options={partners.map(item => ({ value: item.partnerId.toString(), label: item.partnerName, suffix: partnerBalance && item.partnerId.toString() === draft.partnerId ? <span className={`partner-balance ${partnerBalance.amount >= 0 ? 'is-debit' : 'is-credit'}`}>{formatAmount(Math.abs(partnerBalance.amount))} {partnerBalance.currencySymbol}</span> : null }))} /></FormField><FormField label={ar ? 'الخزينة' : 'Treasury'} required><SearchableSelect value={draft.treasuryId} onChange={value => { const treasury = treasuries.find(item => item.treasuryId.toString() === value); setDraft(recalculate({ ...draft, treasuryId: value, partnerCurrencyId: treasury?.currencyId.toString() ?? draft.partnerCurrencyId }, lastEditedAmount)) }} placeholder={ar ? 'اختر الخزينة' : 'Choose treasury'} options={treasuries.filter(item => item.isActive).map(item => ({ value: item.treasuryId.toString(), label: `${ar ? item.nameAr : item.nameEn} · ${item.currencySymbol}` }))} /></FormField><FormField label={ar ? 'عملة حساب الشريك' : 'Partner account currency'} required><SearchableSelect value={draft.partnerCurrencyId} onChange={value => setDraft(recalculate({ ...draft, partnerCurrencyId: value }, lastEditedAmount))} placeholder={ar ? 'اختر العملة' : 'Choose currency'} options={currencies.filter(item => item.isActive).map(item => ({ value: item.currencyId.toString(), label: `${item.symbol} · ${ar ? item.currencyNameAr : item.currencyNameEn}`, icon: item.flagBase64 ? <img className="searchable-select-flag" src={item.flagBase64} alt="" /> : null }))} /></FormField><FormField label={draft.type === 'RECEIPT' ? (ar ? 'المبلغ المستلم فعلياً' : 'Amount received') : (ar ? 'المبلغ المدفوع فعلياً' : 'Amount paid')} hint={selectedTreasury ? `${ar ? 'عملة الخزينة' : 'Treasury currency'}: ${selectedTreasury.currencySymbol}` : undefined} required><div className="money-input"><FormattedNumberInput className="receipt-number-input" value={draft.amount} onChange={value => { setLastEditedAmount('treasury'); setDraft(recalculate({ ...draft, amount: value }, 'treasury')) }} /><span>{selectedTreasury?.currencySymbol ?? ''}</span></div></FormField><FormField label={draft.type === 'RECEIPT' ? (ar ? 'المبلغ المدفوع من الشريك' : 'Amount paid by partner') : (ar ? 'المبلغ المستلم للشريك' : 'Amount received by partner')} hint={selectedCurrency ? `${ar ? 'عملة الحساب' : 'Account currency'}: ${selectedCurrency.symbol}` : undefined} required><div className="money-input"><FormattedNumberInput className="receipt-number-input" value={draft.partnerAmount} onChange={value => { setLastEditedAmount('partner'); setDraft(recalculate({ ...draft, partnerAmount: value }, 'partner')) }} /><span>{selectedCurrency?.symbol ?? ''}</span></div></FormField><FormField label={ar ? 'سعر الصرف' : 'Exchange rate'} hint={selectedCurrency && selectedTreasury ? `1 ${selectedCurrency.symbol} = X ${selectedTreasury.currencySymbol}` : undefined} required><div className="money-input"><FormattedNumberInput className="receipt-number-input" value={draft.exchangeRate} disabled={sameCurrency} onChange={value => setDraft(recalculateAtRate(draft, value, lastEditedAmount))} /><span>{selectedCurrency?.symbol && selectedTreasury?.currencySymbol ? `${selectedTreasury.currencySymbol}/${selectedCurrency.symbol}` : selectedTreasury?.currencySymbol ?? ''}</span></div></FormField><FormField label={ar ? 'المعادِل بعملة الخزينة' : 'Treasury equivalent'} hint={ar ? 'مبلغ الشريك × سعر الصرف' : 'Partner amount × exchange rate'}><div className="receipt-local-amount">{formatAmount(localAmount)} {selectedTreasury?.currencySymbol ?? ''}</div></FormField><FormField label={ar ? 'السبب' : 'Reason'}><TextInput value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })} placeholder={ar ? 'مثال: تحصيل أو إرجاع مصروفات' : 'e.g. Collection or expense refund'} /></FormField><FormField label={ar ? 'البيان' : 'Description'}><textarea className="text-input receipt-description" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={2} /></FormField></div>{error && <div className="receipt-form-error" role="alert">{error}</div>}<p className="receipt-account-note"><Icon name="info" size={16} />{ar ? 'سيتم تسجيل عملة الخزينة وعملة حساب الشريك وسعر الصرف معاً.' : 'The treasury currency, partner currency and exchange rate will be recorded together.'}</p></div>
    </Modal>
  </div>
}

