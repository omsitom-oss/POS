import { useEffect, useState } from 'react'
import { ErrorState, FilterChips, Money, StatusBadge } from '../../components/shared'
import { DataTable, type TableColumn } from '../../components/DataTable'
import { formatNumber } from '../../app/formatters'
import { PageHeader, type Locale } from '../../layouts/AppLayout'

type Partner = { partnerId: number; partnerCode: string; partnerName: string; status: string }
type Treasury = { treasuryId: number; treasuryCode: string; nameAr: string; nameEn: string; treasureType: string; currencyId: number; currencySymbol: string; currencyCode: string; isActive: boolean }
type Currency = { currencyId: number; currencyCode: string; currencyNameEn: string; currencyNameAr: string; symbol: string; flagBase64: string | null }
type PartnerBalance = { amount: number; currencyId: number; currencyCode: string; currencySymbol: string; currencyNameEn: string; currencyNameAr: string; flagBase64: string | null }
type PartnerAccountRow = PartnerBalance & { partnerId: number; partnerCode: string; partnerName: string }
type TreasuryAccountRow = Treasury & { amount: number; currencyNameEn: string; currencyNameAr: string; flagBase64: string | null }
type ChartAccount = { accountId: number; branchId: number; accountCode: string; nameAr: string; nameEn: string; accountType: string; balance: number; isSystem: boolean; isActive: boolean }


async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<T>
}

