import { useState } from 'react'
import { Button, FormField, Modal, NumberInput, Select, TextInput } from '../../components/shared'
import { formatMoney } from '../../app/formatters'
import { costTypes, toNumber, type CostDraft, type Currency, type Partner, type PayableAccount, type PayeeType, type Treasury } from './importModel'

type Props = {
  ar: boolean
  open: boolean
  initial: CostDraft
  editing: boolean
  saving: boolean
  error: string
  currencies: Currency[]
  partners: Partner[]
  treasuries: Treasury[]
  accounts: PayableAccount[]
  baseSymbol: string
  onClose: () => void
  onSave: (cost: CostDraft) => void
}

const payeeOptions: Array<[PayeeType, string, string, string, string]> = [
  ['PARTNER', 'Owed to a partner', 'مستحق لشريك', 'Shipping line, clearing agent or the supplier.', 'شركة الشحن أو المخلص أو المورد.'],
  ['TREASURY', 'Paid now from a treasury', 'مدفوع الآن من خزنة', 'For someone with no account in the system.', 'لجهة ليس لها حساب في النظام.'],
  ['ACCOUNT', 'Owed on an account', 'مستحق على حساب', 'Recorded on a payable account you choose.', 'يسجل على حساب دائن تختاره.'],
]

export function ImportCostModal({ ar, open, initial, editing, saving, error, currencies, partners, treasuries, accounts, baseSymbol, onClose, onSave }: Props) {
  // The parent mounts this dialog fresh for every cost, so the draft starts from the cost being edited.
  const [draft, setDraft] = useState<CostDraft>(initial)

  const currency = currencies.find(item => String(item.currencyId) === draft.currencyId)
  const treasury = treasuries.find(item => String(item.treasuryId) === draft.payeeTreasuryId)
  const rate = currency?.isPrimary ? 1 : toNumber(draft.exchangeRate)
  const base = toNumber(draft.amount) * rate
  const missingPayee = (draft.payeeType === 'PARTNER' && !draft.payeePartnerId) || (draft.payeeType === 'TREASURY' && !draft.payeeTreasuryId) || (draft.payeeType === 'ACCOUNT' && !draft.payeeAccountCode)
  const invalid = !draft.costType || toNumber(draft.amount) <= 0 || !draft.currencyId || rate <= 0 || missingPayee

  function chooseCurrency(value: string) {
    const selected = currencies.find(item => String(item.currencyId) === value)
    setDraft(current => ({ ...current, currencyId: value, exchangeRate: selected?.isPrimary ? '1' : String(selected?.exchangeRate ?? '') }))
  }

  // A till pays in its own currency, so choosing one sets the cost's currency.
  function chooseTreasury(value: string) {
    const selected = treasuries.find(item => String(item.treasuryId) === value)
    const selectedCurrency = currencies.find(item => item.currencyId === selected?.currencyId)
    setDraft(current => ({ ...current, payeeTreasuryId: value, ...(selectedCurrency ? { currencyId: String(selectedCurrency.currencyId), exchangeRate: selectedCurrency.isPrimary ? '1' : String(selectedCurrency.exchangeRate ?? '') } : {}) }))
  }

  return (
    <Modal
      open={open}
      title={editing ? (ar ? 'تعديل التكلفة' : 'Edit cost') : (ar ? 'إضافة تكلفة استيراد' : 'Add import cost')}
      titleIcon="coins"
      description={ar ? 'تضاف التكلفة إلى سعر البضاعة عند الاستلام.' : 'The cost is added to the goods when the shipment is received.'}
      closeLabel={ar ? 'إغلاق' : 'Close'}
      busy={saving}
      onClose={onClose}
      footer={<><Button variant="ghost" disabled={saving} onClick={onClose}>{ar ? 'إلغاء' : 'Cancel'}</Button><Button variant="primary" loading={saving} disabled={invalid} onClick={() => onSave(draft)}>{ar ? 'حفظ التكلفة' : 'Save cost'}</Button></>}
    >
      <div className="import-form">
        {error && <div className="form-error" role="alert">{error}</div>}
        <FormField label={ar ? 'نوع التكلفة' : 'Cost type'} required>
          <Select value={draft.costType} onChange={event => setDraft(current => ({ ...current, costType: event.target.value }))}>
            <option value="">{ar ? 'اختر النوع' : 'Choose type'}</option>
            {costTypes.map(([value, en, arabic]) => <option key={value} value={value}>{ar ? arabic : en}</option>)}
          </Select>
        </FormField>

        <fieldset className="import-payee">
          <legend>{ar ? 'من يستلم المبلغ؟' : 'Who is paid?'}</legend>
          <div className="import-payee-options">
            {payeeOptions.map(([value, en, arabic, hintEn, hintAr]) => (
              <label key={value} className={draft.payeeType === value ? 'is-selected' : ''}>
                <input type="radio" name="payee" value={value} checked={draft.payeeType === value} onChange={() => setDraft(current => ({ ...current, payeeType: value }))} />
                <strong>{ar ? arabic : en}</strong>
                <small>{ar ? hintAr : hintEn}</small>
              </label>
            ))}
          </div>
          {draft.payeeType === 'PARTNER' && (
            <FormField label={ar ? 'الشريك' : 'Partner'} required>
              <Select value={draft.payeePartnerId} onChange={event => setDraft(current => ({ ...current, payeePartnerId: event.target.value }))}>
                <option value="">{ar ? 'اختر الشريك' : 'Choose partner'}</option>
                {partners.map(partner => <option key={partner.partnerId} value={partner.partnerId}>{partner.partnerName}</option>)}
              </Select>
            </FormField>
          )}
          {draft.payeeType === 'TREASURY' && (
            <FormField label={ar ? 'الخزنة' : 'Treasury'} required hint={ar ? 'يرفض الدفع إذا لم يكف رصيد الخزنة.' : "Refused if the till's balance does not cover it."}>
              <Select value={draft.payeeTreasuryId} onChange={event => chooseTreasury(event.target.value)}>
                <option value="">{ar ? 'اختر الخزنة' : 'Choose treasury'}</option>
                {treasuries.map(item => <option key={item.treasuryId} value={item.treasuryId}>{ar ? item.nameAr : item.nameEn} · {item.currencySymbol}</option>)}
              </Select>
            </FormField>
          )}
          {draft.payeeType === 'TREASURY' && (
            <FormField label={ar ? 'المستلم' : 'Paid to'} hint={ar ? 'اسم من استلم المبلغ إن لم يكن له حساب.' : 'Name of whoever took the money, if they have no account.'}>
              <TextInput maxLength={150} value={draft.paidTo} placeholder={ar ? 'مثال: سائق النقل' : 'e.g. the truck driver'} onChange={event => setDraft(current => ({ ...current, paidTo: event.target.value }))} />
            </FormField>
          )}
          {draft.payeeType === 'ACCOUNT' && (
            <FormField label={ar ? 'الحساب الدائن' : 'Payable account'} required>
              <Select value={draft.payeeAccountCode} onChange={event => setDraft(current => ({ ...current, payeeAccountCode: event.target.value }))}>
                <option value="">{ar ? 'اختر الحساب' : 'Choose account'}</option>
                {accounts.map(account => <option key={account.accountCode} value={account.accountCode}>{account.accountCode} · {ar ? account.nameAr : account.nameEn}</option>)}
              </Select>
            </FormField>
          )}
        </fieldset>

        <div className="import-form-row">
          <FormField label={ar ? 'المبلغ' : 'Amount'} required>
            <NumberInput min="0" value={draft.amount} onChange={event => setDraft(current => ({ ...current, amount: event.target.value }))} />
          </FormField>
          <FormField label={ar ? 'العملة' : 'Currency'} required>
            <Select value={draft.currencyId} disabled={draft.payeeType === 'TREASURY' && Boolean(treasury)} onChange={event => chooseCurrency(event.target.value)}>
              {currencies.map(item => <option key={item.currencyId} value={item.currencyId}>{item.symbol} · {ar ? item.currencyNameAr : item.currencyNameEn}</option>)}
            </Select>
          </FormField>
        </div>
        <div className="import-form-row">
          <FormField label={ar ? 'سعر الصرف' : 'Exchange rate'} hint={currency && !currency.isPrimary ? `1 ${currency.symbol} = ${draft.exchangeRate || '?'} ${baseSymbol}` : undefined}>
            <NumberInput min="0" value={currency?.isPrimary ? '1' : draft.exchangeRate} disabled={currency?.isPrimary} onChange={event => setDraft(current => ({ ...current, exchangeRate: event.target.value }))} />
          </FormField>
          <FormField label={ar ? 'بالعملة الأساسية' : 'In main currency'}>
            <div className="text-input import-readonly">{formatMoney(base, baseSymbol)}</div>
          </FormField>
        </div>
        <FormField label={ar ? 'ملاحظات' : 'Notes'}>
          <TextInput maxLength={250} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder={ar ? 'رقم الإيصال أو اسم المستلم' : 'Receipt number or who was paid'} />
        </FormField>
      </div>
    </Modal>
  )
}
