import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Button, DateInput, DetailList, DetailPanel, ErrorState, FilterChips, FormField, Modal, Money, TextInput } from '../../components/shared'
import { DataTable, type TableColumn } from '../../components/DataTable'
import { datePresetOptions, inDatePreset, sumBy, type DatePreset } from '../../components/listFilters'
import { useLoadEffect } from '../../components/useLoadEffect'
import { Icon } from '../../components/icons'
import { PageHeader, type Locale } from '../../layouts/AppLayout'
import { formatDay, formatMoney, localDate } from '../../app/formatters'

type Receipt = { moveNo: number; receiptNo: string; type: 'RECEIPT' | 'PAYMENT'; receiptDate: string; partnerId: number; partnerName: string | null; treasuryId: number; treasuryName: string | null; currencyId: number; currencyCode: string; currencySymbol: string; amount: number; partnerAmount: number; partnerCurrencyCode: string; partnerCurrencySymbol: string; exchangeRate: number; reason: string | null; description: string | null }
type Partner = { partnerId: number; partnerCode: string; partnerName: string; status: string }
type Treasury = { treasuryId: number; treasuryCode: string; nameAr: string; nameEn: string; treasureType: string; currencyId: number; currencySymbol: string; currencyCode: string; isActive: boolean }
type Currency = { currencyId: number; currencyCode: string; currencyNameEn: string; currencyNameAr: string; symbol: string; isPrimary: boolean; exchangeRate: number | null; isActive: boolean; flagBase64: string | null }
type PartnerBalance = { amount: number; debit: number; credit: number; currencyId: number; currencyCode: string; currencySymbol: string }
type CompanyProfile = { companyName: string; companyAddress: string; companyPhone1: string; companyPhone2: string; companyMobileNo: string; companyFax: string; companyEmail: string; companyWebsite: string; logoBase64: string | null; logoContentType: string | null }

