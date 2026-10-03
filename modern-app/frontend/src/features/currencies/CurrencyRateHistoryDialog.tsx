import { useEffect, useState } from 'react'
import { Button, EmptyState, ErrorState, LoadingState, Modal, TableFooter } from '../../components/shared'
import type { Locale } from '../../layouts/AppLayout'

type Currency = { currencyId: number; currencyCode: string; currencyNameEn: string; currencyNameAr: string; symbol: string; isPrimary: boolean; isActive: boolean; exchangeRate: number | null; flagBase64: string | null }
type HistoryEntry = { currencyRateId: number; currencyId: number; baseCurrencyId: number; rate: number; recordedAt: string }

export function CurrencyRateHistoryDialog({ open, locale, currency, baseSymbol, onClose }: { open: boolean; locale: Locale; currency: Currency | null; baseSymbol: string; onClose: () => void }) {
  const ar = locale === 'ar'; const [rows, setRows] = useState<HistoryEntry[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [fromDate, setFromDate] = useState(''); const [toDate, setToDate] = useState('')
  async function loadHistory(from = fromDate, to = toDate) {
    if (!currency) return
    setLoading(true); setError('')
    try {
      const query = new URLSearchParams(); if (from) query.set('from', from); if (to) query.set('to', to)
      const suffix = query.toString() ? `?${query.toString()}` : ''
      const response = await fetch(`/api/currencies/${currency.currencyId}/rates/history${suffix}`)
      if (!response.ok) throw new Error(await response.text() || `Request failed (${response.status})`)
      setRows(await response.json() as HistoryEntry[])
    } catch (reason) { setError(reason instanceof Error ? reason.message : (ar ? 'تعذر تحميل سجل الأسعار.' : 'Could not load rate history.')) } finally { setLoading(false) }
  }
  useEffect(() => { if (!open) return; setFromDate(''); setToDate(''); void loadHistory('', '') }, [open, currency])
  const name = currency ? (ar ? currency.currencyNameAr : currency.currencyNameEn) : ''
  return <Modal open={open} title={ar ? `سجل أسعار ${name}` : `${name} rate history`} description={ar ? `كل التغييرات المسجلة مقابل ${baseSymbol}.` : `Recorded changes relative to ${baseSymbol}.`} closeLabel={ar ? 'إغلاق' : 'Close'} onClose={onClose}>
    <div className="currency-history-filters"><label><span>{ar ? 'من تاريخ' : 'From date'}</span><input className="text-input" type="date" value={fromDate} max={toDate || undefined} onChange={event => setFromDate(event.target.value)} /></label><label><span>{ar ? 'إلى تاريخ' : 'To date'}</span><input className="text-input" type="date" value={toDate} min={fromDate || undefined} onChange={event => setToDate(event.target.value)} /></label><Button variant="secondary" onClick={() => void loadHistory()}>{ar ? 'تطبيق' : 'Apply'}</Button></div>
    {error && <ErrorState title={ar ? 'تعذر تحميل السجل' : 'Could not load history'} detail={error} />}
    {loading ? <LoadingState /> : rows.length === 0 ? <EmptyState title={ar ? 'لا يوجد سجل أسعار' : 'No rate history'} detail={ar ? 'سيظهر السجل بعد حفظ سعر صرف.' : 'History appears after an exchange rate is saved.'} /> : <div className="currency-history-table-wrap"><table className="currency-table currency-history-table"><thead><tr><th>{ar ? 'السعر' : 'Rate'}</th><th>{ar ? 'التاريخ' : 'Recorded'}</th></tr></thead><tbody>{rows.map(row => <tr key={row.currencyRateId}><td dir="ltr">1 {currency?.symbol} = {row.rate} {baseSymbol}</td><td dir="ltr">{new Date(row.recordedAt).toLocaleString(ar ? 'ar' : 'en')}</td></tr>)}</tbody></table><TableFooter total={rows.length} locale={locale} /></div>}
  </Modal>
}
