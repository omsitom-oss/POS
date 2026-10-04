import { localDate } from '../../app/formatters'
// Types, labels and rules for the cheques screen. The server enforces the same moves (ChequeService.Transition);
// these only decide which buttons to offer and what to explain.

export type Direction = 'IN' | 'OUT'
export type ChequeStatus = 'PENDING' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED' | 'RETURNED' | 'CANCELLED'
export type ChequeAction = 'DEPOSIT' | 'CLEAR' | 'BOUNCE' | 'RETURN' | 'CANCEL'

export type Cheque = {
  chequeId: number; branchId: number; direction: Direction; chequeNo: string; dueDate: string
  partnerId: number; partnerName: string; treasuryId: number; treasuryNameAr: string; treasuryNameEn: string; bankNameAr: string | null; bankNameEn: string | null
  currencyId: number; currencyCode: string; currencySymbol: string; amount: number; partnerAmount: number; partnerCurrencySymbol: string
  voucherNo: string; voucherDate: string; description: string | null
  status: ChequeStatus; statusDate: string | null; statusByName: string | null; statusAt: string | null; savedByName: string | null; createdAt: string
}
export type ChequeEvent = { chequeEventId: number; fromStatus: ChequeStatus | null; toStatus: ChequeStatus; eventDate: string; moveNo: number | null; note: string | null; savedByName: string | null; savedAt: string; treasuryId: number | null; treasuryNameAr: string | null; treasuryNameEn: string | null }
export type BankTreasury = { treasuryId: number; nameAr: string; nameEn: string; treasureType: string; currencyId: number; isActive: boolean; branchId?: number | null }
export type ChequeDetail = { cheque: Cheque; events: ChequeEvent[] }

export const statusLabels: Record<ChequeStatus, [string, string]> = {
  PENDING: ['جديد', 'Pending'], DEPOSITED: ['مودع في البنك', 'Deposited'], CLEARED: ['مصروف', 'Cleared'],
  BOUNCED: ['مرتجع من البنك', 'Bounced'], RETURNED: ['مُعاد للعميل', 'Returned'], CANCELLED: ['ملغى', 'Cancelled'],
}
export const statusTones: Record<ChequeStatus, 'neutral' | 'info' | 'success' | 'danger' | 'warning'> = {
  PENDING: 'warning', DEPOSITED: 'info', CLEARED: 'success', BOUNCED: 'danger', RETURNED: 'neutral', CANCELLED: 'neutral',
}
export const actionLabels: Record<ChequeAction, [string, string]> = {
  DEPOSIT: ['إيداع في البنك', 'Deposit'], CLEAR: ['تأكيد الصرف', 'Clear'], BOUNCE: ['ارتجاع من البنك', 'Bounce'],
  RETURN: ['إعادة للعميل', 'Return to customer'], CANCEL: ['إلغاء', 'Cancel cheque'],
}

export function allowedActions(direction: Direction, status: ChequeStatus): ChequeAction[] {
  if (direction === 'IN') {
    if (status === 'PENDING') return ['DEPOSIT', 'CLEAR', 'BOUNCE', 'RETURN']
    if (status === 'DEPOSITED') return ['CLEAR', 'BOUNCE']
    if (status === 'CLEARED') return ['BOUNCE']
    return []
  }
  if (status === 'PENDING') return ['CLEAR', 'BOUNCE', 'CANCEL']
  if (status === 'CLEARED') return ['BOUNCE']
  return []
}

// What the move posts, in words, so the user knows which balances change before confirming.
export function actionEffect(cheque: Pick<Cheque, 'direction' | 'status'>, action: ChequeAction, ar: boolean) {
  const received = cheque.direction === 'IN'
  if (action === 'DEPOSIT') return ar ? 'يُسلَّم الشيك إلى الحساب البنكي المختار، ولا يتغير أي رصيد حتى يُصرف.' : 'The cheque goes to the chosen bank treasury. No balance moves until it clears.'
  if (action === 'CLEAR') return received
    ? (ar ? 'يزيد رصيد البنك وينخفض حساب الشيكات برسم التحصيل.' : 'The bank balance goes up and cheques under collection go down.')
    : (ar ? 'ينخفض رصيد البنك وحساب الشيكات المستحقة الدفع.' : 'The bank balance and cheques payable go down.')
  if (cheque.status === 'CLEARED') return received
    ? (ar ? 'يُعكس المبلغ من البنك ويعود دَيناً على العميل.' : 'The amount comes back out of the bank and the customer owes it again.')
    : (ar ? 'يعود المبلغ إلى البنك ويعود مستحقاً للمورد.' : 'The amount comes back into the bank and is owed to the supplier again.')
  return received
    ? (ar ? 'يعود المبلغ دَيناً على العميل وينخفض حساب الشيكات برسم التحصيل.' : 'The customer owes the amount again and cheques under collection go down.')
    : (ar ? 'يعود المبلغ مستحقاً للمورد وينخفض حساب الشيكات المستحقة الدفع.' : 'The supplier is owed the amount again and cheques payable go down.')
}

export const isOpen = (status: ChequeStatus) => status === 'PENDING' || status === 'DEPOSITED'
export const money = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// The shop's local day, as the server dates moves.
export const today = () => localDate()
export const addDays = (date: string, days: number) => new Date(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)

// Amounts per currency, e.g. "1,250.00 AED · 80.00 USD".
export function sumByCurrency(rows: Cheque[]) {
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(row.currencySymbol, (totals.get(row.currencySymbol) ?? 0) + row.amount)
  return [...totals].map(([symbol, amount]) => `${money(amount)} ${symbol}`).join(' · ')
}

// Received and issued totals per due date and currency, leaving out cheques that bounced, went back or were cancelled.
export function dueDateTotals(rows: Cheque[]) {
  const totals = new Map<string, { dueDate: string; currencySymbol: string; received: number; issued: number; count: number }>()
  for (const row of rows) {
    if (row.status === 'BOUNCED' || row.status === 'RETURNED' || row.status === 'CANCELLED') continue
    const dueDate = row.dueDate.slice(0, 10)
    const key = `${dueDate}|${row.currencySymbol}`
    const total = totals.get(key) ?? { dueDate, currencySymbol: row.currencySymbol, received: 0, issued: 0, count: 0 }
    if (row.direction === 'IN') total.received += row.amount; else total.issued += row.amount
    total.count += 1
    totals.set(key, total)
  }
  return [...totals.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.currencySymbol.localeCompare(b.currencySymbol))
}
