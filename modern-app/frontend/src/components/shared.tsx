import { Children, isValidElement, useEffect, useRef, useState, type ChangeEvent, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Icon, type IconName } from './icons'
import { pageSizeOptions, type Pager } from './usePagination'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'quiet' | 'danger' | 'icon'; size?: 'small' | 'medium'; loading?: boolean }

export function Button({ variant = 'secondary', size = 'medium', className = '', loading = false, disabled, children, ...props }: ButtonProps) {
  const appearance = variant === 'quiet' ? 'ghost' : variant
  return <button className={`button button-${appearance} button-${size}${loading ? ' button-loading' : ''} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading && <span className="button-spinner" aria-hidden="true" />}{children}</button>
}

export function IconButton({ label, children, variant = 'icon', ...props }: ButtonProps & { label: string; children: ReactNode }) {
  return <Button variant={variant} className="icon-button" aria-label={label} title={label} {...props}>{children}</Button>
}

export function FormField({ label, hint, error, required, children }: { label: string; hint?: string; error?: string; required?: boolean; children: ReactNode }) {
  return <label className={`form-field${error ? ' has-error' : ''}`}><span className="field-label">{label}{required && <span className="required-mark"> *</span>}</span>{children}{error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}</label>
}

type InputProps = InputHTMLAttributes<HTMLInputElement>
export function TextInput(props: InputProps) { return <input {...props} className={`text-input ${props.className ?? ''}`} /> }
export function NumberInput(props: InputProps) { return <input type="number" inputMode="decimal" step="any" {...props} className={`text-input numeric-input ${props.className ?? ''}`} /> }
export function CurrencyInput(props: InputProps) { return <div className="input-with-prefix"><span className="input-prefix">د.إ</span><input type="number" inputMode="decimal" step="0.01" {...props} className={`text-input numeric-input ${props.className ?? ''}`} /></div> }
export function DateInput(props: InputProps) { return <input type="date" {...props} className={`text-input ${props.className ?? ''}`} /> }
export function SearchInput({ placeholder = 'Search', ...props }: InputProps) { return <div className="search-input-wrap"><span aria-hidden="true" className="search-glyph"><Icon name="search" size={17} /></span><input type="search" placeholder={placeholder} {...props} className={`text-input search-input ${props.className ?? ''}`} /></div> }
type SearchableSelectOption = { value: string; label: ReactNode; searchLabel: string; disabled?: boolean }

/**
 * The shared Select keeps the native SelectHTMLAttributes API used throughout
 * the app, while presenting the same searchable dropdown everywhere.
 */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { children, value, defaultValue, onChange, className = '', disabled = false, id, name, required, 'aria-label': ariaLabel, ...rest } = props
  const options = Children.toArray(children).flatMap(child => {
    if (!isValidElement(child) || child.type !== 'option') return []
    const optionProps = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean }
    const label = optionProps.children ?? ''
    const searchLabel = typeof label === 'string' || typeof label === 'number' ? String(label) : ''
    return [{ value: String(optionProps.value ?? ''), label, searchLabel, disabled: optionProps.disabled } satisfies SearchableSelectOption]
  })
  const controlledValue = value == null ? undefined : String(value)
  const initialValue = controlledValue ?? (defaultValue == null ? '' : String(defaultValue))
  const [selected, setSelected] = useState(initialValue)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  // Remember the last controlled value so the picker keeps it if the parent stops controlling it.
  const [lastControlled, setLastControlled] = useState(controlledValue)
  if (controlledValue !== lastControlled) {
    setLastControlled(controlledValue)
    if (controlledValue !== undefined) setSelected(controlledValue)
  }
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const currentValue = controlledValue ?? selected
  const selectedOption = options.find(option => option.value === currentValue)
  const placeholder = options.find(option => option.value === '')
  const visibleOptions = options.filter(option => option.value !== '' && (!query.trim() || option.searchLabel.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
  const emitChange = (next: string) => {
    setSelected(next)
    setOpen(false)
    setQuery('')
    onChange?.({ target: { value: next, name } } as unknown as ChangeEvent<HTMLSelectElement>)
  }
  return <div ref={rootRef} className={`searchable-select ${className}`}>
    <button
      id={id}
      type="button"
      className={`text-input select-input searchable-select-trigger${disabled ? ' is-disabled' : ''}`}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-required={required || undefined}
      onClick={() => setOpen(current => !current)}
      {...rest as Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'>}
    >
      <span className="searchable-select-value">{selectedOption?.label ?? placeholder?.label ?? '—'}</span>
      <span className="searchable-select-chevron" aria-hidden="true"><Icon name="chevron-down" size={17} /></span>
    </button>
    {name && <input type="hidden" name={name} value={currentValue} required={required} />}
    {open && !disabled && <div className="searchable-select-menu" role="listbox" aria-label={ariaLabel}>
      <input autoFocus type="search" className="text-input searchable-select-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search…" aria-label="Search options" />
      <div className="searchable-select-options">
        {visibleOptions.length ? visibleOptions.map(option => <button key={option.value} type="button" role="option" aria-selected={option.value === currentValue} disabled={option.disabled} className={option.value === currentValue ? 'is-selected' : ''} onClick={() => !option.disabled && emitChange(option.value)}>{option.label}</button>) : <div className="searchable-select-empty">No options</div>}
      </div>
    </div>}
  </div>
}
export function CheckInput({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="check-input"><input type="checkbox" {...props} /><span>{label}</span></label> }

export function SwitchInput({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className="switch-field"><span className="switch-copy"><span className="switch-label">{label}</span>{hint && <span className="switch-hint">{hint}</span>}</span><input type="checkbox" role="switch" {...props} /><span className="switch-track" aria-hidden="true"><span /></span></label>
}

export function StatusToggle({ checked, onChange, activeLabel = 'Active', inactiveLabel = 'Inactive', disabled = false }: { checked: boolean; onChange: InputHTMLAttributes<HTMLInputElement>['onChange']; activeLabel?: string; inactiveLabel?: string; disabled?: boolean }) {
  return <label className="status-toggle"><input type="checkbox" role="switch" checked={checked} onChange={onChange} disabled={disabled} aria-label={checked ? activeLabel : inactiveLabel} /><span className="status-toggle-track"><span className="status-toggle-label">{checked ? activeLabel : inactiveLabel}</span><span className="status-toggle-knob" /></span></label>
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="form-section"><div className="section-heading"><h3>{title}</h3>{description && <p>{description}</p>}</div>{children}</section>
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <article className={`surface-card ${className}`} {...props} />
}

export function StatusBadge({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; className?: string }) { return <span className={`status-badge badge-${tone} ${className}`}>{children}</span> }
export function LoadingState({ label = 'Loading…' }: { label?: string }) { return <div className="state-card" role="status"><span className="spinner" />{label}</div> }
export function EmptyState({ title, detail }: { title: string; detail?: string }) { return <div className="state-card empty-state"><span className="empty-mark">—</span><strong>{title}</strong>{detail && <span>{detail}</span>}</div> }
export function ErrorState({ title, detail }: { title: string; detail?: string }) { return <div className="state-card error-state" role="alert"><span className="error-mark">!</span><strong>{title}</strong>{detail && <span>{detail}</span>}</div> }

export function TableFooter({ total, locale = 'en', pager }: { total: number; locale?: 'ar' | 'en'; pager?: Pager }) {
  const ar = locale === 'ar'
  const page = pager?.page ?? 0
  const pageCount = pager?.pageCount ?? 1
  const pageSize = pager?.pageSize ?? pageSizeOptions[0]
  return <div className="table-footer"><span className="table-total">{ar ? 'الإجمالي' : 'Total'}&nbsp; {total}</span><div className="table-pagination-controls"><label className="rows-per-page"><span>{ar ? 'عدد الصفوف' : 'Lines per page'}</span><Select value={String(pageSize)} disabled={!pager} onChange={event => pager?.onPageSizeChange(Number(event.target.value))} aria-label={ar ? 'عدد الصفوف في الصفحة' : 'Lines per page'}>{pageSizeOptions.map(size => <option key={size} value={size}>{size}</option>)}</Select></label><div className="pagination"><Button size="small" className="pagination-arrow" aria-label={ar ? 'السابق' : 'Previous'} disabled={page === 0} onClick={() => pager?.onPageChange(page - 1)}>‹</Button><span className="pagination-current">{page + 1}</span><span className="pagination-more">…</span><span>{pageCount}</span><Button size="small" className="pagination-arrow" aria-label={ar ? 'التالي' : 'Next'} disabled={page + 1 >= pageCount} onClick={() => pager?.onPageChange(page + 1)}>›</Button></div></div></div>
}

export function Tabs({ tabs, value, onChange }: { tabs: Array<{ id: string; label: string }>; value: string; onChange: (id: string) => void }) {
  return <div className="tabs" role="tablist">{tabs.map(tab => <button key={tab.id} className={`tab${value === tab.id ? ' tab-active' : ''}`} role="tab" aria-selected={value === tab.id} onClick={() => onChange(tab.id)}>{tab.label}</button>)}</div>
}

export function Modal({ open, title, titleIcon, description, children, onClose, footer, closeLabel = 'Close', busy = false }: { open: boolean; title: string; titleIcon?: IconName; description?: string; children: ReactNode; onClose: () => void; footer?: ReactNode; closeLabel?: string; busy?: boolean }) {
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  const dialogRef = useRef<HTMLElement>(null)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => { busyRef.current = busy }, [busy])
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusables = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])
    window.requestAnimationFrame(() => (dialogRef.current?.querySelector<HTMLElement>('[autofocus]') ?? focusables()[0] ?? dialogRef.current)?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); closeRef.current() }
      if (event.key === 'Tab') {
        const elements = focusables()
        if (!elements.length) { event.preventDefault(); dialogRef.current?.focus(); return }
        if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements[elements.length - 1].focus() }
        else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) { event.preventDefault(); elements[0].focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => { document.removeEventListener('keydown', handleKeyDown); previouslyFocused?.focus() }
  }, [open])

  if (!open) return null
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
    <section className="modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="shared-modal-title" tabIndex={-1}>
      <header className="modal-header"><div className="modal-heading"><h2 id="shared-modal-title">{titleIcon && <Icon name={titleIcon} size={21} />}{title}</h2>{description && <p>{description}</p>}</div><IconButton label={closeLabel} disabled={busy} onClick={onClose}><Icon name="close" size={20} /></IconButton></header>
      <div className="modal-body">{children}</div>{footer && <footer className="modal-footer">{footer}</footer>}
    </section>
  </div>
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', closeLabel = 'Close', onCancel, onConfirm, busy = false, danger = false, confirmDisabled = false }: { open: boolean; title: string; message: string; confirmLabel?: string; cancelLabel?: string; closeLabel?: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; danger?: boolean; confirmDisabled?: boolean }) {
  return <Modal open={open} title={title} closeLabel={closeLabel} onClose={onCancel} busy={busy} footer={<><Button disabled={busy} onClick={onCancel}>{cancelLabel}</Button><Button variant={danger ? 'danger' : 'primary'} disabled={confirmDisabled} loading={busy} onClick={onConfirm}>{confirmLabel}</Button></>}><p className="dialog-message">{message}</p></Modal>
}
