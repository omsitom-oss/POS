import { useCallback, useState } from 'react'
import { Button, DateInput, ErrorState, FilterChips, FormField, Modal, Money, Select, TextInput } from '../../components/shared'
import { DataTable, type TableColumn } from '../../components/DataTable'
import { datePresetOptions, inDatePreset, sumBy, type DatePreset } from '../../components/listFilters'
import { useLoadEffect } from '../../components/useLoadEffect'
import { Icon } from '../../components/icons'
import { PageHeader, type Locale } from '../../layouts/AppLayout'
import { formatDay, localDate } from '../../app/formatters'

type Expense = { moveNo: number; expenseNo: string; expenseDate: string; expenseAccountId: string; expenseNameEn: string; expenseNameAr: string; treasuryId: number; treasuryName: string; currencyId: number; currencyCode: string; currencySymbol: string; amount: number; description: string | null }
type Treasury = { treasuryId: number; nameAr: string; nameEn: string; currencyId: number; currencySymbol: string; isActive: boolean }
type Account = { accountId: number; accountCode: string; nameAr: string; nameEn: string; accountType: string; isActive: boolean }
const today = () => localDate()

export function ExpensesPage({ locale }: { locale: Locale }) {
  const ar = locale === 'ar'; const [rows, setRows] = useState<Expense[]>([]); const [treasuries, setTreasuries] = useState<Treasury[]>([]); const [accounts, setAccounts] = useState<Account[]>([]); const [period, setPeriod] = useState<DatePreset>('all'); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [modal, setModal] = useState(false); const [error, setError] = useState('')
  const [draft, setDraft] = useState({ expenseAccountId: '', treasuryId: '', amount: '', expenseDate: today(), description: '' })
  const load = useCallback(async () => { setLoading(true); setError(''); try { const [expenseResponse, treasuryResponse, accountResponse] = await Promise.all([fetch('/api/expenses'), fetch('/api/treasuries'), fetch('/api/accounts/chart')]); if (!expenseResponse.ok || !treasuryResponse.ok || !accountResponse.ok) throw new Error(ar ? 'تعذر تحميل بيانات المنصرفات.' : 'Could not load expense data.'); setRows(await expenseResponse.json()); setTreasuries(await treasuryResponse.json()); setAccounts(await accountResponse.json()) } catch (reason) { setError(reason instanceof Error ? reason.message : (ar ? 'تعذر تنفيذ العملية.' : 'Request failed.')) } finally { setLoading(false) } }, [ar])
  useLoadEffect(load)
  const expenseAccounts = accounts.filter(item => item.accountType === 'EXPENSE' && item.isActive)
  const visible = rows.filter(item => inDatePreset(item.expenseDate, period))
  function open() { const treasury = treasuries.find(item => item.isActive); setDraft({ expenseAccountId: expenseAccounts[0]?.accountCode ?? '', treasuryId: treasury?.treasuryId.toString() ?? '', amount: '', expenseDate: today(), description: '' }); setError(''); setModal(true) }
  async function save() { if (!draft.expenseAccountId || !draft.treasuryId || Number(draft.amount) <= 0) { setError(ar ? 'اختر حساب المصروف والخزينة وأدخل مبلغاً صحيحاً.' : 'Choose an expense account and treasury and enter a valid amount.'); return } setSaving(true); setError(''); try { const response = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expenseAccountId: draft.expenseAccountId, treasuryId: Number(draft.treasuryId), amount: Number(draft.amount), expenseDate: draft.expenseDate, description: draft.description.trim() || null }) }); if (!response.ok) throw new Error(await response.text()); setModal(false); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : (ar ? 'تعذر حفظ المنصرف.' : 'Could not save expense.')) } finally { setSaving(false) } }
  const columns: Array<TableColumn<Expense>> = [
    { key: 'expenseNo', title: ar ? 'رقم المنصرف' : 'Expense no.', value: item => item.expenseNo, render: item => <span className="doc-no">{item.expenseNo}</span> },
    { key: 'expenseDate', title: ar ? 'التاريخ' : 'Date', value: item => item.expenseDate, searchable: false, render: item => formatDay(item.expenseDate) },
    { key: 'account', title: ar ? 'حساب المصروف' : 'Expense account', value: item => ar ? item.expenseNameAr : item.expenseNameEn, searchValue: item => `${item.expenseAccountId} ${item.expenseNameAr} ${item.expenseNameEn}`, wrap: true, render: item => <>{ar ? item.expenseNameAr : item.expenseNameEn} <span className="muted-cell doc-no">{item.expenseAccountId}</span></> },
    { key: 'treasuryName', title: ar ? 'الخزينة' : 'Treasury', value: item => item.treasuryName },
    { key: 'description', title: ar ? 'البيان' : 'Description', value: item => item.description ?? '', wrap: true, render: item => item.description ?? <span className="muted-cell">—</span> },
    { key: 'amount', title: ar ? 'المبلغ' : 'Amount', value: item => item.amount, align: 'end', searchable: false, render: item => <Money value={item.amount} symbol={item.currencySymbol} /> },
  ]
  return <div className="receipts-page expenses-page" dir={ar ? 'rtl' : 'ltr'}><PageHeader title={ar ? 'المنصرفات' : 'Expenses'} description={ar ? 'تسجيل ومراجعة المبالغ المصروفة من الخزائن.' : 'Record and review amounts paid from treasuries.'} actions={<Button variant="primary" onClick={open}><Icon name="plus" size={18} />{ar ? 'إضافة منصرف' : 'Add expense'}</Button>} />{error && !modal && <ErrorState title={ar ? 'تعذر تنفيذ العملية' : 'Request failed'} detail={error} />}
    <DataTable
      locale={locale}
      columns={columns}
      rows={visible}
      rowKey={item => item.moveNo}
      loading={loading}
      density="compact"
      pageSize={15}
      searchLabel={ar ? 'بحث في المنصرفات' : 'Search expenses'}
      searchPlaceholder={ar ? 'ابحث برقم المنصرف أو الحساب أو البيان' : 'Search expense, account or description'}
      filters={<FilterChips label={ar ? 'الفترة' : 'Period'} options={datePresetOptions(ar)} value={period} onChange={setPeriod} />}
      totals={list => [
        { key: 'count', label: ar ? 'المنصرفات' : 'Expenses', value: list.length },
        { key: 'total', label: ar ? 'الإجمالي' : 'Total', value: <Money value={sumBy(list, item => item.amount)} symbol={list[0]?.currencySymbol} /> },
      ]}
      emptyTitle={rows.length ? (ar ? 'لا توجد نتائج' : 'No results') : (ar ? 'لا توجد منصرفات' : 'No expenses yet')}
      emptyDetail={rows.length ? undefined : (ar ? 'أضف أول منصرف للبدء.' : 'Add an expense to begin.')}
    />
    <Modal open={modal} title={ar ? 'إضافة منصرف' : 'Add expense'} titleIcon="currency" description={ar ? 'يتم تسجيل قيد مدين على حساب المصروف ودائن على الخزينة.' : 'This records a debit to the expense account and a credit to the treasury.'} closeLabel={ar ? 'إغلاق' : 'Close'} busy={saving} onClose={() => !saving && setModal(false)} footer={<><Button variant="ghost" disabled={saving} onClick={() => setModal(false)}>{ar ? 'إلغاء' : 'Cancel'}</Button><Button variant="primary" loading={saving} onClick={() => void save()}>{ar ? 'حفظ المنصرف' : 'Save expense'}</Button></>}><div className="receipt-form"><div className="receipt-form-grid"><FormField label={ar ? 'التاريخ' : 'Date'} required><DateInput value={draft.expenseDate} onChange={event => setDraft({ ...draft, expenseDate: event.target.value })} /></FormField><FormField label={ar ? 'حساب المصروف' : 'Expense account'} required><Select value={draft.expenseAccountId} onChange={event => setDraft({ ...draft, expenseAccountId: event.target.value })}><option value="">{ar ? 'اختر حساب المصروف' : 'Choose expense account'}</option>{expenseAccounts.map(item => <option key={item.accountCode} value={item.accountCode}>{item.accountCode} — {ar ? item.nameAr : item.nameEn}</option>)}</Select></FormField><FormField label={ar ? 'الخزينة' : 'Treasury'} required><Select value={draft.treasuryId} onChange={event => setDraft({ ...draft, treasuryId: event.target.value })}><option value="">{ar ? 'اختر الخزينة' : 'Choose treasury'}</option>{treasuries.filter(item => item.isActive).map(item => <option key={item.treasuryId} value={item.treasuryId}>{ar ? item.nameAr : item.nameEn} · {item.currencySymbol}</option>)}</Select></FormField><FormField label={ar ? 'المبلغ' : 'Amount'} required><TextInput dir="ltr" type="number" min="0.01" step="0.01" value={draft.amount} onChange={event => setDraft({ ...draft, amount: event.target.value })} placeholder="0.00" /></FormField><FormField label={ar ? 'البيان' : 'Description'}><textarea className="text-input receipt-description" value={draft.description} maxLength={250} onChange={event => setDraft({ ...draft, description: event.target.value })} rows={3} /></FormField></div>{error && <div className="receipt-form-error" role="alert">{error}</div>}<p className="receipt-account-note"><Icon name="info" size={16} />{ar ? 'لن يتم استخدام شريك في المنصرف؛ سيتم ترحيله مباشرة بين حساب المصروف والخزينة.' : 'Expenses do not use a partner; they post directly between the expense account and treasury.'}</p></div></Modal>
  </div>
}
