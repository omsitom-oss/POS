import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDate, formatNumber } from './formatters'

describe('formatters', () => {
  it('formats AED currency with two decimals in English', () => {
    const text = formatCurrency(1234.5, 'en')
    expect(text).toContain('AED')
    expect(text).toContain('1,234.50')
  })

  it('uses the Arabic dirham symbol in Arabic', () => {
    expect(formatCurrency(10, 'ar')).toContain('د.إ')
  })

  it('caps fraction digits on numbers', () => {
    expect(formatNumber(1.23456, 'en')).toBe('1.23')
    expect(formatNumber(1.23456, 'en', 0)).toBe('1')
  })

  it('formats an ISO date string by calendar day regardless of time zone', () => {
    expect(formatDate('2026-03-05T23:59:59Z', 'en')).toMatch(/05.*Mar.*2026|Mar.*05.*2026/)
  })
})