export function AccountsPage({ locale }: { locale: Locale }) {
  const ar = locale === 'ar'
  const [tab, setTab] = useState<'treasuries' | 'partners' | 'chart'>('chart')
  const [partners, setPartners] = useState<PartnerAccountRow[]>([])
  const [treasuries, setTreasuries] = useState<TreasuryAccountRow[]>([])
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true); setError('')
      try {
        const [partnerOptions, treasuryOptions, currencyOptions, chart] = await Promise.all([
          getJson<Partner[]>('/api/partners/options'),
          getJson<Treasury[]>('/api/treasuries'),
          getJson<Currency[]>('/api/currencies'),
          getJson<ChartAccount[]>('/api/accounts/chart'),
        ])
        const currencyById = new Map(currencyOptions.map(item => [item.currencyId, item]))
        const partnerRows = (await Promise.all(partnerOptions.map(async partner => {
          const balances = await getJson<PartnerBalance[]>(`/api/transactions/partner/${partner.partnerId}/balances`)
          return balances.map(balance => ({ ...balance, partnerId: partner.partnerId, partnerCode: partner.partnerCode, partnerName: partner.partnerName }))
        }))).flat()
        const treasuryRows = await Promise.all(treasuryOptions.filter(item => item.isActive).map(async treasury => {
          const statement = await getJson<{ rows: Array<{ debit: number; credit: number; foreignDebit: number; foreignCredit: number }> }>(`/api/transactions/treasury/${treasury.treasuryId}`)
          const amount = statement.rows.reduce((total, row) => total + row.foreignDebit - row.foreignCredit, 0)
          const currency = currencyById.get(treasury.currencyId)
          return { ...treasury, amount, currencyNameEn: currency?.currencyNameEn ?? treasury.currencyCode, currencyNameAr: currency?.currencyNameAr ?? treasury.currencyCode, flagBase64: currency?.flagBase64 ?? null }
        }))
        if (active) { setPartners(partnerRows); setTreasuries(treasuryRows); setChartAccounts(chart) }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : (ar ? 'تعذر تحميل الحسابات.' : 'Could not load accounts.')) }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [ar])

  const balanceTone = (amount: number) => amount < 0 ? 'success' : amount > 0 ? 'danger' : 'neutral'
  const balanceLabel = (amount: number) => amount < 0 ? (ar ? 'دائن' : 'Credit') : amount > 0 ? (ar ? 'مدين' : 'Debit') : (ar ? 'متوازن' : 'Balanced')
  const balanceBadge = (amount: number) => <StatusBadge tone={balanceTone(amount)}>{balanceLabel(amount)}</StatusBadge>
  const accountTypes: Record<string, string> = { ASSET: ar ? 'أصل' : 'Asset', LIABILITY: ar ? 'التزام' : 'Liability', EQUITY: ar ? 'حقوق ملكية' : 'Equity', REVENUE: ar ? 'إيراد' : 'Revenue', EXPENSE: ar ? 'مصروف' : 'Expense' }
  const currencyCell = (row: { flagBase64: string | null; currencyNameAr: string; currencyNameEn: string; currencySymbol: string }) => <>{row.flagBase64 && <img className="accounts-currency-flag" src={row.flagBase64} alt="" />} {ar ? row.currencyNameAr : row.currencyNameEn} <span className="muted-cell">{row.currencySymbol}</span></>
  const common = { locale, loading, density: 'compact' as const, pageSize: 15, searchLabel: ar ? 'بحث في الحسابات' : 'Search accounts', searchPlaceholder: ar ? 'ابحث بالاسم أو الرمز أو العملة' : 'Search by name, code or currency' }
  const tabFilter = <FilterChips label={ar ? 'نوع الحسابات' : 'Account kind'} value={tab} onChange={setTab} options={[
    { value: 'chart', label: ar ? 'دليل الحسابات' : 'Chart of accounts', count: chartAccounts.length },
    { value: 'treasuries', label: ar ? 'الخزن' : 'Treasuries', count: treasuries.length },
    { value: 'partners', label: ar ? 'الشركاء' : 'Partners', count: partners.length },
  ]} />
  const chartColumns: Array<TableColumn<ChartAccount>> = [
    { key: 'accountCode', title: ar ? 'رمز الحساب' : 'Account code', value: row => row.accountCode, render: row => <span className="doc-no">{row.accountCode}</span> },
    { key: 'name', title: ar ? 'الحساب' : 'Account', value: row => ar ? row.nameAr : row.nameEn, searchValue: row => `${row.nameAr} ${row.nameEn}`, wrap: true, render: row => <strong className="cell-title">{ar ? row.nameAr : row.nameEn}</strong> },
    { key: 'accountType', title: ar ? 'التصنيف' : 'Type', value: row => accountTypes[row.accountType] ?? row.accountType },
    { key: 'balance', title: ar ? 'الرصيد' : 'Balance', value: row => row.balance, align: 'end', searchable: false, render: row => <Money value={Math.abs(row.balance)} /> },
    { key: 'status', title: ar ? 'الحالة' : 'Status', value: row => row.balance, searchable: false, render: row => balanceBadge(row.balance) },
  ]
  const treasuryColumns: Array<TableColumn<TreasuryAccountRow>> = [
    { key: 'name', title: ar ? 'الخزينة' : 'Treasury', value: row => ar ? row.nameAr : row.nameEn, searchValue: row => `${row.nameAr} ${row.nameEn} ${row.treasuryCode}`, wrap: true, render: row => <><strong className="cell-title">{ar ? row.nameAr : row.nameEn}</strong> <span className="muted-cell doc-no">{row.treasuryCode}</span></> },
    { key: 'type', title: ar ? 'النوع' : 'Type', value: row => row.treasureType, searchable: false, render: row => row.treasureType === 'BANK' ? (ar ? 'بنكي' : 'Bank') : (ar ? 'نقدي' : 'Cash') },
    { key: 'currency', title: ar ? 'العملة' : 'Currency', value: row => row.currencyCode, searchValue: row => `${row.currencyCode} ${row.currencyNameEn} ${row.currencyNameAr}`, render: currencyCell },
    { key: 'balance', title: ar ? 'الرصيد' : 'Balance', value: row => row.amount, align: 'end', searchable: false, render: row => <Money value={Math.abs(row.amount)} symbol={row.currencySymbol} /> },
    { key: 'status', title: ar ? 'الحالة' : 'Status', value: row => row.amount, searchable: false, render: row => balanceBadge(row.amount) },
  ]
  const partnerColumns: Array<TableColumn<PartnerAccountRow>> = [
    { key: 'partnerName', title: ar ? 'الشريك' : 'Partner', value: row => row.partnerName, wrap: true, render: row => <strong className="cell-title">{row.partnerName}</strong> },
    { key: 'partnerCode', title: ar ? 'الرمز' : 'Code', value: row => row.partnerCode, render: row => <span className="doc-no">{row.partnerCode}</span> },
    { key: 'currency', title: ar ? 'العملة' : 'Currency', value: row => row.currencyCode, searchValue: row => `${row.currencyCode} ${row.currencyNameEn} ${row.currencyNameAr}`, render: currencyCell },
    { key: 'balance', title: ar ? 'الرصيد' : 'Balance', value: row => row.amount, align: 'end', searchable: false, render: row => <Money value={Math.abs(row.amount)} symbol={row.currencySymbol} /> },
    { key: 'status', title: ar ? 'الحالة' : 'Status', value: row => row.amount, searchable: false, render: row => balanceBadge(row.amount) },
  ]
  return <div className="accounts-page" dir={ar ? 'rtl' : 'ltr'}>
    <PageHeader title={ar ? 'الحسابات' : 'Accounts'} description={ar ? 'عرض أرصدة الخزن وحسابات الشركاء حسب العملة.' : 'Review treasury and partner account balances by currency.'} />
    {error ? <ErrorState title={ar ? 'تعذر تحميل الحسابات' : 'Could not load accounts'} detail={error} />
      : tab === 'chart' ? <DataTable key="chart" {...common} columns={chartColumns} rows={chartAccounts} rowKey={row => row.accountId} filters={tabFilter}
          totals={list => [{ key: 'count', label: ar ? 'الحسابات' : 'Accounts', value: formatNumber(list.length, 'en', 0) }, { key: 'debit', label: ar ? 'مجموع المدين' : 'Total debit', value: <Money value={list.reduce((sum, row) => sum + Math.max(row.balance, 0), 0)} /> }, { key: 'credit', label: ar ? 'مجموع الدائن' : 'Total credit', value: <Money value={list.reduce((sum, row) => sum + Math.max(-row.balance, 0), 0)} /> }]} />
      : tab === 'partners' ? <DataTable key="partners" {...common} columns={partnerColumns} rows={partners} rowKey={row => `${row.partnerId}-${row.currencyId}`} filters={tabFilter} />
      : <DataTable key="treasuries" {...common} columns={treasuryColumns} rows={treasuries} rowKey={row => row.treasuryId} filters={tabFilter} />}
  </div>
}
