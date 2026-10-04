import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Button, IconButton, LoadingState, Money, Select } from '../../components/shared'
import { Icon } from '../../components/icons'
import { useLoadEffect } from '../../components/useLoadEffect'
import { formatDay, formatMoney, localDate } from '../../app/formatters'
import type { Locale } from '../../layouts/AppLayout'

type Item = { itemId: number; itemCode: string; nameAr: string; nameEn: string; sellPrice: number; isActive?: boolean }
type Treasury = { treasuryId: number; nameAr: string; nameEn: string; currencyId: number; currencySymbol: string; isActive: boolean }
type Currency = { currencyId: number; symbol: string; isPrimary: boolean }
type Partner = { partnerId: number; partnerName: string; status: string; partnerTypeCode?: string }
type Batch = { purchaseLineId: number; batchNo: string; expiryDate?: string | null; availableQuantity: number }
type CartLine = { key: number; item: Item; quantity: number; unitPrice: number; batch?: Batch | null }

const drawerKey = (userId: number) => `elite-pos-till-drawer-${userId}`
const readDrawer = (userId: number) => { try { return localStorage.getItem(drawerKey(userId)) ?? '' } catch { return '' } }
const saveDrawer = (userId: number, value: string) => { try { localStorage.setItem(drawerKey(userId), value) } catch { /* The drawer is chosen again next time. */ } }
const daysUntil = (value: string) => Math.round((new Date(`${value.slice(0, 10)}T12:00:00`).getTime() - Date.now()) / 86400000)

