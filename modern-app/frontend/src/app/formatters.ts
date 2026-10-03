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
