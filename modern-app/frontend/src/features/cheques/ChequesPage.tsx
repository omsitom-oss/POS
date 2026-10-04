import { useCallback, useMemo, useState } from 'react'
import { Button, Card, DateInput, EmptyState, ErrorState, FormField, LoadingState, Modal, SearchInput, Select, StatusBadge, TableFooter, Tabs } from '../../components/shared'
import { useLoadEffect } from '../../components/useLoadEffect'
import { usePagination } from '../../components/usePagination'
import { PageHeader, type Locale } from '../../layouts/AppLayout'
import { actionEffect, actionLabels, addDays, allowedActions, dueDateTotals, isOpen, money, statusLabels, statusTones, sumByCurrency, today, type BankTreasury, type Cheque, type ChequeAction, type ChequeDetail, type ChequeStatus } from './chequeModel'

type View = 'ALL' | 'IN' | 'OUT' | 'TOTALS'
const statuses: ChequeStatus[] = ['PENDING', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'RETURNED', 'CANCELLED']

// Received and issued cheques: due-soon summary, list with filters, status moves with their history, and due-date totals.
// Cheques are recorded from Receipts (payment method Cheque); this screen manages them afterwards.
export function ChequesPage({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  const ar = locale === 'ar'
  const [rows, setRows] = useState<Cheque[]>([])
  const [view, setView] = useState<View>('ALL')
  const [status, setStatus] = useState<'ALL' | 'OPEN' | ChequeStatus>('ALL')
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [move, setMove] = useState<{ cheque: Cheque; action: ChequeAction } | null>(null)
  const [moveDate, setMoveDate] = useState(today())
  const [note, setNote] = useState('')
  const [moveError, setMoveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<ChequeDetail | null>(null)
  const [treasuries, setTreasuries] = useState<BankTreasury[]>([])
  const [depositBank, setDepositBank] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [response, treasuryResponse] = await Promise.all([fetch('/api/cheques'), fetch('/api/treasuries')])
      if (!response.ok) throw new Error(ar ? 'تعذر تحميل الشيكات.' : 'Could not load cheques.')
      setRows(await response.json() as Cheque[])
      setTreasuries(treasuryResponse.ok ? await treasuryResponse.json() as BankTreasury[] : [])
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) } finally { setLoading(false) }
  }, [ar])
  useLoadEffect(load)

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase()
    return rows.filter(row => (view === 'ALL' || view === 'TOTALS' || row.direction === view)
      && (status === 'ALL' || (status === 'OPEN' ? isOpen(row.status) : row.status === status))
      && (!dueFrom || row.dueDate.slice(0, 10) >= dueFrom) && (!dueTo || row.dueDate.slice(0, 10) <= dueTo)
      && (!q || [row.chequeNo, row.voucherNo, row.partnerName, row.treasuryNameAr, row.treasuryNameEn].some(value => value.toLocaleLowerCase().includes(q))))
  }, [rows, view, status, dueFrom, dueTo, search])
  const page = usePagination(filtered)
  const totals = useMemo(() => dueDateTotals(filtered), [filtered])

  const now = today()
  const weekEnd = addDays(now, 7)
  const open = rows.filter(row => isOpen(row.status))
  const overdue = open.filter(row => row.dueDate.slice(0, 10) < now)
  const dueIn = (direction: 'IN' | 'OUT') => open.filter(row => row.direction === direction && row.dueDate.slice(0, 10) >= now && row.dueDate.slice(0, 10) <= weekEnd)

  function startMove(cheque: Cheque, action: ChequeAction) { setMove({ cheque, action }); setDepositBank(String(cheque.treasuryId)); setMoveDate(today()); setNote(''); setMoveError('') }

  async function submitMove() {
    if (!move) return
    setSaving(true); setMoveError('')
    try {
      const response = await fetch(`/api/cheques/${move.cheque.chequeId}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: move.action, date: moveDate, note: note.trim() || null, ...(move.action === 'DEPOSIT' ? { treasuryId: Number(depositBank) } : {}) }) })
      if (!response.ok) { const problem = await response.json().catch(() => null) as { detail?: string } | null; throw new Error(problem?.detail ?? (ar ? 'تعذر تنفيذ العملية.' : 'The request failed.')) }
      const result = await response.json() as ChequeDetail
      setNotice(`${ar ? 'الشيك' : 'Cheque'} ${result.cheque.chequeNo}: ${statusLabels[result.cheque.status][ar ? 0 : 1]}`)
      setMove(null)
      await load()
    } catch (failure) { setMoveError(failure instanceof Error ? failure.message : String(failure)) } finally { setSaving(false) }
  }

  async function showHistory(cheque: Cheque) {
    setError('')
    try {
      const response = await fetch(`/api/cheques/${cheque.chequeId}`)
      if (!response.ok) throw new Error(ar ? 'تعذر تحميل سجل الشيك.' : 'Could not load the cheque history.')
      setHistory(await response.json() as ChequeDetail)
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
  }

  const bank = (row: Cheque) => ar ? (row.bankNameAr ? `${row.bankNameAr} · ${row.treasuryNameAr}` : row.treasuryNameAr) : (row.bankNameEn ? `${row.bankNameEn} · ${row.treasuryNameEn}` : row.treasuryNameEn)
  const directionLabel = (direction: 'IN' | 'OUT') => direction === 'IN' ? (ar ? 'وارد' : 'Received') : (ar ? 'صادر' : 'Issued')
  const statusText = (value: ChequeStatus) => statusLabels[value][ar ? 0 : 1]
  const moveOptions = move ? allowedActions(move.cheque.direction, move.cheque.status) : []
  // Banks a received cheque can be deposited to: active bank treasuries of its branch, in its currency.
  const depositBanks = move ? treasuries.filter(item => item.treasureType === 'BANK' && item.isActive && item.currencyId === move.cheque.currencyId && (item.branchId == null || item.branchId === move.cheque.branchId)) : []

  return <div className="settings-page" dir={ar ? 'rtl' : 'ltr'}>
    <PageHeader eyebrow={ar ? 'المعاملات المالية' : 'FINANCE'} title={ar ? 'الشيكات' : 'Cheques'} description={ar ? 'متابعة الشيكات الواردة والصادرة حتى صرفها أو ارتجاعها. تُسجَّل الشيكات من الإيصالات باختيار طريقة الدفع شيك.' : 'Follow received and issued cheques until they clear or bounce. Record a cheque from Receipts with payment method Cheque.'} />
    {notice && <div className="form-success" role="status">{notice}</div>}
    <div className="setting-type-grid">
      <Card className="metric-card"><span className="setting-type-description">{ar ? 'واردة مستحقة خلال 7 أيام' : 'Received, due in 7 days'}</span><strong className="report-metric">{dueIn('IN').length}</strong><span className="muted-cell">{sumByCurrency(dueIn('IN')) || '—'}</span></Card>
      <Card className="metric-card"><span className="setting-type-description">{ar ? 'صادرة مستحقة خلال 7 أيام' : 'Issued, due in 7 days'}</span><strong className="report-metric">{dueIn('OUT').length}</strong><span className="muted-cell">{sumByCurrency(dueIn('OUT')) || '—'}</span></Card>
      <Card className="metric-card"><span className="setting-type-description">{ar ? 'متأخرة ولم تُصرف' : 'Past due, not cleared'}</span><strong className="report-metric">{overdue.length}</strong><span className="muted-cell">{sumByCurrency(overdue) || '—'}</span></Card>
    </div>
    <Tabs value={view} onChange={id => { setView(id as View); page.resetPage() }} tabs={[
      { id: 'ALL', label: ar ? 'الكل' : 'All' },
      { id: 'IN', label: ar ? 'واردة' : 'Received' },
      { id: 'OUT', label: ar ? 'صادرة' : 'Issued' },
      { id: 'TOTALS', label: ar ? 'حسب تاريخ الاستحقاق' : 'By due date' },
    ]} />
    <section className="receipts-toolbar">
      <SearchInput aria-label={ar ? 'بحث في الشيكات' : 'Search cheques'} placeholder={ar ? 'رقم الشيك أو الإيصال أو الشريك أو البنك' : 'Cheque no., voucher, partner or bank'} value={search} onChange={event => { setSearch(event.target.value); page.resetPage() }} />
      <div className="inventory-row-actions">
        <Select aria-label={ar ? 'الحالة' : 'Status'} value={status} onChange={event => { setStatus(event.target.value as typeof status); page.resetPage() }}>
          <option value="ALL">{ar ? 'كل الحالات' : 'All statuses'}</option>
          <option value="OPEN">{ar ? 'لم تُصرف بعد' : 'Not cleared yet'}</option>
          {statuses.map(value => <option key={value} value={value}>{statusText(value)}</option>)}
        </Select>
        <DateInput aria-label={ar ? 'الاستحقاق من' : 'Due from'} value={dueFrom} onChange={event => { setDueFrom(event.target.value); page.resetPage() }} />
        <DateInput aria-label={ar ? 'الاستحقاق إلى' : 'Due to'} value={dueTo} onChange={event => { setDueTo(event.target.value); page.resetPage() }} />
      </div>
    </section>
    {error && <ErrorState title={ar ? 'تعذر تنفيذ العملية' : 'Request failed'} detail={error} />}
    {loading ? <LoadingState label={ar ? 'جارٍ تحميل الشيكات…' : 'Loading cheques…'} /> : filtered.length === 0 ? <EmptyState title={rows.length ? (ar ? 'لا توجد نتائج' : 'No results') : (ar ? 'لا توجد شيكات' : 'No cheques yet')} detail={rows.length ? undefined : (ar ? 'سجّل إيصال استلام أو دفع بطريقة شيك.' : 'Record a receipt or payment with payment method Cheque.')} />
      : view === 'TOTALS' ? <div className="receipts-table-wrap"><table className="receipts-table">
        <thead><tr><th>{ar ? 'تاريخ الاستحقاق' : 'Due date'}</th><th>{ar ? 'العملة' : 'Currency'}</th><th>{ar ? 'الشيكات' : 'Cheques'}</th><th>{ar ? 'واردة' : 'Received'}</th><th>{ar ? 'صادرة' : 'Issued'}</th><th>{ar ? 'الصافي' : 'Net'}</th></tr></thead>
        <tbody>{totals.map(total => <tr key={`${total.dueDate}|${total.currencySymbol}`}><td>{total.dueDate}</td><td>{total.currencySymbol}</td><td className="numeric-cell">{total.count}</td><td className="numeric-cell">{money(total.received)}</td><td className="numeric-cell">{money(total.issued)}</td><td className="numeric-cell">{money(total.received - total.issued)}</td></tr>)}</tbody>
      </table><p className="muted-cell">{ar ? 'لا تشمل الشيكات المرتجعة أو المعادة أو الملغاة.' : 'Bounced, returned and cancelled cheques are left out.'}</p></div>
      : <div className="receipts-table-wrap"><table className="receipts-table">
        <thead><tr><th>{ar ? 'رقم الشيك' : 'Cheque no.'}</th><th>{ar ? 'النوع' : 'Type'}</th><th>{ar ? 'الاستحقاق' : 'Due date'}</th><th>{ar ? 'الشريك' : 'Partner'}</th><th>{ar ? 'البنك' : 'Bank'}</th><th>{ar ? 'المبلغ' : 'Amount'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th aria-label={ar ? 'إجراءات' : 'Actions'} /></tr></thead>
        <tbody>{page.rows.map(row => {
          const actions = canManage ? allowedActions(row.direction, row.status) : []
          return <tr key={row.chequeId}>
            <td><code>{row.chequeNo}</code></td>
            <td><span className={`receipt-type-badge ${row.direction === 'IN' ? 'receipt-type-in' : 'receipt-type-out'}`}>{directionLabel(row.direction)}</span></td>
            <td>{row.dueDate.slice(0, 10)}{isOpen(row.status) && row.dueDate.slice(0, 10) < now && <small className="muted-cell"> {ar ? 'متأخر' : 'past due'}</small>}</td>
            <td>{row.partnerName}</td>
            <td>{bank(row)}</td>
            <td className="numeric-cell">{money(row.amount)} <small>{row.currencySymbol}</small></td>
            <td><StatusBadge tone={statusTones[row.status]}>{statusText(row.status)}</StatusBadge>{row.statusDate && row.status !== 'PENDING' && <small className="muted-cell"> {row.statusDate.slice(0, 10)}</small>}</td>
            <td><div className="inventory-row-actions">
              {actions.length > 0 && <Button size="small" variant="primary" onClick={() => startMove(row, actions[0])}>{ar ? 'تحديث' : 'Update'}</Button>}
              <Button size="small" variant="ghost" onClick={() => void showHistory(row)}>{ar ? 'السجل' : 'History'}</Button>
            </div></td>
          </tr>
        })}</tbody>
      </table><TableFooter total={filtered.length} locale={locale} pager={page.pager} /></div>}

    <Modal open={Boolean(move)} busy={saving} closeLabel={ar ? 'إغلاق' : 'Close'} onClose={() => setMove(null)} title={ar ? 'تحديث حالة الشيك' : 'Update cheque status'}
      description={move ? `${move.cheque.chequeNo} · ${move.cheque.partnerName} · ${money(move.cheque.amount)} ${move.cheque.currencySymbol}` : undefined}
      footer={<><Button variant="ghost" disabled={saving} onClick={() => setMove(null)}>{ar ? 'إلغاء' : 'Cancel'}</Button><Button variant={move?.action === 'CLEAR' || move?.action === 'DEPOSIT' ? 'primary' : 'danger'} loading={saving} onClick={() => void submitMove()}>{move ? actionLabels[move.action][ar ? 0 : 1] : ''}</Button></>}>
      {move && <div className="settings-form">
        <div className="form-field grid-full"><span className="field-label">{ar ? 'الإجراء' : 'Action'}</span><div className="inventory-row-actions" role="group" aria-label={ar ? 'الإجراء' : 'Action'}>{moveOptions.map(action => <Button key={action} size="small" variant={move.action === action ? 'primary' : 'outline'} aria-pressed={move.action === action} onClick={() => setMove({ ...move, action })}>{actionLabels[action][ar ? 0 : 1]}</Button>)}</div></div>
        <p className="dialog-message grid-full">{actionEffect(move.cheque, move.action, ar)}</p>
        {move.action === 'DEPOSIT' && <FormField label={ar ? 'يودع في (البنك)' : 'Deposit to (bank)'} required><Select aria-label={ar ? 'يودع في (البنك)' : 'Deposit to (bank)'} value={depositBank} onChange={event => setDepositBank(event.target.value)}>
          {!depositBanks.some(item => item.treasuryId === move.cheque.treasuryId) && <option value={move.cheque.treasuryId}>{ar ? move.cheque.treasuryNameAr : move.cheque.treasuryNameEn}</option>}
          {depositBanks.map(item => <option key={item.treasuryId} value={item.treasuryId}>{ar ? item.nameAr : item.nameEn}</option>)}
        </Select></FormField>}
        <FormField label={ar ? 'التاريخ' : 'Date'} hint={ar ? 'تاريخ القيد هو يوم حدوث العملية.' : 'The entry is dated the day this happened.'} required><DateInput value={moveDate} min={move.cheque.voucherDate.slice(0, 10)} onChange={event => setMoveDate(event.target.value)} /></FormField>
        <FormField label={ar ? 'ملاحظة' : 'Note'}><textarea className="text-input" rows={2} maxLength={250} value={note} onChange={event => setNote(event.target.value)} /></FormField>
        {moveError && <div className="receipt-form-error grid-full" role="alert">{moveError}</div>}
      </div>}
    </Modal>

    <Modal open={Boolean(history)} closeLabel={ar ? 'إغلاق' : 'Close'} onClose={() => setHistory(null)} title={ar ? 'سجل الشيك' : 'Cheque history'}
      description={history ? `${history.cheque.chequeNo} · ${directionLabel(history.cheque.direction)} · ${history.cheque.voucherNo}` : undefined}
      footer={<Button variant="secondary" onClick={() => setHistory(null)}>{ar ? 'إغلاق' : 'Close'}</Button>}>
      {history && <div className="receipts-table-wrap"><table className="receipts-table">
        <thead><tr><th>{ar ? 'التاريخ' : 'Date'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th>{ar ? 'بواسطة' : 'By'}</th><th>{ar ? 'وقت التسجيل' : 'Recorded at'}</th><th>{ar ? 'ملاحظة' : 'Note'}</th></tr></thead>
        <tbody>{history.events.map(event => <tr key={event.chequeEventId}><td>{event.eventDate.slice(0, 10)}</td><td><StatusBadge tone={statusTones[event.toStatus]}>{statusText(event.toStatus)}</StatusBadge></td><td>{event.savedByName ?? '—'}</td><td>{new Date(event.savedAt.endsWith('Z') ? event.savedAt : `${event.savedAt}Z`).toLocaleString(ar ? 'ar' : 'en-GB')}</td><td>{[event.treasuryId ? (ar ? event.treasuryNameAr : event.treasuryNameEn) : null, event.note].filter(Boolean).join(' · ') || '—'}</td></tr>)}</tbody>
      </table></div>}
    </Modal>
  </div>
}