const today = () => localDate()
const formatAmount = (value: number | string) => formatMoney(Number(value) || 0)
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
  const [loadedBalance, setLoadedBalance] = useState<{ key: string; value: PartnerBalance | null } | null>(null)
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RECEIPT' | 'PAYMENT'>(expensesView ? 'PAYMENT' : 'ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastEditedAmount, setLastEditedAmount] = useState<'treasury' | 'partner'>('treasury')
  const [draft, setDraft] = useState({ type: 'RECEIPT' as 'RECEIPT' | 'PAYMENT', partnerId: '', treasuryId: '', partnerCurrencyId: '', amount: '', partnerAmount: '', exchangeRate: '1', reason: '', description: '', receiptDate: today() })

  const load = useCallback(async () => {
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
  }, [typeFilter, ar])
  useLoadEffect(load)
  // Only the balance fetched for the current partner and currency is shown.
  const balanceKey = draft.partnerId && draft.partnerCurrencyId ? `${draft.partnerId}:${draft.partnerCurrencyId}` : ''
  const partnerBalance = balanceKey && loadedBalance?.key === balanceKey ? loadedBalance.value : null
  useEffect(() => {
    if (!balanceKey) return
    const [partnerId, currencyId] = balanceKey.split(':')
    const controller = new AbortController()
    void fetch(`/api/transactions/partner/${partnerId}/balance?currencyId=${currencyId}`, { signal: controller.signal }).then(response => response.ok ? response.json() : null).then(value => setLoadedBalance({ key: balanceKey, value })).catch(() => undefined)
    return () => controller.abort()
  }, [balanceKey])

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
  // Default the account currency to the partner's open balance in the direction being settled (what we owe for a payment, what they owe for a receipt).
  async function choosePartner(partnerId: string) {
    setDraft(current => ({ ...current, partnerId }))
    if (!partnerId) return
    try {
      const response = await fetch(`/api/transactions/partner/${partnerId}/balances`)
      if (!response.ok) return
      const balances: { amount: number; currencyId: number }[] = await response.json()
      setDraft(current => {
        if (current.partnerId !== partnerId) return current
        const open = balances.filter(item => current.type === 'PAYMENT' ? item.amount < 0 : item.amount > 0).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0]
        return open ? recalculate({ ...current, partnerCurrencyId: open.currencyId.toString() }, lastEditedAmount) : current
      })
    } catch { /* The currency stays as chosen; the user can still pick it. */ }
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
  const [period, setPeriod] = useState<DatePreset>('all')
  const [selected, setSelected] = useState<Receipt | null>(null)
  const visible = rows.filter(item => inDatePreset(item.receiptDate, period))
  const typeLabel = (item: Receipt) => item.type === 'RECEIPT' ? (ar ? 'استلام' : 'Receipt') : (expensesView ? (ar ? 'منصرف' : 'Expense') : (ar ? 'دفع' : 'Payment'))
  const typeBadge = (item: Receipt) => <span className={`receipt-type-badge ${item.type === 'RECEIPT' ? 'receipt-type-in' : 'receipt-type-out'}`}>{typeLabel(item)}</span>
  const columns: Array<TableColumn<Receipt>> = [
    { key: 'receiptNo', title: expensesView ? (ar ? 'رقم المنصرف' : 'Expense no.') : (ar ? 'رقم الإيصال' : 'Receipt no.'), value: item => item.receiptNo, render: item => <span className="doc-no">{item.receiptNo}</span> },
    { key: 'type', title: ar ? 'النوع' : 'Type', value: item => item.type, searchable: false, render: typeBadge },
    { key: 'receiptDate', title: ar ? 'التاريخ' : 'Date', value: item => item.receiptDate, searchable: false, render: item => formatDay(item.receiptDate) },
    { key: 'partnerName', title: ar ? 'المستفيد' : 'Partner', value: item => item.partnerName ?? '', wrap: true, render: item => item.partnerName ?? '—' },
    { key: 'description', title: ar ? 'البيان' : 'Description', value: item => item.description ?? item.reason ?? '', wrap: true, render: item => item.description ?? item.reason ?? <span className="muted-cell">—</span> },
    { key: 'amount', title: ar ? 'المبلغ' : 'Amount', value: item => item.amount, align: 'end', searchable: false, render: item => <Money value={item.amount} symbol={item.currencySymbol} /> },
  ]
  const isSameCurrency = (item: Receipt) => item.currencyCode === item.partnerCurrencyCode
  const symbolOf = (list: Receipt[]) => list[0]?.currencySymbol ?? ''
  const panel = selected && <DetailPanel
    title={<span className="doc-no">{selected.receiptNo}</span>}
    badge={typeBadge(selected)}
    closeLabel={ar ? 'إغلاق' : 'Close'}
    onClose={() => setSelected(null)}
    actions={<Button variant="secondary" onClick={() => void printReceipt(selected)}><Icon name="document" size={17} />{ar ? 'طباعة' : 'Print'}</Button>}>
    <DetailList items={[
      { label: ar ? 'التاريخ' : 'Date', value: formatDay(selected.receiptDate) },
      { label: ar ? 'المستفيد' : 'Partner', value: selected.partnerName ?? '—' },
      { label: ar ? 'الخزينة' : 'Treasury', value: selected.treasuryName ?? '—' },
      { label: ar ? 'المبلغ' : 'Amount', value: <Money value={selected.amount} symbol={selected.currencySymbol} />, strong: true },
      !isSameCurrency(selected) && { label: ar ? 'مبلغ الشريك' : 'Partner amount', value: <Money value={selected.partnerAmount} symbol={selected.partnerCurrencySymbol} /> },
      !isSameCurrency(selected) && { label: ar ? 'سعر الصرف' : 'Rate', value: <span className="money">1 {selected.partnerCurrencySymbol} = {formatAmount(selected.exchangeRate)} {selected.currencySymbol}</span> },
      selected.reason ? { label: ar ? 'السبب' : 'Reason', value: selected.reason } : null,
      selected.description ? { label: ar ? 'البيان' : 'Description', value: selected.description } : null,
    ]} />
  </DetailPanel>
  return <div className="receipts-page" dir={ar ? 'rtl' : 'ltr'}>
    <PageHeader title={expensesView ? (ar ? 'المنصرفات' : 'Expenses') : (ar ? 'إيصالات الاستلام والدفع' : 'Receipts & payments')} description={expensesView ? (ar ? 'تسجيل ومراجعة المبالغ المصروفة من الخزائن.' : 'Record and review amounts paid from treasuries.') : (ar ? 'المبالغ المستلمة من الشركاء والمدفوعة لهم.' : 'Money received from and paid to partners.')} actions={<div className="receipt-header-actions">{!expensesView && <Button variant="secondary" onClick={() => open('PAYMENT')}><Icon name="plus" size={18} />{ar ? 'دفع لشريك' : 'Pay a partner'}</Button>}{!expensesView && <Button variant="primary" onClick={() => open('RECEIPT')}><Icon name="plus" size={18} />{ar ? 'استلام من شريك' : 'Receive from a partner'}</Button>}{expensesView && <Button variant="primary" onClick={() => open('PAYMENT')}><Icon name="plus" size={18} />{ar ? 'إضافة منصرف' : 'Add expense'}</Button>}</div>} />
    {error && !modal && <ErrorState title={ar ? 'تعذر تنفيذ العملية' : 'Request failed'} detail={error} />}
    <DataTable
      locale={locale}
      columns={columns}
      rows={visible}
      rowKey={item => item.moveNo}
      loading={loading}
      density="compact"
      pageSize={15}
      searchLabel={expensesView ? (ar ? 'بحث في المنصرفات' : 'Search expenses') : (ar ? 'بحث في الإيصالات' : 'Search receipts')}
      searchPlaceholder={expensesView ? (ar ? 'ابحث برقم المنصرف أو المستفيد' : 'Search expense or partner') : (ar ? 'ابحث برقم الإيصال أو الشريك' : 'Search receipt or partner')}
      filters={<>
        {!expensesView && <FilterChips label={ar ? 'نوع الإيصال' : 'Receipt type'} value={typeFilter} onChange={value => { setTypeFilter(value); setSelected(null) }} options={[{ value: 'ALL', label: ar ? 'الكل' : 'All' }, { value: 'RECEIPT', label: ar ? 'استلام' : 'Receipts' }, { value: 'PAYMENT', label: ar ? 'دفع' : 'Payments' }]} />}
        <FilterChips label={ar ? 'الفترة' : 'Period'} options={datePresetOptions(ar)} value={period} onChange={setPeriod} />
      </>}
      totals={list => {
        const received = list.filter(item => item.type === 'RECEIPT')
        const paid = list.filter(item => item.type === 'PAYMENT')
        return [
          { key: 'count', label: ar ? 'الحركات' : 'Entries', value: list.length },
          received.length > 0 && { key: 'in', label: ar ? 'المستلم' : 'Received', value: <Money value={sumBy(received, item => item.amount)} symbol={symbolOf(received)} />, tone: 'success' as const },
          paid.length > 0 && { key: 'out', label: expensesView ? (ar ? 'المصروف' : 'Spent') : (ar ? 'المدفوع' : 'Paid'), value: <Money value={sumBy(paid, item => item.amount)} symbol={symbolOf(paid)} />, tone: 'danger' as const },
        ].filter(item => item !== false)
      }}
      activeRowKey={selected?.moveNo ?? null}
      onRowSelect={item => setSelected(current => current?.moveNo === item.moveNo ? null : item)}
      panel={panel}
      emptyTitle={rows.length ? (ar ? 'لا توجد نتائج' : 'No results') : expensesView ? (ar ? 'لا توجد منصرفات' : 'No expenses yet') : (ar ? 'لا توجد إيصالات' : 'No receipts yet')}
      emptyDetail={rows.length ? undefined : expensesView ? (ar ? 'أضف أول منصرف للبدء.' : 'Add an expense to begin.') : (ar ? 'أضف إيصال استلام أو دفع للبدء.' : 'Add a receipt or payment to begin.')}
    />
    <Modal open={modal} title={draft.type === 'RECEIPT' ? (ar ? 'إيصال استلام' : 'Receipt') : (ar ? 'إيصال دفع' : 'Payment receipt')} titleIcon="currency" description={ar ? 'أدخل بيانات الحركة المالية.' : 'Enter the financial movement details.'} closeLabel={ar ? 'إغلاق' : 'Close'} busy={saving} onClose={() => !saving && setModal(false)} footer={<><Button variant="ghost" disabled={saving} onClick={() => setModal(false)}>{ar ? 'إلغاء' : 'Cancel'}</Button><Button variant="primary" loading={saving} onClick={() => void save()}>{ar ? 'حفظ الإيصال' : 'Save receipt'}</Button></>}>
      <div className="receipt-form"><div className="receipt-form-grid"><FormField label={ar ? 'التاريخ' : 'Date'} required><DateInput value={draft.receiptDate} onChange={e => setDraft({ ...draft, receiptDate: e.target.value })} /></FormField><FormField label={ar ? 'المستفيد' : 'Partner'} required><SearchableSelect value={draft.partnerId} onChange={value => void choosePartner(value)} placeholder={ar ? 'اختر الشريك' : 'Choose partner'} options={partners.map(item => ({ value: item.partnerId.toString(), label: item.partnerName, suffix: partnerBalance && item.partnerId.toString() === draft.partnerId ? <span className={`partner-balance ${partnerBalance.amount >= 0 ? 'is-debit' : 'is-credit'}`}>{formatAmount(Math.abs(partnerBalance.amount))} {partnerBalance.currencySymbol}</span> : null }))} /></FormField><FormField label={ar ? 'الخزينة' : 'Treasury'} required><SearchableSelect value={draft.treasuryId} onChange={value => { const treasury = treasuries.find(item => item.treasuryId.toString() === value); setDraft(recalculate({ ...draft, treasuryId: value, partnerCurrencyId: treasury?.currencyId.toString() ?? draft.partnerCurrencyId }, lastEditedAmount)) }} placeholder={ar ? 'اختر الخزينة' : 'Choose treasury'} options={treasuries.filter(item => item.isActive).map(item => ({ value: item.treasuryId.toString(), label: `${ar ? item.nameAr : item.nameEn} · ${item.currencySymbol}` }))} /></FormField><FormField label={ar ? 'عملة حساب الشريك' : 'Partner account currency'} required><SearchableSelect value={draft.partnerCurrencyId} onChange={value => setDraft(recalculate({ ...draft, partnerCurrencyId: value }, lastEditedAmount))} placeholder={ar ? 'اختر العملة' : 'Choose currency'} options={currencies.filter(item => item.isActive).map(item => ({ value: item.currencyId.toString(), label: `${item.symbol} · ${ar ? item.currencyNameAr : item.currencyNameEn}`, icon: item.flagBase64 ? <img className="searchable-select-flag" src={item.flagBase64} alt="" /> : null }))} /></FormField><FormField label={draft.type === 'RECEIPT' ? (ar ? 'المبلغ المستلم فعلياً' : 'Amount received') : (ar ? 'المبلغ المدفوع فعلياً' : 'Amount paid')} hint={selectedTreasury ? `${ar ? 'عملة الخزينة' : 'Treasury currency'}: ${selectedTreasury.currencySymbol}` : undefined} required><div className="money-input"><FormattedNumberInput className="receipt-number-input" value={draft.amount} onChange={value => { setLastEditedAmount('treasury'); setDraft(recalculate({ ...draft, amount: value }, 'treasury')) }} /><span>{selectedTreasury?.currencySymbol ?? ''}</span></div></FormField><FormField label={draft.type === 'RECEIPT' ? (ar ? 'المبلغ المدفوع من الشريك' : 'Amount paid by partner') : (ar ? 'المبلغ المستلم للشريك' : 'Amount received by partner')} hint={selectedCurrency ? `${ar ? 'عملة الحساب' : 'Account currency'}: ${selectedCurrency.symbol}` : undefined} required><div className="money-input"><FormattedNumberInput className="receipt-number-input" value={draft.partnerAmount} onChange={value => { setLastEditedAmount('partner'); setDraft(recalculate({ ...draft, partnerAmount: value }, 'partner')) }} /><span>{selectedCurrency?.symbol ?? ''}</span></div></FormField><FormField label={ar ? 'سعر الصرف' : 'Exchange rate'} hint={selectedCurrency && selectedTreasury ? `1 ${selectedCurrency.symbol} = X ${selectedTreasury.currencySymbol}` : undefined} required><div className="money-input"><FormattedNumberInput className="receipt-number-input" value={draft.exchangeRate} disabled={sameCurrency} onChange={value => setDraft(recalculateAtRate(draft, value, lastEditedAmount))} /><span>{selectedCurrency?.symbol && selectedTreasury?.currencySymbol ? `${selectedTreasury.currencySymbol}/${selectedCurrency.symbol}` : selectedTreasury?.currencySymbol ?? ''}</span></div></FormField><FormField label={ar ? 'المعادِل بعملة الخزينة' : 'Treasury equivalent'} hint={ar ? 'مبلغ الشريك × سعر الصرف' : 'Partner amount × exchange rate'}><div className="receipt-local-amount">{formatAmount(localAmount)} {selectedTreasury?.currencySymbol ?? ''}</div></FormField><FormField label={ar ? 'السبب' : 'Reason'}><TextInput value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })} placeholder={ar ? 'مثال: تحصيل أو إرجاع مصروفات' : 'e.g. Collection or expense refund'} /></FormField><FormField label={ar ? 'البيان' : 'Description'}><textarea className="text-input receipt-description" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={2} /></FormField></div>{error && <div className="receipt-form-error" role="alert">{error}</div>}<p className="receipt-account-note"><Icon name="info" size={16} />{ar ? 'سيتم تسجيل عملة الخزينة وعملة حساب الشريك وسعر الصرف معاً.' : 'The treasury currency, partner currency and exchange rate will be recorded together.'}</p></div>
    </Modal>
  </div>
}

