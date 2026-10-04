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
  // Lets long text wrap instead of being kept on one line with an ellipsis.
  wrap?: boolean
}

export type TotalItem = { key: string; label: string; value: ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' }

export type DataTableLabels = {
  rows: string
  actions: string
  selectVisibleRows: string
  selectRow: (key: string | number) => string
  previous: string
  next: string
  showing: string
  of: string
  total: string
  linesPerPage: string
  page: string
}

const englishLabels: DataTableLabels = {
  rows: 'rows',
  actions: 'Actions',
  selectVisibleRows: 'Select visible rows',
  selectRow: key => `Select row ${key}`,
  previous: 'Previous',
  next: 'Next',
  showing: 'Showing',
  of: 'of',
  total: 'Total',
  linesPerPage: 'Lines per page',
  page: 'Page',
}

const arabicLabels: DataTableLabels = {
  rows: 'صف',
  actions: 'الإجراءات',
  selectVisibleRows: 'تحديد الصفوف الظاهرة',
  selectRow: key => `تحديد الصف ${key}`,
  previous: 'السابق',
  next: 'التالي',
  showing: 'عرض',
  of: 'من',
  total: 'الإجمالي',
  linesPerPage: 'عدد الصفوف',
  page: 'صفحة',
}

export type DataTableProps<T> = {
  columns: Array<TableColumn<T>>
  rows: T[]
  rowKey: (row: T) => string | number
  searchPlaceholder?: string
  searchLabel?: string
  searchable?: boolean
  // Page-specific filter controls (date presets, type chips) shown beside the search.
  filters?: ReactNode
  toolbarEnd?: ReactNode
  // Figures for the totals strip, worked out from the rows that pass search and filters.
  totals?: (rows: T[]) => TotalItem[]
  selectable?: boolean
  selectedKeys?: Array<string | number>
  onSelectionChange?: (keys: Array<string | number>) => void
  rowActions?: (row: T) => ReactNode
  onRowActivate?: (row: T) => void
  // Single-row selection that drives the side panel.
  activeRowKey?: string | number | null
  onRowSelect?: (row: T) => void
  panel?: ReactNode
  rowClassName?: (row: T) => string
  loading?: boolean
  emptyTitle?: string
  emptyDetail?: string
  pageSize?: number
  paginated?: boolean
  density?: 'compact' | 'comfortable'
  locale?: 'en' | 'ar'
  dir?: 'ltr' | 'rtl'
  labels?: Partial<DataTableLabels>
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchPlaceholder,
  searchLabel,
  searchable = true,
  filters,
  toolbarEnd,
  totals,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  rowActions,
  onRowActivate,
  activeRowKey,
  onRowSelect,
  panel,
  rowClassName,
  loading = false,
  emptyTitle,
  emptyDetail,
  pageSize = 5,
  paginated = true,
  density = 'comfortable',
  locale,
  dir,
  labels: labelOverrides,
  className = '',
}: DataTableProps<T>) {
  const ar = locale ? locale === 'ar' : dir === 'rtl'
  const direction = dir ?? (ar ? 'rtl' : 'ltr')
  const labels = { ...(ar ? arabicLabels : englishLabels), ...labelOverrides }
  const searchText = searchPlaceholder ?? (ar ? 'بحث' : 'Search rows')
  const searchName = searchLabel ?? (ar ? 'بحث في الجدول' : 'Search table rows')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [requestedPage, setPage] = useState(0)
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

  const perPage = paginated ? rowsPerPage : Math.max(filteredRows.length, 1)
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / perPage))
  // Filters outside the table can shrink the rows; never show a page past the end.
  const page = Math.min(requestedPage, pageCount - 1)
  const visibleRows = filteredRows.slice(page * perPage, (page + 1) * perPage)
  const visibleKeys = visibleRows.map(rowKey)
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every(key => selectedKeys.includes(key))
  const totalItems = totals?.(filteredRows) ?? []
  const columnCount = columns.length + Number(selectable) + Number(Boolean(rowActions))

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
    } else if (event.key === 'Enter' && (onRowSelect || onRowActivate)) {
      event.preventDefault()
      const row = visibleRows[Math.min(activeRow, visibleRows.length - 1)]
      if (onRowSelect) onRowSelect(row)
      else onRowActivate?.(row)
    }
  }

  const showToolbar = searchable || filters || toolbarEnd
  const table = (
    <div className={`table-frame density-${density}`}>
      {showToolbar && <div className="table-toolbar">
        {searchable && <SearchInput aria-label={searchName} placeholder={searchText} value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} />}
        {filters && <div className="table-filters">{filters}</div>}
        <div className="table-toolbar-end"><span className="table-count">{filteredRows.length} {labels.rows}</span>{toolbarEnd}</div>
      </div>}
      <div className="table-scroll">
        <table className="data-table" tabIndex={0} onKeyDown={handleTableKeyDown} aria-label={searchName}>
          <thead><tr>
            {selectable && <th className="selection-cell"><input type="checkbox" aria-label={labels.selectVisibleRows} checked={allVisibleSelected} onChange={toggleAllVisible} /></th>}
            {columns.map(column => <th key={column.key} style={{ width: column.width }} className={`align-${column.align ?? 'start'}`}>
              {column.sortable === false ? column.title : <button className="sort-button" onClick={() => toggleSort(column.key)}>{column.title}<span className="sort-indicator">{sortKey === column.key ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span></button>}
            </th>)}
            {rowActions && <th className="align-end action-heading">{labels.actions}</th>}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={columnCount}><LoadingState /></td></tr> : visibleRows.map((row, index) => {
              const key = rowKey(row)
              const classes = [
                selectedKeys.includes(key) || (activeRowKey != null && activeRowKey === key) ? 'row-selected' : '',
                activeRow === index ? 'row-active' : '',
                onRowSelect ? 'row-clickable' : '',
                rowClassName?.(row) ?? '',
              ].filter(Boolean).join(' ')
              return <tr key={key} className={classes} aria-selected={onRowSelect ? activeRowKey === key : undefined} onMouseEnter={() => setActiveRow(index)} onClick={onRowSelect ? () => onRowSelect(row) : undefined} onDoubleClick={() => onRowActivate?.(row)}>
                {selectable && <td className="selection-cell"><input type="checkbox" aria-label={labels.selectRow(key)} checked={selectedKeys.includes(key)} onChange={() => toggleOne(key)} /></td>}
                {columns.map(column => <td key={column.key} className={`align-${column.align ?? 'start'}${column.wrap ? ' cell-wrap' : ''}`}>{column.render ? column.render(row) : String(column.value(row) ?? '')}</td>)}
                {rowActions && <td className="row-actions" onClick={event => event.stopPropagation()}>{rowActions(row)}</td>}
              </tr>
            })}
            {!loading && visibleRows.length === 0 && <tr><td colSpan={columnCount}><EmptyState title={emptyTitle ?? (ar ? 'لا توجد نتائج' : 'No results found')} detail={emptyDetail ?? (ar ? 'جرّب تغيير البحث أو عوامل التصفية.' : 'Try changing the search or filters.')} /></td></tr>}
          </tbody>
        </table>
      </div>
      {paginated && <div className="table-footer"><span className="table-total">{labels.total}&nbsp; {filteredRows.length}</span><div className="table-pagination-controls"><label className="rows-per-page"><span>{labels.linesPerPage}</span><Select value={String(rowsPerPage)} onChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0) }} aria-label={labels.linesPerPage}>{[...new Set([5, 10, 15, 25, 50, pageSize])].sort((a, b) => a - b).map(size => <option key={size} value={size}>{size}</option>)}</Select></label><div className="pagination"><Button size="small" className="pagination-arrow" aria-label={labels.previous} disabled={page === 0} onClick={() => setPage(Math.max(page - 1, 0))}><span className="icon-flip-rtl">‹</span></Button><span className="pagination-status">{labels.page} <span className="pagination-current">{page + 1}</span> {labels.of} {pageCount}</span><Button size="small" className="pagination-arrow" aria-label={labels.next} disabled={page + 1 >= pageCount} onClick={() => setPage(Math.min(page + 1, pageCount - 1))}><span className="icon-flip-rtl">›</span></Button></div></div></div>}
    </div>
  )

  return (
    <div className={`list-view ${className}`} dir={direction}>
      {totalItems.length > 0 && <TotalsStrip items={totalItems} />}
      {panel ? <div className="list-with-panel">{table}{panel}</div> : table}
    </div>
  )
}

export function TotalsStrip({ items }: { items: TotalItem[] }) {
  return <dl className="totals-strip">{items.map(item => <div key={item.key} className={`totals-item tone-${item.tone ?? 'default'}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
}
