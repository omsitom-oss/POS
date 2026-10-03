import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePagination } from './usePagination'

const numbers = (count: number) => Array.from({ length: count }, (_, index) => index + 1)

describe('usePagination', () => {
  it('slices rows by page and page size', () => {
    const { result } = renderHook(() => usePagination(numbers(40)))
    expect(result.current.rows).toEqual(numbers(15))
    expect(result.current.pager.pageCount).toBe(3)
    act(() => result.current.pager.onPageChange(2))
    expect(result.current.rows).toEqual(numbers(40).slice(30))
    act(() => result.current.pager.onPageSizeChange(25))
    expect(result.current.pager.page).toBe(0)
    expect(result.current.rows).toHaveLength(25)
  })

  it('stays on the last page that still has rows when the list shrinks', () => {
    const { result, rerender } = renderHook(({ rows }) => usePagination(rows), { initialProps: { rows: numbers(40) } })
    act(() => result.current.pager.onPageChange(2))
    rerender({ rows: numbers(20) })
    expect(result.current.pager.page).toBe(1)
    expect(result.current.rows).toEqual([16, 17, 18, 19, 20])
  })

  it('ignores page requests outside the range', () => {
    const { result } = renderHook(() => usePagination(numbers(10)))
    act(() => result.current.pager.onPageChange(5))
    expect(result.current.pager.page).toBe(0)
    act(() => result.current.pager.onPageChange(-1))
    expect(result.current.pager.page).toBe(0)
  })
})
