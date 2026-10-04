import { describe, expect, it } from 'vitest'
import { inDatePreset, sumBy } from './listFilters'

const today = new Date(2026, 9, 4, 23, 30)

describe('inDatePreset', () => {
  it('counts a late-evening document as today', () => {
    expect(inDatePreset('2026-10-04T23:10:00', 'today', today)).toBe(true)
    expect(inDatePreset('2026-10-03', 'today', today)).toBe(false)
  })

  it('covers the last 7 and 30 days including today', () => {
    expect(inDatePreset('2026-09-28', '7d', today)).toBe(true)
    expect(inDatePreset('2026-09-27', '7d', today)).toBe(false)
    expect(inDatePreset('2026-09-05', '30d', today)).toBe(true)
    expect(inDatePreset('2026-09-04', '30d', today)).toBe(false)
  })

  it('keeps everything on "all" and nothing without a date otherwise', () => {
    expect(inDatePreset(undefined, 'all', today)).toBe(true)
    expect(inDatePreset(undefined, 'today', today)).toBe(false)
  })
})

describe('sumBy', () => {
  it('adds values and ignores missing ones', () => {
    expect(sumBy([{ v: 2.5 }, { v: Number.NaN }, { v: 1 }], row => row.v)).toBe(3.5)
  })
})
