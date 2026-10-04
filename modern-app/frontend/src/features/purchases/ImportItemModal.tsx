import { useEffect, useMemo, useState } from 'react'
import { Button, DateInput, FormField, Modal, NumberInput, Select, TextInput } from '../../components/shared'
import { formatMoney } from '../../app/formatters'
import { toNumber, type DraftLine, type Item, type Unit } from './importModel'

type Props = {
  ar: boolean
  open: boolean
  line: DraftLine | null
  items: Item[]
  currencySymbol: string
  // The item's last landed cost is in the main currency; this turns it into the invoice currency for the price field.
  toInvoicePrice: (mainPrice: number) => number
  loadUnits: (itemId: number) => Promise<Unit[]>
  onClose: () => void
  onSave: (line: DraftLine) => void
}

const empty = (): DraftLine => ({ key: `new-${Date.now()}-${Math.random()}`, itemId: 0, itemName: '', unitSettingId: null, unitName: '', quantity: '1', unitPrice: '', expiryDate: '', batchNo: '', barcode: '' })

export function ImportItemModal({ ar, open, line, items, currencySymbol, toInvoicePrice, loadUnits, onClose, onSave }: Props) {
  // The parent mounts this dialog fresh for every line, so the draft starts from the line being edited.
  const [draft, setDraft] = useState<DraftLine>(() => line ?? empty())
  const [units, setUnits] = useState<Unit[]>([])
  const [search, setSearch] = useState(line?.itemName ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (line?.itemId) void loadUnits(line.itemId).then(setUnits)
  }, [line, loadUnits])

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter(item => !term || item.nameEn.toLowerCase().includes(term) || item.nameAr.includes(term) || (item.itemCode ?? '').toLowerCase().includes(term)).slice(0, 60)
  }, [items, search])

  async function chooseItem(item: Item) {
    const itemUnits = await loadUnits(item.itemId)
    const base = itemUnits.find(unit => unit.isBase) ?? itemUnits[0]
    const last = toInvoicePrice(Number(item.lastPurchasePrice ?? 0))
    setUnits(itemUnits)
    setSearch(ar ? item.nameAr : item.nameEn)
    setPickerOpen(false)
    setDraft(current => ({
      ...current,
      itemId: item.itemId,
      itemName: ar ? item.nameAr : item.nameEn,
      unitSettingId: base?.unitSettingId ?? null,
      unitName: base ? unitLabel(base) : '',
      unitPrice: last > 0 ? String(last) : current.unitPrice,
    }))
  }

  function chooseUnit(value: string) {
    const unit = units.find(candidate => String(candidate.unitSettingId) === value)
    if (!unit) return
    const item = items.find(candidate => candidate.itemId === draft.itemId)
    const last = toInvoicePrice(Number(item?.lastPurchasePrice ?? 0))
    setDraft(current => ({ ...current, unitSettingId: unit.unitSettingId, unitName: unitLabel(unit), unitPrice: last > 0 ? String(Math.round(last * unit.conversionToBase * 10000) / 10000) : current.unitPrice }))
  }

  function unitLabel(unit: Unit) {
    return (ar ? unit.unitAr : unit.unitEn) ?? (ar ? 'الوحدة الأساسية' : 'Base unit')
  }

  function save() {
    if (!draft.itemId || !draft.unitSettingId) return setError(ar ? 'اختر الصنف والوحدة.' : 'Choose the item and its unit.')
    if (toNumber(draft.quantity) <= 0) return setError(ar ? 'الكمية يجب أن تكون أكبر من صفر.' : 'Quantity must be greater than zero.')
    if (draft.unitPrice === '' || toNumber(draft.unitPrice) < 0) return setError(ar ? 'أدخل سعر الشراء.' : 'Enter the purchase price.')
    onSave({ ...draft, batchNo: draft.batchNo.trim(), barcode: draft.barcode.trim() })
  }

  const total = toNumber(draft.quantity) * toNumber(draft.unitPrice)

  return (
    <Modal
      open={open}
      title={line ? (ar ? 'تعديل الصنف' : 'Edit item') : (ar ? 'إضافة صنف مستورد' : 'Add imported item')}
      titleIcon="items"
      description={ar ? 'السعر بعملة فاتورة المورد.' : "The price is in the supplier's invoice currency."}
      closeLabel={ar ? 'إغلاق' : 'Close'}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>{ar ? 'إلغاء' : 'Cancel'}</Button><Button variant="primary" onClick={save}>{line ? (ar ? 'حفظ' : 'Save') : (ar ? 'إضافة' : 'Add item')}</Button></>}
    >
      <div className="import-form">
        {error && <div className="form-error" role="alert">{error}</div>}
        <FormField label={ar ? 'الصنف' : 'Item'} required>
          <div className="purchase-item-picker">
            <TextInput
              value={search}
              placeholder={ar ? 'ابحث بالاسم أو الكود' : 'Search by name or code'}
              onFocus={() => setPickerOpen(true)}
              onChange={event => { setSearch(event.target.value); setPickerOpen(true) }}
            />
            {pickerOpen && matches.length > 0 && (
              <div className="purchase-item-options" role="listbox">
                {matches.map(item => (
                  <button type="button" role="option" aria-selected={item.itemId === draft.itemId} key={item.itemId} onMouseDown={event => event.preventDefault()} onClick={() => void chooseItem(item)}>
                    {ar ? item.nameAr : item.nameEn}{item.itemCode && <small className="import-muted"> · {item.itemCode}</small>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </FormField>
        <div className="import-form-row">
          <FormField label={ar ? 'الوحدة' : 'Unit'} required>
            <Select value={draft.unitSettingId ?? ''} disabled={!draft.itemId} onChange={event => chooseUnit(event.target.value)}>
              <option value="">{ar ? 'اختر الوحدة' : 'Choose unit'}</option>
              {units.map(unit => <option key={unit.unitSettingId} value={unit.unitSettingId}>{unitLabel(unit)}</option>)}
            </Select>
          </FormField>
          <FormField label={ar ? 'الكمية' : 'Quantity'} required>
            <NumberInput min="0" value={draft.quantity} onChange={event => setDraft(current => ({ ...current, quantity: event.target.value }))} />
          </FormField>
        </div>
        <div className="import-form-row">
          <FormField label={`${ar ? 'سعر الوحدة' : 'Unit price'} (${currencySymbol})`} required>
            <NumberInput min="0" value={draft.unitPrice} onChange={event => setDraft(current => ({ ...current, unitPrice: event.target.value }))} />
          </FormField>
          <FormField label={ar ? 'الإجمالي' : 'Line total'}>
            <div className="text-input import-readonly">{formatMoney(total, currencySymbol)}</div>
          </FormField>
        </div>
        <div className="import-form-row">
          <FormField label={ar ? 'تاريخ الانتهاء' : 'Expiry date'} hint={ar ? 'يمنع بيع الكمية بعد انتهائها.' : 'Stock is blocked from sale once it expires.'}>
            <DateInput value={draft.expiryDate} onChange={event => setDraft(current => ({ ...current, expiryDate: event.target.value }))} />
          </FormField>
          <FormField label={ar ? 'رقم التشغيلة' : 'Batch no.'}>
            <TextInput maxLength={80} value={draft.batchNo} onChange={event => setDraft(current => ({ ...current, batchNo: event.target.value }))} />
          </FormField>
        </div>
        <FormField label={ar ? 'الباركود' : 'Barcode'}>
          <TextInput maxLength={100} value={draft.barcode} onChange={event => setDraft(current => ({ ...current, barcode: event.target.value }))} />
        </FormField>
      </div>
    </Modal>
  )
}
