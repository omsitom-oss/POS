import { useEffect, useMemo, useState } from 'react'
import { LoadingState, ErrorState, StatusBadge, TableFooter, SearchInput } from '../../components/shared'
import { usePagination } from '../../components/usePagination'
import { PageHeader, type Locale } from '../../layouts/AppLayout'

type Partner = { partnerId: number; partnerCode: string; partnerName: string; status: string }
type Treasury = { treasuryId: number; treasuryCode: string; nameAr: string; nameEn: string; treasureType: string; currencyId: number; currencySymbol: string; currencyCode: string; isActive: boolean }
type Currency = { currencyId: number; currencyCode: string; currencyNameEn: string; currencyNameAr: string; symbol: string; flagBase64: string | null }
type PartnerBalance = { amount: number; currencyId: number; currencyCode: string; currencySymbol: string; currencyNameEn: string; currencyNameAr: string; flagBase64: string | null }
type PartnerAccountRow = PartnerBalance & { partnerId: number; partnerCode: string; partnerName: string }
type TreasuryAccountRow = Treasury & { amount: number; currencyNameEn: string; currencyNameAr: string; flagBase64: string | null }
type ChartAccount = { accountId: number; branchId: number; accountCode: string; nameAr: string; nameEn: string; accountType: string; balance: number; isSystem: boolean; isActive: boolean }

