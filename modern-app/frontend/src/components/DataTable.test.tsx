import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DataTable, type TableColumn } from './DataTable'

type Row = { id: number; name: string; qty: number }
const rows: Row[] = [
  { id: 1, name: 'Panadol', qty: 12 },
  { id: 2, name: 'Augmentin', qty: 3 },
  { id: 3, name: 'Brufen', qty: 40 },
]
const columns: Array<TableColumn<Row>> = [
  { key: 'name', title: 'Name', value: row => row.name },
  { key: 'qty', title: 'Qty', value: row => row.qty },
]

function bodyNames() {
  const [, body] = screen.getAllByRole('rowgroup')
  return within(body).getAllByRole('row').map(row => within(row).getAllByRole('cell')[0].textContent)
}

describe('DataTable', () => {
  it('filters rows by search text', async () => {
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.id} />)
    await userEvent.type(screen.getByRole('searchbox'), 'bru')
    expect(bodyNames()).toEqual(['Brufen'])
    expect(screen.getByText('1 rows')).toBeInTheDocument()
  })

  it('sorts numbers numerically and toggles direction', async () => {
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.id} />)
    await userEvent.click(screen.getByRole('button', { name: /Qty/ }))
    expect(bodyNames()).toEqual(['Augmentin', 'Panadol', 'Brufen'])
    await userEvent.click(screen.getByRole('button', { name: /Qty/ }))
    expect(bodyNames()).toEqual(['Brufen', 'Panadol', 'Augmentin'])
  })

  it('pages rows by page size', async () => {
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.id} pageSize={2} />)
    expect(bodyNames()).toEqual(['Panadol', 'Augmentin'])
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(bodyNames()).toEqual(['Brufen'])
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('reports selection of all visible rows', async () => {
    const onSelectionChange = vi.fn()
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.id} selectable onSelectionChange={onSelectionChange} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select visible rows' }))
    expect(onSelectionChange).toHaveBeenCalledWith([1, 2, 3])
  })

  it('shows the empty state when nothing matches', async () => {
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.id} emptyTitle="Nothing here" />)
    await userEvent.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('renders in the requested direction', () => {
    const { container } = render(<DataTable columns={columns} rows={rows} rowKey={row => row.id} dir="rtl" />)
    expect(container.firstElementChild).toHaveAttribute('dir', 'rtl')
  })
})

describe('DataTable list pattern', () => {
  it('works out the totals strip from the rows that match the search', async () => {
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.id} totals={list => [{ key: 'qty', label: 'Units', value: list.reduce((sum, row) => sum + row.qty, 0) }]} />)
    expect(screen.getByText('Units').nextSibling).toHaveTextContent('55')
    await userEvent.type(screen.getByRole('searchbox'), 'bru')
    expect(screen.getByText('Units').nextSibling).toHaveTextContent('40')
  })

  it('selects a row for the side panel with a click', async () => {
    const onRowSelect = vi.fn()
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.id} onRowSelect={onRowSelect} activeRowKey={2} panel={<aside>Panel</aside>} />)
    await userEvent.click(screen.getByText('Brufen'))
    expect(onRowSelect).toHaveBeenCalledWith(rows[2])
    expect(screen.getByText('Panel')).toBeInTheDocument()
    expect(screen.getByText('Augmentin').closest('tr')).toHaveAttribute('aria-selected', 'true')
  })

  it('uses Arabic labels without overrides', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.id} locale="ar" />)
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'بحث')
    expect(screen.getByText('3 صف')).toBeInTheDocument()
  })
})
