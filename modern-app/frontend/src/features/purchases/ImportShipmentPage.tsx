import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, ConfirmDialog, DateInput, FormField, IconButton, LoadingState, Select, StatusBadge, TextInput, NumberInput } from '../../components/shared'
import { Icon } from '../../components/icons'
import { PageHeader, type Locale } from '../../layouts/AppLayout'
import { formatMoney, localDate } from '../../app/formatters'
import { ImportItemModal } from './ImportItemModal'
import { ImportCostModal } from './ImportCostModal'
import {
  allocate, costTypeLabel, lineFromSaved, readProblem, toNumber,
  type AllocationMethod, type CostDraft, type Country, type Currency, type DraftLine, type ImportCost, type ImportShipment,
  type Item, type Partner, type PayableAccount, type Treasury, type Unit,
} from './importModel'
import './importShipment.css'

type Header = { supplierId: string; supplierInvoiceNo: string; date: string; countryId: string; reference: string; currencyId: string; rate: string; allocation: AllocationMethod }

const blankHeader = (): Header => ({ supplierId: '', supplierInvoiceNo: '', date: localDate(), countryId: '', reference: '', currencyId: '', rate: '1', allocation: 'VALUE' })

function headerFromSaved(shipment: ImportShipment): Header {
  return {
    supplierId: String(shipment.supplierPartnerId),
    supplierInvoiceNo: shipment.supplierInvoiceNo ?? '',
    date: shipment.purchaseDate.slice(0, 10),
    countryId: shipment.countryId ? String(shipment.countryId) : '',
    reference: shipment.shipmentReference ?? '',
    currencyId: String(shipment.currencyId),
    rate: String(shipment.exchangeRateToBase),
    allocation: shipment.allocationMethod,
  }
}

const snapshot = (header: Header, lines: DraftLine[]) => JSON.stringify([header, lines.map(({ key: _key, ...line }) => line)])

