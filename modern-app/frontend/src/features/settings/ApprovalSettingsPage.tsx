import { useEffect, useState } from 'react'
import { Button, Card, LoadingState, SwitchInput } from '../../components/shared'
import { PageHeader, type Locale } from '../../layouts/AppLayout'

type Approval = { requestType: string; requiresApproval: boolean; updatedAt: string }
const labels: Record<string, [string, string]> = {
  INVENTORY_DISPOSAL: ['إتلاف المخزون', 'Inventory disposal'],
  PURCHASE_RETURN: ['إرجاع المشتريات', 'Purchase return'],
  EXPENSE: ['المنصرفات', 'Expenses'],
  RECEIPT: ['الإيصالات', 'Receipts'],
}

export function ApprovalSettingsPage({ locale, onBack }: { locale: Locale; onBack: () => void }) {
  const ar = locale === 'ar'; const [rows, setRows] = useState<Approval[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(''); const [error, setError] = useState('')
  useEffect(() => { fetch('/api/approvals').then(async response => { if (!response.ok) throw new Error('load'); return response.json() as Promise<Approval[]> }).then(setRows).catch(() => setError(ar ? 'تعذر تحميل سياسات الموافقة.' : 'Could not load approval policies.')).finally(() => setLoading(false)) }, [ar])
  async function change(row: Approval, required: boolean) { setSaving(row.requestType); setError(''); try { const response = await fetch(`/api/approvals/${encodeURIComponent(row.requestType)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requiresApproval: required }) }); if (!response.ok) throw new Error('save'); const updated = await response.json() as Approval; setRows(current => current.map(item => item.requestType === updated.requestType ? updated : item)) } catch { setError(ar ? 'تعذر حفظ السياسة.' : 'Could not save the policy.') } finally { setSaving('') } }
  return <div className="settings-page" dir={ar ? 'rtl' : 'ltr'}><PageHeader eyebrow={ar ? 'الإعدادات' : 'SETTINGS'} title={ar ? 'سياسات الموافقات' : 'Approval policies'} description={ar ? 'حدد العمليات التي تنشئ طلباً للمراجعة قبل تأثيرها على المخزون والحسابات.' : 'Choose which operations create a review request before affecting stock and accounts.'} actions={<Button variant="secondary" onClick={onBack}>{ar ? 'العودة للإعدادات' : 'Back to settings'}</Button>} />{error && <div className="form-error" role="alert">{error}</div>}{loading ? <LoadingState /> : <div className="settings-type-grid">{rows.map(row => { const title = labels[row.requestType]?.[ar ? 0 : 1] ?? row.requestType; return <Card key={row.requestType} className="setting-type-card"><div className="setting-type-card-heading"><strong>{title}</strong><span className="setting-card-chevron" aria-hidden="true">{row.requiresApproval ? '✓' : '—'}</span></div><p className="setting-type-description">{ar ? (row.requiresApproval ? 'يتطلب موافقة المسؤول قبل الترحيل.' : 'يترحل مباشرة عند الحفظ.') : (row.requiresApproval ? 'Requires supervisor approval before posting.' : 'Posts directly when saved.')}</p><SwitchInput label={ar ? 'يتطلب موافقة' : 'Requires approval'} checked={row.requiresApproval} disabled={saving === row.requestType} onChange={event => void change(row, event.target.checked)} /></Card> })}</div>}</div>
}
