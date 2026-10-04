export type AppLocale = 'en' | 'ar'

export function formatCurrency(value: number, locale: AppLocale) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number, locale: AppLocale, maximumFractionDigits = 2) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', { maximumFractionDigits }).format(value)
}

export function formatDate(value: string | Date, locale: AppLocale) {
  const date = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T12:00:00`) : value
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', { year: 'numeric', month: 'short', day: '2-digit' }).format(date)
}

// The shop's calendar date as YYYY-MM-DD. toISOString() would give the UTC date, which is still yesterday after local midnight.
export function localDate(value: Date = new Date()) {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

// Money as the shop reads it in both languages: Latin digits, two decimals, symbol after the amount.
export function formatMoney(value: number, symbol = '') {
  const amount = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return symbol ? `${amount} ${symbol}` : amount
}

// A calendar day for lists and panels, Latin digits in both languages: 04/10/2026.
export function formatDay(value: string | null | undefined) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return day && month && year ? `${day}/${month}/${year}` : value
}
