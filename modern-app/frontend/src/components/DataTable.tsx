import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button, EmptyState, LoadingState, SearchInput, Select } from './shared'

export type TableColumn<T> = {
  key: string
  title: string
  value: (row: T) => unknown
  searchValue?: (row: T) => unknown
  render?: (row: T) => ReactNode
  align?: 'start' | 'center' | 'end'
  sortable?: boolean
  searchable?: boolean
  width?: string
}

export type DataTableLabels = {
  rows: string
  actions: string
  selectVisibleRows: string
  selectRow: (key: string | number) => string
  previous: string
  next: string
  showing: string
  of: string
}

const defaultLabels: DataTableLabels = {
  rows: 'rows',
  actions: 'Actions',
  selectVisibleRows: 'Select visible rows',
  selectRow: key => `Select row ${key}`,
  previous: 'Previous',
  next: 'Next',
  showing: 'Showing',
  of: 'of',
}

export type DataTableProps<T> = {
  columns: Array<TableColumn<T>>
  rows: T[]
  rowKey: (row: T) => string | number
  searchPlaceholder?: string
  searchLabel?: string
  toolbarEnd?: ReactNode
  selectable?: boolean
  selectedKeys?: Array<string | number>
  onSelectionChange?: (keys: Array<string | number>) => void
  rowActions?: (row: T) => ReactNode
  onRowActivate?: (row: T) => void
  loading?: boolean
  emptyTitle?: string
  emptyDetail?: string
  pageSize?: number
  density?: 'compact' | 'comfortable'
  dir?: 'ltr' | 'rtl'
  labels?: Partial<DataTableLabels>
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchPlaceholder = 'Search rows',
  searchLabel = 'Search table rows',
  toolbarEnd,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  rowActions,
  onRowActivate,
  loading = false,
  emptyTitle = 'No results found',
  emptyDetail = 'Try changing the search or filters.',
  pageSize = 5,
  density = 'comfortable',
  dir = 'ltr',
  labels: labelOverrides,
}: DataTableProps<T>) {
  const labels = { ...defaultLabels, ...labelOverrides }
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(pageSize)
  const [activeRow, setActiveRow] = useState(0)

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const filtered = rows.filter(row => !normalizedQuery || columns.some(column => {
      if (column.searchable === false) return false
      return String(column.searchValue?.(row) ?? column.value(row) ?? '').toLocaleLowerCase().includes(normalizedQuery)
    }))

    if (!sortKey) return filtered
    const column = columns.find(item => item.key === sortKey)
    if (!column) return filtered
    return [...filtered].sort((left, right) => {
      const a = column.value(left)
      const b = column.value(right)
      const comparison = typeof a === 'number' && typeof b === 'number'
        ? a - b
        : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' })
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [columns, query, rows, sortDirection, sortKey])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage))
  const visibleRows = filteredRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage)
  const visibleKeys = visibleRows.map(rowKey)
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every(key => selectedKeys.includes(key))

  function toggleSort(key: string) {
    setSortDirection(sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc')
    setSortKey(key)
  }

  function toggleAllVisible() {
    const next = allVisibleSelected
      ? selectedKeys.filter(key => !visibleKeys.includes(key))
      : [...new Set([...selectedKeys, ...visibleKeys])]
    onSelectionChange?.(next)
  }

  function toggleOne(key: string | number) {
    const next = selectedKeys.includes(key)
      ? selectedKeys.filter(item => item !== key)
      : [...selectedKeys, key]
    onSelectionChange?.(next)
  }

  function handleTableKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    if (!visibleRows.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveRow(index => Math.min(index + 1, visibleRows.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveRow(index => Math.max(index - 1, 0))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveRow(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveRow(visibleRows.length - 1)
    } else if (event.key === 'Enter' && onRowActivate) {
      event.preventDefault()
      onRowActivate(visibleRows[activeRow])
    }
  }

  return (
    <div className={`table-frame density-${density}`} dir={dir}>
      <div className="table-toolbar">
        <SearchInput aria-label={searchLabel} placeholder={searchPlaceholder} value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} />
        <div className="table-toolbar-end"><span className="table-count">{filteredRows.length} {labels.rows}</span>{toolbarEnd}</div>
      </div>
      <div className="table-scroll">
        <table className="data-table" tabIndex={0} onKeyDown={handleTableKeyDown} aria-label={searchLabel}>
          <thead><tr>
            {selectable && <th className="selection-cell"><input type="checkbox" aria-label={labels.selectVisibleRows} checked={allVisibleSelected} onChange={toggleAllVisible} /></th>}
            {columns.map(column => <th key={column.key} style={{ width: column.width }} className={`align-${column.align ?? 'start'}`}>
              {column.sortable === false ? column.title : <button className="sort-button" onClick={() => toggleSort(column.key)}>{column.title}<span className="sort-indicator">{sortKey === column.key ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span></button>}
            </th>)}
            {rowActions && <th className="align-end action-heading">{labels.actions}</th>}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={columns.length + Number(selectable) + Number(Boolean(rowActions))}><LoadingState /></td></tr> : visibleRows.map((row, index) => {
              const key = rowKey(row)
              return <tr key={key} className={`${selectedKeys.includes(key) ? 'row-selected ' : ''}${activeRow === index ? 'row-active' : ''}`} onMouseEnter={() => setActiveRow(index)} onDoubleClick={() => onRowActivate?.(row)}>
                {selectable && <td className="selection-cell"><input type="checkbox" aria-label={labels.selectRow(key)} checked={selectedKeys.includes(key)} onChange={() => toggleOne(key)} /></td>}
                {columns.map(column => <td key={column.key} className={`align-${column.align ?? 'start'}`}>{column.render ? column.render(row) : String(column.value(row) ?? '')}</td>)}
                {rowActions && <td className="row-actions">{rowActions(row)}</td>}
              </tr>
            })}
            {!loading && visibleRows.length === 0 && <tr><td colSpan={columns.length + Number(selectable) + Number(Boolean(rowActions))}><EmptyState title={emptyTitle} detail={emptyDetail} /></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-footer"><span className="table-total">Total&nbsp; {filteredRows.length}</span><div className="table-pagination-controls"><label className="rows-per-page"><span>{dir === 'rtl' ? 'عدد الصفوف' : 'Lines per page'}</span><Select value={String(rowsPerPage)} onChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0) }} aria-label={dir === 'rtl' ? 'عدد الصفوف في الصفحة' : 'Lines per page'}>{[5, 10, 15, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</Select></label><div className="pagination"><Button size="small" className="pagination-arrow" aria-label={labels.previous} disabled={page === 0} onClick={() => setPage(current => Math.max(current - 1, 0))}>‹</Button><span className="pagination-current">{page + 1}</span><span className="pagination-more">…</span><span>{pageCount}</span><Button size="small" className="pagination-arrow" aria-label={labels.next} disabled={page + 1 >= pageCount} onClick={() => setPage(current => Math.min(current + 1, pageCount - 1))}>›</Button></div></div></div>
    </div>
  )
}