export function ImportShipmentPage({ locale, purchaseId, onBack }: { locale: Locale; purchaseId?: number; onBack: () => void }) {
  const ar = locale === 'ar'
  const [items, setItems] = useState<Item[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [treasuries, setTreasuries] = useState<Treasury[]>([])
  const [accounts, setAccounts] = useState<PayableAccount[]>([])
  const [shipment, setShipment] = useState<ImportShipment | null>(null)
  const [header, setHeader] = useState<Header>(blankHeader)
  const [lines, setLines] = useState<DraftLine[]>([])
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [itemModal, setItemModal] = useState<{ open: boolean; line: DraftLine | null }>({ open: false, line: null })
  const [costModal, setCostModal] = useState<{ open: boolean; costId: number | null; initial: CostDraft }>({ open: false, costId: null, initial: emptyCost('', '1') })
  const [costError, setCostError] = useState('')
  const [confirm, setConfirm] = useState<'receive' | 'cancel' | { removeCost: ImportCost } | null>(null)
  const unitCache = useRef(new Map<number, Unit[]>())

  const base = currencies.find(currency => currency.isPrimary)
  const baseSymbol = base?.symbol ?? ''
  const currency = currencies.find(item => String(item.currencyId) === header.currencyId)
  const symbol = currency?.symbol ?? ''
  const rate = currency?.isPrimary ? 1 : toNumber(header.rate)
  const editable = !shipment || shipment.status === 'DRAFT'
  const dirty = editable && snapshot(header, lines) !== savedSnapshot

  const apply = useCallback((saved: ImportShipment) => {
    const nextHeader = headerFromSaved(saved)
    const nextLines = saved.lines.map(lineFromSaved)
    setShipment(saved)
    setHeader(nextHeader)
    setLines(nextLines)
    setSavedSnapshot(snapshot(nextHeader, nextLines))
  }, [])

  useEffect(() => {
    let active = true
    const optional = async <T,>(url: string, fallback: T) => { try { const response = await fetch(url); return response.ok ? await response.json() as T : fallback } catch { return fallback } }
    void (async () => {
      try {
        const [itemsResponse, partnersResponse, optionsResponse, countriesResponse, currenciesResponse] = await Promise.all([fetch('/api/items'), fetch('/api/partners'), fetch('/api/partners/options'), fetch('/api/locations/countries'), fetch('/api/currencies')])
        if (![itemsResponse, partnersResponse, optionsResponse, countriesResponse, currenciesResponse].every(response => response.ok)) throw new Error('load')
        const partnerRows = await partnersResponse.json() as Array<{ businessName: string; partnerTypeCode?: string; status: string; customerCode?: string }>
        const options = await optionsResponse.json() as Array<{ partnerId: number; partnerCode: string; partnerName: string; status: string }>
        const loadedCurrencies = (await currenciesResponse.json() as Currency[]).filter(item => item.isActive)
        const [loadedTreasuries, loadedAccounts] = await Promise.all([optional<Treasury[]>('/api/treasuries', []), optional<PayableAccount[]>('/api/imports/payable-accounts', [])])
        if (!active) return
        setItems(await itemsResponse.json() as Item[])
        setPartners(options.filter(option => option.status === 'ACTIVE').map(option => {
          const row = partnerRows.find(candidate => candidate.customerCode === option.partnerCode || candidate.businessName === option.partnerName)
          return { partnerId: option.partnerId, partnerName: option.partnerName, isSupplier: row?.partnerTypeCode === 'SUPPLIER' || row?.partnerTypeCode === 'BOTH' }
        }))
        setCountries((await countriesResponse.json() as Country[]).filter(country => country.isActive))
        setCurrencies(loadedCurrencies)
        setTreasuries(loadedTreasuries.filter(treasury => treasury.isActive))
        setAccounts(loadedAccounts)
        if (purchaseId) {
          const response = await fetch(`/api/imports/${purchaseId}`)
          if (!response.ok) throw new Error(await readProblem(response, 'load'))
          if (active) apply(await response.json() as ImportShipment)
        } else {
          const primary = loadedCurrencies.find(item => item.isPrimary)
          const start = { ...blankHeader(), currencyId: primary ? String(primary.currencyId) : '' }
          setHeader(start)
          setSavedSnapshot(snapshot(start, []))
        }
      } catch {
        if (active) setError(ar ? 'تعذر تحميل بيانات الاستيراد.' : 'Could not load the import shipment.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [purchaseId, ar, apply])

  const loadUnits = useCallback(async (itemId: number) => {
    const cached = unitCache.current.get(itemId)
    if (cached) return cached
    try {
      const response = await fetch(`/api/items/${itemId}`)
      const units = response.ok ? ((await response.json()) as { units?: Unit[] }).units ?? [] : []
      unitCache.current.set(itemId, units)
      return units
    } catch { return [] }
  }, [])

  const toInvoicePrice = (mainPrice: number) => (!mainPrice || currency?.isPrimary || rate <= 0 ? mainPrice : Math.round(mainPrice / rate * 10000) / 10000)

  // What each line would land at if the shipment were received now. A received shipment shows what it landed at.
  const preview = useMemo(() => {
    const costsBase = shipment?.costsBase ?? 0
    const values = lines.map(line => ({ value: toNumber(line.quantity) * toNumber(line.unitPrice) * rate, quantity: toNumber(line.quantity) }))
    const shares = allocate(values, costsBase, header.allocation)
    const rows = lines.map((line, index) => {
      const saved = !dirty && shipment ? shipment.lines.find(candidate => `saved-${candidate.purchaseLineId}` === line.key) : undefined
      const landed = saved && shipment?.status === 'POSTED' ? saved.landedTotalBase : values[index].value + shares[index]
      const quantity = toNumber(line.quantity)
      return { line, total: toNumber(line.quantity) * toNumber(line.unitPrice), landed, unitLanded: quantity ? landed / quantity : 0, share: landed - values[index].value }
    })
    const goods = rows.reduce((sum, row) => sum + row.total, 0)
    const goodsBase = values.reduce((sum, value) => sum + value.value, 0)
    return { rows, goods, goodsBase, costsBase, landed: goodsBase + costsBase }
  }, [lines, rate, header.allocation, shipment, dirty])

  function updateHeader(patch: Partial<Header>) { setHeader(current => ({ ...current, ...patch })); setNotice('') }

  function chooseCurrency(value: string) {
    const selected = currencies.find(item => String(item.currencyId) === value)
    updateHeader({ currencyId: value, rate: selected?.isPrimary ? '1' : String(selected?.exchangeRate ?? '') })
  }

  function saveLine(line: DraftLine) {
    setLines(current => current.some(existing => existing.key === line.key) ? current.map(existing => existing.key === line.key ? line : existing) : [...current, line])
    setItemModal({ open: false, line: null })
    setNotice('')
  }

  async function saveShipment() {
    setError('')
    if (!header.supplierId || !header.countryId || !header.currencyId) return setError(ar ? 'اختر المورد والبلد والعملة.' : 'Choose the supplier, country and currency.')
    if (rate <= 0) return setError(ar ? 'أدخل سعر صرف أكبر من صفر.' : 'Enter an exchange rate above zero.')
    if (!lines.length) return setError(ar ? 'أضف صنفاً واحداً على الأقل.' : 'Add at least one item.')
    if (lines.some(line => !line.expiryDate) && !window.confirm(ar ? 'بعض الأصناف بدون تاريخ انتهاء، فلن يمنع بيعها عند انتهائها. هل تريد الحفظ؟' : 'Some items have no expiry date, so they will never be blocked as expired. Save anyway?')) return
    setBusy(true)
    try {
      const body = {
        supplierPartnerId: Number(header.supplierId),
        purchaseDate: header.date,
        currencyId: Number(header.currencyId),
        exchangeRateToBase: rate,
        countryId: Number(header.countryId),
        supplierInvoiceNo: header.supplierInvoiceNo.trim() || null,
        shipmentReference: header.reference.trim() || null,
        allocationMethod: header.allocation,
        lines: lines.map(line => ({ itemId: line.itemId, unitSettingId: line.unitSettingId, quantity: toNumber(line.quantity), unitPrice: toNumber(line.unitPrice), expiryDate: line.expiryDate || null, batchNo: line.batchNo || null, barcode: line.barcode || null })),
      }
      const response = await fetch(shipment ? `/api/imports/${shipment.purchaseId}` : '/api/imports', { method: shipment ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(await readProblem(response, ar ? 'تعذر حفظ الشحنة.' : 'Could not save the shipment.'))
      apply(await response.json() as ImportShipment)
      setNotice(ar ? 'تم حفظ الشحنة وتسجيل المستحق للمورد.' : "Shipment saved and the supplier's balance updated.")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function openCost(cost?: ImportCost) {
    setCostError('')
    setCostModal({
      open: true,
      costId: cost?.costId ?? null,
      initial: cost ? {
        costType: cost.costType,
        amount: String(cost.amount),
        currencyId: String(cost.currencyId),
        exchangeRate: String(cost.exchangeRateToBase),
        payeeType: cost.payeeType,
        payeePartnerId: cost.payeePartnerId ? String(cost.payeePartnerId) : '',
        payeeTreasuryId: cost.payeeTreasuryId ? String(cost.payeeTreasuryId) : '',
        payeeAccountCode: cost.payeeAccountCode ?? '',
        description: cost.description ?? '',
        paidTo: cost.paidTo ?? '',
      } : emptyCost(header.currencyId, currency?.isPrimary ? '1' : header.rate),
    })
  }

  async function saveCost(draft: CostDraft) {
    if (!shipment) return
    setBusy(true)
    setCostError('')
    try {
      const body = {
        costType: draft.costType,
        amount: toNumber(draft.amount),
        currencyId: Number(draft.currencyId),
        exchangeRateToBase: toNumber(draft.exchangeRate) || 1,
        payeeType: draft.payeeType,
        payeePartnerId: draft.payeeType === 'PARTNER' ? Number(draft.payeePartnerId) : null,
        payeeTreasuryId: draft.payeeType === 'TREASURY' ? Number(draft.payeeTreasuryId) : null,
        payeeAccountCode: draft.payeeType === 'ACCOUNT' ? draft.payeeAccountCode : null,
        description: draft.description.trim() || null,
        paidTo: draft.payeeType === 'TREASURY' ? draft.paidTo.trim() || null : null,
      }
      const url = costModal.costId ? `/api/imports/${shipment.purchaseId}/costs/${costModal.costId}` : `/api/imports/${shipment.purchaseId}/costs`
      const response = await fetch(url, { method: costModal.costId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(await readProblem(response, ar ? 'تعذر حفظ التكلفة.' : 'Could not save the cost.'))
      const saved = await response.json() as ImportShipment
      // Keep any unsaved item edits on screen; only the costs and totals come from the server.
      setShipment(saved)
      setCostModal(current => ({ ...current, open: false }))
    } catch (e) {
      setCostError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function runConfirmed() {
    if (!shipment || !confirm) return
    setBusy(true)
    setError('')
    try {
      if (confirm === 'receive') {
        const response = await fetch(`/api/imports/${shipment.purchaseId}/receive`, { method: 'POST' })
        if (!response.ok) throw new Error(await readProblem(response, ar ? 'تعذر استلام الشحنة.' : 'Could not receive the shipment.'))
        apply(await response.json() as ImportShipment)
        setNotice(ar ? 'تم استلام البضاعة وإدخالها المخزون بتكلفتها النهائية.' : 'Goods received into stock at their landed cost.')
      } else if (confirm === 'cancel') {
        const response = await fetch(`/api/imports/${shipment.purchaseId}/cancel`, { method: 'POST' })
        if (!response.ok) throw new Error(await readProblem(response, ar ? 'تعذر إلغاء الشحنة.' : 'Could not cancel the shipment.'))
        onBack()
        return
      } else {
        const response = await fetch(`/api/imports/${shipment.purchaseId}/costs/${confirm.removeCost.costId}`, { method: 'DELETE' })
        if (!response.ok) throw new Error(await readProblem(response, ar ? 'تعذر حذف التكلفة.' : 'Could not remove the cost.'))
        setShipment(await response.json() as ImportShipment)
      }
      setConfirm(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="settings-page"><LoadingState label={ar ? 'جار التحميل…' : 'Loading…'} /></div>

  const statusTone = shipment?.status === 'POSTED' ? 'success' : shipment?.status === 'CANCELLED' ? 'danger' : 'info'
  const statusText = !shipment ? (ar ? 'جديدة' : 'New') : shipment.status === 'POSTED' ? (ar ? 'مستلمة' : 'Received') : shipment.status === 'CANCELLED' ? (ar ? 'ملغاة' : 'Cancelled') : (ar ? 'بالطريق' : 'In transit')
  const suppliers = partners.filter(partner => partner.isSupplier)
  const country = countries.find(item => String(item.countryId) === header.countryId)

  return (
    <div className="settings-page import-page" dir={ar ? 'rtl' : 'ltr'}>
      <PageHeader
        title={shipment ? `${ar ? 'شحنة استيراد' : 'Import shipment'} ${shipment.invoiceNo}` : (ar ? 'شحنة استيراد جديدة' : 'New import shipment')}
        description={ar ? 'يستحق المورد قيمة البضاعة بعملة فاتورته، وتضاف كل تكلفة إلى سعر الصنف عند الاستلام.' : "The supplier is owed the goods in their invoice currency; every cost is added to the item cost on receipt."}
        actions={<>
          <Button variant="ghost" onClick={onBack}><Icon name={ar ? 'arrow-right' : 'arrow-left'} size={17} />{ar ? 'المشتريات' : 'Purchases'}</Button>
          {shipment?.status === 'DRAFT' && <Button variant="danger" disabled={busy} onClick={() => setConfirm('cancel')}>{ar ? 'إلغاء الشحنة' : 'Cancel shipment'}</Button>}
          {editable && <Button variant={shipment && !dirty ? 'secondary' : 'primary'} loading={busy && !confirm} disabled={busy || (Boolean(shipment) && !dirty)} onClick={() => void saveShipment()}><Icon name="save" size={17} />{shipment ? (ar ? 'حفظ التغييرات' : 'Save changes') : (ar ? 'حفظ الشحنة' : 'Save shipment')}</Button>}
          {shipment?.status === 'DRAFT' && <Button variant="primary" disabled={busy || dirty} onClick={() => setConfirm('receive')}><Icon name="inventory" size={17} />{ar ? 'استلام البضاعة' : 'Receive goods'}</Button>}
        </>}
      />

      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && !error && <div className="import-notice" role="status"><Icon name="info" size={17} />{notice}</div>}
      {dirty && shipment && <div className="import-notice is-warning" role="status"><Icon name="info" size={17} />{ar ? 'لديك تغييرات غير محفوظة. احفظها قبل الاستلام.' : 'You have unsaved changes. Save them before receiving.'}</div>}

      <section className="import-kpis" aria-label={ar ? 'ملخص' : 'Summary'}>
        <div className="import-kpi">
          <span>{ar ? 'الحالة' : 'Status'}</span>
          <strong><StatusBadge tone={statusTone}>{statusText}</StatusBadge></strong>
          <small>{country ? (ar ? country.nameAr : country.nameEn) : '—'}</small>
        </div>
        <div className="import-kpi">
          <span>{ar ? 'قيمة البضاعة' : 'Goods'}</span>
          <strong>{formatMoney(preview.goods, symbol)}</strong>
          <small>{currency?.isPrimary ? (ar ? 'العملة الأساسية' : 'Main currency') : `= ${formatMoney(preview.goodsBase, baseSymbol)}`}</small>
        </div>
        <div className="import-kpi">
          <span>{ar ? 'التكاليف الإضافية' : 'Additional costs'}</span>
          <strong>{formatMoney(preview.costsBase, baseSymbol)}</strong>
          <small>{shipment?.costs.length ?? 0} {ar ? 'بند' : (shipment?.costs.length === 1 ? 'cost' : 'costs')}</small>
        </div>
        <div className="import-kpi is-total">
          <span>{shipment?.status === 'POSTED' ? (ar ? 'التكلفة الواصلة' : 'Landed cost') : (ar ? 'التكلفة الواصلة المتوقعة' : 'Expected landed cost')}</span>
          <strong>{formatMoney(shipment?.status === 'POSTED' ? shipment.landedBase : preview.landed, baseSymbol)}</strong>
          <small>{preview.goodsBase > 0 ? `+${((preview.costsBase / preview.goodsBase) * 100).toFixed(1)}% ${ar ? 'على البضاعة' : 'on goods'}` : '—'}</small>
        </div>
      </section>

      <section className="import-panel">
        <header className="import-panel-head">
          <div><h2><Icon name="document" size={19} />{ar ? 'بيانات الشحنة' : 'Shipment details'}</h2><p>{ar ? 'المورد وعملة الفاتورة وسعر الصرف.' : 'Supplier, invoice currency and exchange rate.'}</p></div>
        </header>
        <div className="import-grid-fields">
          <FormField label={ar ? 'المورد' : 'Supplier'} required>
            <Select value={header.supplierId} disabled={!editable} onChange={event => updateHeader({ supplierId: event.target.value })}>
              <option value="">{ar ? 'اختر المورد' : 'Choose supplier'}</option>
              {suppliers.map(partner => <option key={partner.partnerId} value={partner.partnerId}>{partner.partnerName}</option>)}
              {shipment && !suppliers.some(partner => partner.partnerId === shipment.supplierPartnerId) && <option value={shipment.supplierPartnerId}>{shipment.supplierName}</option>}
            </Select>
          </FormField>
          <FormField label={ar ? 'رقم فاتورة المورد' : 'Supplier invoice no.'}>
            <TextInput maxLength={100} value={header.supplierInvoiceNo} disabled={!editable} onChange={event => updateHeader({ supplierInvoiceNo: event.target.value })} />
          </FormField>
          <FormField label={ar ? 'تاريخ الفاتورة' : 'Invoice date'} required>
            <DateInput value={header.date} disabled={!editable} onChange={event => updateHeader({ date: event.target.value })} />
          </FormField>
          <FormField label={ar ? 'بلد المنشأ' : 'Country of origin'} required>
            <Select value={header.countryId} disabled={!editable} onChange={event => updateHeader({ countryId: event.target.value })}>
              <option value="">{ar ? 'اختر البلد' : 'Choose country'}</option>
              {countries.map(item => <option key={item.countryId} value={item.countryId}>{ar ? item.nameAr : item.nameEn}</option>)}
            </Select>
          </FormField>
          <FormField label={ar ? 'رقم الشحنة / البوليصة' : 'Shipment / B/L reference'}>
            <TextInput maxLength={100} value={header.reference} disabled={!editable} onChange={event => updateHeader({ reference: event.target.value })} />
          </FormField>
          <FormField label={ar ? 'عملة الفاتورة' : 'Invoice currency'} required>
            <Select value={header.currencyId} disabled={!editable} onChange={event => chooseCurrency(event.target.value)}>
              {currencies.map(item => <option key={item.currencyId} value={item.currencyId}>{item.symbol} · {ar ? item.currencyNameAr : item.currencyNameEn}</option>)}
            </Select>
          </FormField>
          <FormField label={ar ? 'سعر الصرف' : 'Exchange rate'} required hint={currency && !currency.isPrimary ? `1 ${symbol} = ${header.rate || '?'} ${baseSymbol}` : (ar ? 'العملة الأساسية بسعر 1.' : 'The main currency is always at 1.')}>
            <NumberInput min="0" value={currency?.isPrimary ? '1' : header.rate} disabled={!editable || currency?.isPrimary} onChange={event => updateHeader({ rate: event.target.value })} />
          </FormField>
          <FormField label={ar ? 'توزيع التكاليف' : 'Share costs by'} hint={header.allocation === 'VALUE' ? (ar ? 'الصنف الأغلى يحمل نصيباً أكبر.' : 'Dearer items carry a bigger share.') : (ar ? 'كل وحدة تحمل نفس النصيب.' : 'Every unit carries the same share.')}>
            <div className="import-segmented" role="radiogroup">
              {(['VALUE', 'QUANTITY'] as const).map(method => (
                <button key={method} type="button" role="radio" aria-checked={header.allocation === method} className={header.allocation === method ? 'is-active' : ''} disabled={!editable} onClick={() => updateHeader({ allocation: method })}>
                  {method === 'VALUE' ? (ar ? 'القيمة' : 'Value') : (ar ? 'الكمية' : 'Quantity')}
                </button>
              ))}
            </div>
          </FormField>
        </div>
      </section>

      <div className="import-columns">
        <section className="import-panel">
          <header className="import-panel-head">
            <div><h2><Icon name="items" size={19} />{ar ? 'الأصناف' : 'Items'}</h2><p>{lines.length} {ar ? 'صنف' : lines.length === 1 ? 'line' : 'lines'}</p></div>
            {editable && <Button variant="secondary" onClick={() => setItemModal({ open: true, line: null })}><Icon name="plus" size={17} />{ar ? 'إضافة صنف' : 'Add item'}</Button>}
          </header>
          {lines.length === 0 ? (
            <div className="import-placeholder"><Icon name="items" size={28} /><strong>{ar ? 'لا توجد أصناف بعد' : 'No items yet'}</strong><span>{ar ? 'أضف الأصناف كما في فاتورة المورد.' : "Add the items as they appear on the supplier's invoice."}</span></div>
          ) : (
            <div className="import-table-scroll">
              <table className="import-table">
                <thead>
                  <tr>
                    <th>{ar ? 'الصنف' : 'Item'}</th>
                    <th className="num">{ar ? 'الكمية' : 'Qty'}</th>
                    <th className="num">{ar ? 'السعر' : 'Price'} ({symbol})</th>
                    <th className="num">{ar ? 'الإجمالي' : 'Total'} ({symbol})</th>
                    <th className="num">{ar ? 'التكلفة الواصلة للوحدة' : 'Landed / unit'} ({baseSymbol})</th>
                    <th>{ar ? 'الانتهاء والتشغيلة' : 'Expiry · batch'}</th>
                    {editable && <th aria-label={ar ? 'إجراءات' : 'Actions'} />}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map(row => (
                    <tr key={row.line.key}>
                      <td><strong>{row.line.itemName}</strong><small>{row.line.unitName}</small></td>
                      <td className="num">{toNumber(row.line.quantity).toLocaleString('en-US')}</td>
                      <td className="num">{formatMoney(toNumber(row.line.unitPrice))}</td>
                      <td className="num">{formatMoney(row.total)}</td>
                      <td className="num"><strong>{formatMoney(row.unitLanded)}</strong>{row.share > 0 && <small>+{formatMoney(row.share)} {ar ? 'تكاليف' : 'costs'}</small>}</td>
                      <td>{row.line.expiryDate ? <span>{row.line.expiryDate}</span> : <StatusBadge tone="warning">{ar ? 'بدون انتهاء' : 'No expiry'}</StatusBadge>}{row.line.batchNo && <small>{row.line.batchNo}</small>}</td>
                      {editable && (
                        <td>
                          <div className="import-row-actions">
                            <IconButton label={ar ? 'تعديل' : 'Edit'} onClick={() => setItemModal({ open: true, line: row.line })}><Icon name="edit" size={17} /></IconButton>
                            <IconButton label={ar ? 'حذف' : 'Remove'} onClick={() => setLines(current => current.filter(line => line.key !== row.line.key))}><Icon name="trash" size={17} /></IconButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="import-panel">
          <header className="import-panel-head">
            <div><h2><Icon name="coins" size={19} />{ar ? 'التكاليف الإضافية' : 'Additional costs'}</h2><p>{ar ? 'الشحن والجمارك والتخليص وغيرها.' : 'Freight, customs, clearance and more.'}</p></div>
            {shipment?.status === 'DRAFT' && <Button variant="secondary" disabled={busy} onClick={() => openCost()}><Icon name="plus" size={17} />{ar ? 'إضافة' : 'Add cost'}</Button>}
          </header>
          {!shipment ? (
            <div className="import-placeholder"><Icon name="save" size={28} /><strong>{ar ? 'احفظ الشحنة أولاً' : 'Save the shipment first'}</strong><span>{ar ? 'بعد الحفظ يمكنك إضافة الشحن والجمارك.' : 'Then add freight, customs and other costs.'}</span></div>
          ) : shipment.costs.length === 0 ? (
            <div className="import-placeholder"><Icon name="coins" size={28} /><strong>{ar ? 'لا توجد تكاليف' : 'No costs yet'}</strong><span>{ar ? 'أضف كل تكلفة واختر من يستلمها.' : 'Add each cost and choose who is paid.'}</span></div>
          ) : (
            <ul className="import-costs">
              {shipment.costs.map(cost => (
                <li key={cost.costId}>
                  <div className="import-cost-main">
                    <strong>{costTypeLabel(cost.costType, ar)}</strong>
                    <span className={`import-payee-chip is-${cost.payeeType.toLowerCase()}`}>
                      <Icon name={cost.payeeType === 'TREASURY' ? 'wallet' : cost.payeeType === 'ACCOUNT' ? 'bank' : 'user'} size={14} />
                      {cost.payeeType === 'TREASURY' ? (ar ? 'دفع من ' : 'Paid from ') : cost.payeeType === 'ACCOUNT' ? (ar ? 'حساب ' : 'Account ') : (ar ? 'مستحق لـ ' : 'Owed to ')}
                      {cost.payeeType === 'ACCOUNT' ? `${cost.payeeAccountCode} · ${cost.payeeName}` : cost.payeeName}
                      {cost.paidTo && (ar ? ` إلى ${cost.paidTo}` : ` to ${cost.paidTo}`)}
                    </span>
                    {cost.description && <small>{cost.description}</small>}
                  </div>
                  <div className="import-cost-amount">
                    <strong>{formatMoney(cost.amount, cost.currencySymbol)}</strong>
                    {cost.currencySymbol !== baseSymbol && <small>{formatMoney(cost.baseAmount, baseSymbol)}</small>}
                  </div>
                  {shipment.status === 'DRAFT' && (
                    <div className="import-row-actions">
                      <IconButton label={ar ? 'تعديل' : 'Edit'} disabled={busy} onClick={() => openCost(cost)}><Icon name="edit" size={17} /></IconButton>
                      <IconButton label={ar ? 'حذف' : 'Remove'} disabled={busy} onClick={() => setConfirm({ removeCost: cost })}><Icon name="trash" size={17} /></IconButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {itemModal.open && <ImportItemModal key={itemModal.line?.key ?? 'new'} ar={ar} open line={itemModal.line} items={items} currencySymbol={symbol} toInvoicePrice={toInvoicePrice} loadUnits={loadUnits} onClose={() => setItemModal({ open: false, line: null })} onSave={saveLine} />}
      {costModal.open && <ImportCostModal key={costModal.costId ?? 'new'} ar={ar} open initial={costModal.initial} editing={Boolean(costModal.costId)} saving={busy} error={costError} currencies={currencies} partners={partners} treasuries={treasuries} accounts={accounts} baseSymbol={baseSymbol} onClose={() => setCostModal(current => ({ ...current, open: false }))} onSave={draft => void saveCost(draft)} />}
      <ConfirmDialog
        open={confirm !== null}
        busy={busy}
        danger={confirm !== 'receive'}
        title={confirm === 'receive' ? (ar ? 'استلام البضاعة' : 'Receive goods') : confirm === 'cancel' ? (ar ? 'إلغاء الشحنة' : 'Cancel shipment') : (ar ? 'حذف التكلفة' : 'Remove cost')}
        message={confirm === 'receive'
          ? (ar ? `ستدخل البضاعة المخزون بتكلفة واصلة ${formatMoney(preview.landed, baseSymbol)}، ولا يمكن تعديل الشحنة أو تكاليفها بعد ذلك.` : `The goods enter stock at a landed cost of ${formatMoney(preview.landed, baseSymbol)}. The shipment and its costs can't be changed afterwards.`)
          : confirm === 'cancel'
            ? (ar ? 'سيتم عكس كل القيود: مستحق المورد والتكاليف والمدفوع من الخزائن. يبقى رقم الشحنة في السجل.' : "Every entry is reversed: the supplier's balance, the costs and any till payments. The shipment number stays in the history.")
            : (ar ? 'سيتم عكس قيد هذه التكلفة.' : "This cost's entry will be reversed.")}
        confirmLabel={confirm === 'receive' ? (ar ? 'استلام' : 'Receive') : confirm === 'cancel' ? (ar ? 'إلغاء الشحنة' : 'Cancel shipment') : (ar ? 'حذف' : 'Remove')}
        cancelLabel={ar ? 'رجوع' : 'Back'}
        closeLabel={ar ? 'إغلاق' : 'Close'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirmed()}
      />
    </div>
  )
}

function emptyCost(currencyId: string, rate: string): CostDraft {
  return { costType: '', amount: '', currencyId, exchangeRate: rate, payeeType: 'PARTNER', payeePartnerId: '', payeeTreasuryId: '', payeeAccountCode: '', description: '', paidTo: '' }
}
