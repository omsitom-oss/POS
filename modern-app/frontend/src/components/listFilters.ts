import { localDate } from '../app/formatters'

export type DatePreset = 'today' | '7d' | '30d' | 'all'

export function datePresetOptions(ar: boolean): Array<{ value: DatePreset; label: string }> {
  return [
    { value: 'today', label: ar ? 'اليوم' : 'Today' },
    { value: '7d', label: ar ? '7 أيام' : '7 days' },
    { value: '30d', label: ar ? '30 يومًا' : '30 days' },
    { value: 'all', label: ar ? 'الكل' : 'All' },
  ]
}

// Compares shop calendar dates (YYYY-MM-DD) so a late-evening document still counts as today.
export function inDatePreset(value: string | null | undefined, preset: DatePreset, today: Date = new Date()) {
  if (preset === 'all') return true
  if (!value) return false
  const day = value.slice(0, 10)
  const days = preset === 'today' ? 0 : preset === '7d' ? 6 : 29
  const start = new Date(today)
  start.setDate(start.getDate() - days)
  return day >= localDate(start) && day <= localDate(today)
}

export function sumBy<T>(rows: T[], value: (row: T) => number) {
  return rows.reduce((sum, row) => sum + (value(row) || 0), 0)
}