// The cashier's screen: always-focused scan field, keyboard shortcuts, a drawer set once per shift, batch and expiry on each line.
export function TillPage({ locale, branchId, userId, branchName, canOverridePrice = false, onExit }: { locale: Locale; branchId: number; userId: number; branchName: string; canOverridePrice?: boolean; onExit: () => void }) {
  const ar = locale === 'ar'
  const [items, setItems] = useState<Item[]>([])
  const [treasuries, setTreasuries] = useState<Treasury[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [currency, setCurrency] = useState<Currency | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [drawerId, setDrawerId] = useState(() => readDrawer(userId))
  const [customerId, setCustomerId] = useState('')
  const [lines, setLines] = useState<CartLine[]>([])
  const [activeLine, setActiveLine] = useState<number | null>(null)
  const [discount, setDiscount] = useState('')
  const [tendered, setTendered] = useState('')
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [paying, setPaying] = useState(false)
  const nextKey = useRef(1)
  const scanRef = useRef<HTMLInputElement>(null)
  const customerRef = useRef<HTMLSelectElement>(null)
  const discountRef = useRef<HTMLInputElement>(null)
  const tenderRef = useRef<HTMLInputElement>(null)
  const payRef = useRef<() => void>(() => undefined)

  const load = useCallback(async () => {
    try {
      const responses = await Promise.all([fetch('/api/items'), fetch('/api/treasuries'), fetch('/api/currencies'), fetch('/api/partners/options')])
      if (responses.some(response => !response.ok)) throw new Error('load')
      const currencies = await responses[2].json() as Currency[]
      const primary = currencies.find(entry => entry.isPrimary) ?? null
      setCurrency(primary)
      setItems((await responses[0].json() as Item[]).filter(item => item.isActive !== false))
      const drawers = (await responses[1].json() as Treasury[]).filter(entry => entry.isActive && entry.currencyId === primary?.currencyId)
      setTreasuries(drawers)
      setPartners((await responses[3].json() as Partner[]).filter(entry => entry.status === 'ACTIVE' && (entry.partnerTypeCode === 'CLIENT' || entry.partnerTypeCode === 'BOTH' || !entry.partnerTypeCode)))
      setDrawerId(current => drawers.some(entry => String(entry.treasuryId) === current) ? current : '')
    } catch { setLoadError(ar ? 'تعذر تحميل نقطة البيع.' : 'Could not load the till.') } finally { setLoading(false) }
  }, [ar])
  useLoadEffect(load)

  const symbol = currency?.symbol ?? ''
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), [lines])
  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal)
  const total = Math.max(0, subtotal - discountValue)
  const onAccount = customerId !== ''
  const tenderValue = tendered === '' ? total : Number(tendered) || 0
  const change = onAccount ? 0 : Math.max(0, tenderValue - total)
  const short = !onAccount && tenderValue < total
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)

  const matches = useMemo(() => {
    const text = query.trim().toLocaleLowerCase()
    if (!text) return []
    return items.filter(item => `${item.itemCode} ${item.nameEn} ${item.nameAr}`.toLocaleLowerCase().includes(text)).slice(0, 8)
  }, [items, query])

  function say(tone: 'ok' | 'bad', text: string) { setNotice({ tone, text }) }

  // Batch and expiry are shown for information; the server still picks the stock it sells from.
  async function loadBatch(key: number, itemId: number) {
    try {
      const response = await fetch(`/api/inventory/${itemId}/batches?branchId=${branchId}`)
      if (!response.ok) return
      const batches = (await response.json() as Batch[]).filter(batch => batch.availableQuantity > 0)
      batches.sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'))
      setLines(current => current.map(line => line.key === key ? { ...line, batch: batches[0] ?? null } : line))
    } catch { /* The line works without batch information. */ }
  }

  function addItem(item: Item) {
    const existing = lines.find(line => line.item.itemId === item.itemId)
    if (existing) {
      setLines(current => current.map(line => line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line))
      setActiveLine(existing.key)
    } else {
      const key = nextKey.current++
      setLines(current => [...current, { key, item, quantity: 1, unitPrice: item.sellPrice ?? 0 }])
      setActiveLine(key)
      void loadBatch(key, item.itemId)
    }
    setQuery(''); setHighlight(0); setNotice(null)
  }

  function onScanKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight(current => Math.min(current + 1, Math.max(matches.length - 1, 0))); return }
    if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight(current => Math.max(current - 1, 0)); return }
    if (event.key === 'Escape') { setQuery(''); return }
    if (event.key !== 'Enter') return
    event.preventDefault()
    const text = query.trim()
    if (!text) { if (lines.length) tenderRef.current?.focus(); return }
    const exact = items.find(item => item.itemCode.trim().toLocaleLowerCase() === text.toLocaleLowerCase())
    if (exact) { addItem(exact); return }
    if (matches.length === 1) { addItem(matches[0]); return }
    if (matches.length > 1) { addItem(matches[Math.min(highlight, matches.length - 1)]); return }
    say('bad', ar ? `لا يوجد صنف بالباركود ${text}` : `No item with barcode ${text}`)
  }

  function setQuantity(key: number, quantity: number) {
    if (quantity <= 0) { setLines(current => current.filter(line => line.key !== key)); return }
    setLines(current => current.map(line => line.key === key ? { ...line, quantity } : line))
  }

  function clearSale() { setLines([]); setActiveLine(null); setDiscount(''); setTendered(''); setCustomerId(''); setQuery(''); setNotice(null); scanRef.current?.focus() }

  async function pay() {
    if (paying) return
    if (!lines.length) { say('bad', ar ? 'أضف صنفاً أولاً.' : 'Add an item first.'); scanRef.current?.focus(); return }
    if (!onAccount && !drawerId) { say('bad', ar ? 'اختر الخزنة أعلى الشاشة.' : 'Choose the drawer at the top first.'); return }
    if (short) { say('bad', ar ? 'المبلغ المدفوع أقل من الإجمالي.' : 'The tendered amount is less than the total.'); tenderRef.current?.focus(); return }
    setPaying(true)
    try {
      const response = await fetch('/api/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleDate: localDate(), customerPartnerId: onAccount ? Number(customerId) : null, treasuryId: onAccount ? null : Number(drawerId), currencyId: currency?.currencyId, branchId, savedBy: userId, discount: discountValue, lines: lines.map(line => ({ itemId: line.item.itemId, quantity: line.quantity, unitPrice: line.unitPrice })) }),
      })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json() as { saleNo: string }
      const changeText = !onAccount && change > 0 ? ` · ${ar ? 'الباقي' : 'Change'} ${formatMoney(change, symbol)}` : ''
      clearSale()
      say('ok', `${ar ? 'تم حفظ الفاتورة' : 'Invoice saved'} ${result.saleNo}${changeText}`)
    } catch (failure) { say('bad', failure instanceof Error && failure.message ? failure.message : (ar ? 'تعذر حفظ البيع.' : 'Could not save the sale.')) } finally { setPaying(false) }
  }
  useEffect(() => { payRef.current = () => void pay() })

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      const actions: Record<string, () => void> = {
        F2: () => scanRef.current?.focus(),
        F4: () => customerRef.current?.focus(),
        F6: () => discountRef.current?.focus(),
        F8: () => tenderRef.current?.focus(),
        F9: () => payRef.current(),
      }
      const action = actions[event.key]
      if (!action) return
      event.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { if (!loading) scanRef.current?.focus() }, [loading])
  useEffect(() => { if (notice?.tone === 'ok') { const timer = window.setTimeout(() => setNotice(null), 6000); return () => window.clearTimeout(timer) } }, [notice])

  if (loading) return <div className="till" dir={ar ? 'rtl' : 'ltr'}><LoadingState /></div>

  const quick = [...new Set([Math.ceil(total), Math.ceil(total / 100) * 100, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000].filter(value => value > 0))].slice(0, 4)
  const drawerName = treasuries.find(entry => String(entry.treasuryId) === drawerId)

  return <div className="till" dir={ar ? 'rtl' : 'ltr'}>
    <header className="till-bar">
      <div className="till-bar-id"><span className="till-logo" aria-hidden="true">E</span><strong>{ar ? 'نقطة البيع' : 'Till'}</strong><span className="till-bar-meta">{branchName} · {formatDay(localDate())}</span></div>
      <label className="till-drawer"><span>{ar ? 'الخزنة' : 'Drawer'}</span>
        <Select value={drawerId} onChange={event => { setDrawerId(event.target.value); saveDrawer(userId, event.target.value) }} aria-label={ar ? 'الخزنة' : 'Drawer'}>
          <option value="">{ar ? 'اختر الخزنة' : 'Choose drawer'}</option>
          {treasuries.map(entry => <option key={entry.treasuryId} value={entry.treasuryId}>{ar ? entry.nameAr : entry.nameEn}</option>)}
        </Select>
      </label>
      <Button variant="ghost" className="till-exit" onClick={onExit}><Icon name="logout" size={17} className="icon-flip-rtl" />{ar ? 'الإدارة' : 'Back office'}</Button>
    </header>
    <div className="till-main">
      <section className="till-cart" aria-label={ar ? 'الفاتورة' : 'Sale'}>
        <div className="till-scan-wrap">
          <label className="till-scan"><Icon name="barcode" size={24} />
            <input ref={scanRef} value={query} onChange={event => { setQuery(event.target.value); setHighlight(0); setNotice(null) }} onKeyDown={onScanKeyDown} placeholder={ar ? 'امسح الباركود أو اكتب اسم الصنف' : 'Scan a barcode or type an item name'} aria-label={ar ? 'مسح أو بحث عن صنف' : 'Scan or find item'} autoComplete="off" />
            <kbd>F2</kbd>
          </label>
          {matches.length > 1 && <ul className="till-results" role="listbox" aria-label={ar ? 'نتائج البحث' : 'Matches'}>{matches.map((item, index) => <li key={item.itemId} role="option" aria-selected={index === highlight} className={index === highlight ? 'is-active' : ''} onMouseDown={event => { event.preventDefault(); addItem(item) }}><span><strong>{ar ? item.nameAr : item.nameEn}</strong><small>{item.itemCode}</small></span><Money value={item.sellPrice} symbol={symbol} /></li>)}</ul>}
        </div>
        {notice && <div className={`till-notice till-notice-${notice.tone}`} role={notice.tone === 'bad' ? 'alert' : 'status'}>{notice.text}</div>}
        {loadError && <div className="till-notice till-notice-bad" role="alert">{loadError}</div>}
        {lines.length === 0 ? <div className="till-empty"><Icon name="barcode" size={44} /><strong>{ar ? 'جاهز للمسح' : 'Ready to scan'}</strong><span>{ar ? 'امسح أول صنف لبدء الفاتورة.' : 'Scan the first item to start the sale.'}</span></div>
          : <ol className="till-lines">{lines.map((line, index) => {
            const days = line.batch?.expiryDate ? daysUntil(line.batch.expiryDate) : null
            return <li key={line.key} className={`till-line${activeLine === line.key ? ' is-last' : ''}`} onClick={() => setActiveLine(line.key)}>
              <span className="till-line-no">{index + 1}</span>
              <div className="till-line-name"><strong>{ar ? line.item.nameAr : line.item.nameEn}</strong>
                <small><span className="doc-no">{line.item.itemCode}</span>
                  {line.batch && <span className="till-chip">{ar ? 'تشغيلة' : 'Batch'} {line.batch.batchNo}</span>}
                  {line.batch?.expiryDate && <span className={`till-chip${days != null && days <= 60 ? ' is-warn' : ''}`}>{ar ? 'انتهاء' : 'Exp'} {formatDay(line.batch.expiryDate)}</span>}
                </small></div>
              <div className="till-step" role="group" aria-label={ar ? 'الكمية' : 'Quantity'}>
                <button type="button" aria-label={ar ? 'إنقاص' : 'Decrease'} onClick={() => setQuantity(line.key, line.quantity - 1)}>−</button>
                <input type="number" min="0" step="any" inputMode="decimal" value={line.quantity} aria-label={`${ar ? 'كمية' : 'Quantity of'} ${ar ? line.item.nameAr : line.item.nameEn}`} onChange={event => setQuantity(line.key, Number(event.target.value) || 0)} onFocus={event => event.target.select()} />
                <button type="button" aria-label={ar ? 'زيادة' : 'Increase'} onClick={() => setQuantity(line.key, line.quantity + 1)}>+</button>
              </div>
              <label className="till-price"><span>{ar ? 'السعر' : 'Price'}</span>
                {canOverridePrice
                  ? <input type="number" min="0" step="any" inputMode="decimal" value={line.unitPrice} aria-label={`${ar ? 'سعر' : 'Price of'} ${ar ? line.item.nameAr : line.item.nameEn}`} onChange={event => setLines(current => current.map(entry => entry.key === line.key ? { ...entry, unitPrice: Number(event.target.value) || 0 } : entry))} onFocus={event => event.target.select()} />
                  : <Money value={line.unitPrice} />}
              </label>
              <strong className="till-line-total"><Money value={line.quantity * line.unitPrice} /></strong>
              <IconButton label={ar ? 'حذف السطر' : 'Remove line'} variant="ghost" onClick={() => setQuantity(line.key, 0)}><Icon name="trash" size={18} /></IconButton>
            </li>
          })}</ol>}
      </section>
      <aside className="till-pay" aria-label={ar ? 'الدفع' : 'Payment'}>
        <label className="till-field"><span>{ar ? 'العميل' : 'Customer'} <kbd>F4</kbd></span>
          <select ref={customerRef} className="select-input" value={customerId} onChange={event => { setCustomerId(event.target.value); setTendered('') }} aria-label={ar ? 'العميل' : 'Customer'}>
            <option value="">{ar ? 'عميل نقدي' : 'Walk-in customer'}</option>
            {partners.map(entry => <option key={entry.partnerId} value={entry.partnerId}>{entry.partnerName}</option>)}
          </select>
        </label>
        {onAccount && <p className="field-hint" role="note">{ar ? 'تُسجَّل الفاتورة على حساب العميل وتُسدَّد لاحقاً بسند قبض.' : "Goes on the customer's account and is settled later with a receipt."}</p>}
        <dl className="till-totals">
          <div><dt>{ar ? 'الأصناف' : 'Items'}</dt><dd className="num">{itemCount}</dd></div>
          <div><dt>{ar ? 'المجموع الفرعي' : 'Subtotal'}</dt><dd><Money value={subtotal} symbol={symbol} /></dd></div>
          <div className="till-discount"><dt><label htmlFor="till-discount">{ar ? 'الخصم' : 'Discount'}</label> <kbd>F6</kbd></dt><dd><input id="till-discount" ref={discountRef} type="number" min="0" step="any" inputMode="decimal" placeholder="0.00" value={discount} onChange={event => setDiscount(event.target.value)} onFocus={event => event.target.select()} /></dd></div>
        </dl>
        <div className="till-grand"><span>{ar ? 'الإجمالي' : 'Total'}</span><strong><Money value={total} symbol={symbol} /></strong></div>
        {!onAccount && <div className="till-tender">
          <label className="till-field"><span>{ar ? 'المدفوع' : 'Tendered'} <kbd>F8</kbd></span>
            <input ref={tenderRef} className="till-tender-input" type="number" min="0" step="any" inputMode="decimal" placeholder={formatMoney(total)} value={tendered} onChange={event => setTendered(event.target.value)} onFocus={event => event.target.select()} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void pay() } }} aria-label={ar ? 'المبلغ المدفوع' : 'Amount tendered'} />
          </label>
          <div className="till-quick">{quick.map(value => <button key={value} type="button" onClick={() => setTendered(String(value))}>{formatMoney(value)}</button>)}</div>
          <div className={`till-change${short ? ' is-short' : ''}`}><span>{short ? (ar ? 'ينقص' : 'Short by') : (ar ? 'الباقي' : 'Change')}</span><strong><Money value={short ? total - tenderValue : change} symbol={symbol} /></strong></div>
        </div>}
        <div className="till-actions">
          <Button variant="primary" className="till-pay-button" loading={paying} onClick={() => void pay()}>{onAccount ? (ar ? 'تسجيل على الحساب' : 'Put on account') : (ar ? 'الدفع' : 'Pay')}<kbd>F9</kbd></Button>
          <Button variant="ghost" onClick={clearSale} disabled={!lines.length && !discount && !customerId}>{ar ? 'إلغاء الفاتورة' : 'Clear sale'}</Button>
          {!onAccount && drawerName && <small className="till-drawer-note">{ar ? 'النقد إلى' : 'Cash goes to'} {ar ? drawerName.nameAr : drawerName.nameEn}</small>}
        </div>
      </aside>
    </div>
    <footer className="till-keys" aria-hidden="true"><span><kbd>F2</kbd>{ar ? 'مسح' : 'Scan'}</span><span><kbd>F4</kbd>{ar ? 'العميل' : 'Customer'}</span><span><kbd>F6</kbd>{ar ? 'خصم' : 'Discount'}</span><span><kbd>F8</kbd>{ar ? 'المدفوع' : 'Tender'}</span><span><kbd>F9</kbd>{ar ? 'دفع' : 'Pay'}</span><span><kbd>↑↓</kbd>{ar ? 'اختيار' : 'Pick'}</span></footer>
  </div>
}