const formatAmount = (value: number) => Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
  const [search, setSearch] = useState('')
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

  const query = search.trim().toLocaleLowerCase()
  const partnerRows = useMemo(() => partners.filter(row => !query || [row.partnerName, row.partnerCode, row.currencyCode, row.currencyNameEn, row.currencyNameAr].some(value => value.toLocaleLowerCase().includes(query))), [partners, query])
  const treasuryRows = useMemo(() => treasuries.filter(row => !query || [row.nameEn, row.nameAr, row.treasuryCode, row.currencyCode].some(value => value.toLocaleLowerCase().includes(query))), [treasuries, query])
  const chartRows = useMemo(() => chartAccounts.filter(row => !query || [row.accountCode, row.nameEn, row.nameAr, row.accountType].some(value => value.toLocaleLowerCase().includes(query))), [chartAccounts, query])

  const chartRowsPage = usePagination(chartRows)
  const partnerRowsPage = usePagination(partnerRows)
  const treasuryRowsPage = usePagination(treasuryRows)
  return <div className="accounts-page" dir={ar ? 'rtl' : 'ltr'}>
    <PageHeader eyebrow={ar ? 'الحسابات' : 'ACCOUNTS'} title={ar ? 'الحسابات' : 'Accounts'} description={ar ? 'عرض أرصدة الخزن وحسابات الشركاء حسب العملة.' : 'Review treasury and partner account balances by currency.'} />
    <div className="accounts-toolbar"><div className="accounts-tabs" role="tablist"><button className={tab === 'chart' ? 'is-active' : ''} onClick={() => setTab('chart')} role="tab" aria-selected={tab === 'chart'}>{ar ? 'دليل الحسابات' : 'Chart of accounts'}</button><button className={tab === 'treasuries' ? 'is-active' : ''} onClick={() => setTab('treasuries')} role="tab" aria-selected={tab === 'treasuries'}>{ar ? 'الخزن' : 'Treasuries'}</button><button className={tab === 'partners' ? 'is-active' : ''} onClick={() => setTab('partners')} role="tab" aria-selected={tab === 'partners'}>{ar ? 'الشركاء' : 'Partners'}</button></div><SearchInput aria-label={ar ? 'بحث في الحسابات' : 'Search accounts'} placeholder={ar ? 'ابحث بالاسم أو الرمز أو العملة' : 'Search by name, code or currency'} value={search} onChange={event => setSearch(event.target.value)} /></div>
    {error ? <ErrorState title={ar ? 'تعذر تحميل الحسابات' : 'Could not load accounts'} detail={error} /> : loading ? <LoadingState label={ar ? 'جارٍ تحميل الحسابات…' : 'Loading accounts…'} /> : tab === 'chart' ? <div className="accounts-table-wrap"><table className="accounts-table"><thead><tr><th>{ar ? 'رمز الحساب' : 'Account code'}</th><th>{ar ? 'الحساب' : 'Account'}</th><th>{ar ? 'التصنيف' : 'Type'}</th><th>{ar ? 'الرصيد' : 'Balance'}</th><th>{ar ? 'الحالة' : 'Status'}</th></tr></thead><tbody>{chartRowsPage.rows.map(row => <tr key={row.accountId}><td><code>{row.accountCode}</code></td><td><strong>{ar ? row.nameAr : row.nameEn}</strong></td><td>{({ ASSET: ar ? 'أصل' : 'Asset', LIABILITY: ar ? 'التزام' : 'Liability', EQUITY: ar ? 'حقوق ملكية' : 'Equity', REVENUE: ar ? 'إيراد' : 'Revenue', EXPENSE: ar ? 'مصروف' : 'Expense' } as Record<string,string>)[row.accountType] ?? row.accountType}</td><td className={`accounts-balance ${row.balance < 0 ? 'is-credit' : row.balance > 0 ? 'is-debit' : ''}`}>{formatAmount(row.balance)}</td><td><StatusBadge tone={row.balance < 0 ? 'success' : row.balance > 0 ? 'danger' : 'neutral'}>{row.balance === 0 ? (ar ? 'متوازن' : 'Balanced') : row.balance > 0 ? (ar ? 'مدين' : 'Debit') : (ar ? 'دائن' : 'Credit')}</StatusBadge></td></tr>)}</tbody></table><TableFooter total={chartRows.length} locale={locale} pager={chartRowsPage.pager} /></div> : tab === 'partners' ? <div className="accounts-table-wrap"><table className="accounts-table"><thead><tr><th>{ar ? 'الشريك' : 'Partner'}</th><th>{ar ? 'الرمز' : 'Code'}</th><th>{ar ? 'العملة' : 'Currency'}</th><th>{ar ? 'الرصيد' : 'Balance'}</th><th>{ar ? 'الحالة' : 'Status'}</th></tr></thead><tbody>{partnerRowsPage.rows.map(row => <tr key={`${row.partnerId}-${row.currencyId}`}><td><strong>{row.partnerName}</strong></td><td><code>{row.partnerCode}</code></td><td>{row.flagBase64 && <img className="accounts-currency-flag" src={row.flagBase64} alt="" />} {ar ? row.currencyNameAr : row.currencyNameEn} <small>{row.currencySymbol}</small></td><td className={`accounts-balance ${row.amount < 0 ? 'is-credit' : row.amount > 0 ? 'is-debit' : ''}`}>{formatAmount(row.amount)} <small>{row.currencySymbol}</small></td><td><StatusBadge tone={row.amount < 0 ? 'success' : row.amount > 0 ? 'danger' : 'neutral'}>{row.amount < 0 ? (ar ? 'دائن' : 'Credit') : row.amount > 0 ? (ar ? 'مدين' : 'Debit') : (ar ? 'متوازن' : 'Balanced')}</StatusBadge></td></tr>)}</tbody></table><TableFooter total={partnerRows.length} locale={locale} pager={partnerRowsPage.pager} /></div> : <div className="accounts-table-wrap"><table className="accounts-table"><thead><tr><th>{ar ? 'الخزينة' : 'Treasury'}</th><th>{ar ? 'النوع' : 'Type'}</th><th>{ar ? 'العملة' : 'Currency'}</th><th>{ar ? 'الرصيد' : 'Balance'}</th><th>{ar ? 'الحالة' : 'Status'}</th></tr></thead><tbody>{treasuryRowsPage.rows.map(row => <tr key={row.treasuryId}><td><strong>{ar ? row.nameAr : row.nameEn}</strong><small className="accounts-code">{row.treasuryCode}</small></td><td>{row.treasureType === 'BANK' ? (ar ? 'بنكي' : 'Bank') : (ar ? 'نقدي' : 'Cash')}</td><td>{row.flagBase64 && <img className="accounts-currency-flag" src={row.flagBase64} alt="" />} {ar ? row.currencyNameAr : row.currencyNameEn} <small>{row.currencySymbol}</small></td><td className={`accounts-balance ${row.amount < 0 ? 'is-credit' : row.amount > 0 ? 'is-debit' : ''}`}>{formatAmount(row.amount)} <small>{row.currencySymbol}</small></td><td><StatusBadge tone={row.amount < 0 ? 'success' : row.amount > 0 ? 'danger' : 'neutral'}>{row.amount < 0 ? (ar ? 'دائن' : 'Credit') : row.amount > 0 ? (ar ? 'مدين' : 'Debit') : (ar ? 'متوازن' : 'Balanced')}</StatusBadge></td></tr>)}</tbody></table><TableFooter total={treasuryRows.length} locale={locale} pager={treasuryRowsPage.pager} /></div>}
  </div>
}
