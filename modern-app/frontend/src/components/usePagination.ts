import { useState } from 'react'

export const pageSizeOptions = [15, 25, 50, 100]

export type Pager = {
  page: number
  pageCount: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

/** Client-side paging for list tables; pass `pager` to TableFooter and render `rows`. */
export function usePagination<T>(rows: T[], initialPageSize = pageSizeOptions[0]) {
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [requestedPage, setRequestedPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  // Clamp instead of resetting in an effect, so a shrinking list (search, filter, delete) never shows an empty page.
  const page = Math.min(requestedPage, pageCount - 1)
  const pager: Pager = {
    page,
    pageCount,
    pageSize,
    onPageChange: next => setRequestedPage(Math.max(0, Math.min(next, pageCount - 1))),
    onPageSizeChange: size => { setPageSize(size); setRequestedPage(0) },
  }
  return { rows: rows.slice(page * pageSize, (page + 1) * pageSize), pager, resetPage: () => setRequestedPage(0) }
}
