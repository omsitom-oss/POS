import { useState, type FormEvent } from 'react'
import { Button, TextInput } from '../../components/shared'
import { Icon } from '../../components/icons'
import type { Locale } from '../../layouts/AppLayout'
import { saveSession } from '../../app/session'

export type AuthSession = { userId: number; userName: string; branchId: number; branchCode: string; branchNameAr: string; branchNameEn: string; mustChangePassword: boolean; roleIds: number[]; permissions: string[]; token: string; expiresAt: string }

export function LoginPage({ locale, onLogin, themeMode, onLocaleChange, onThemeModeChange }: { locale: Locale; onLogin: (session: AuthSession) => void; themeMode: 'light' | 'dark'; onLocaleChange: (locale: Locale) => void; onThemeModeChange: (mode: 'light' | 'dark') => void }) {
  const ar = locale === 'ar'
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!identifier.trim() || !password) { setError(ar ? 'أدخل اسم المستخدم وكلمة المرور.' : 'Enter your username and password.'); return }
    setBusy(true); setError('')
    try { const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password }) }); if (!response.ok) throw new Error(ar ? 'بيانات الدخول غير صحيحة. بعد عدة محاولات فاشلة يُقفل الحساب لبضع دقائق.' : 'Invalid username or password. After several failed attempts the account is locked for a few minutes.'); const session = await response.json() as AuthSession; saveSession(session); onLogin(session) } catch (reason) { setError(reason instanceof Error ? reason.message : (ar ? 'تعذر تسجيل الدخول.' : 'Could not sign in.')) } finally { setBusy(false) }
  }
  return <main className="login-screen" dir={ar ? 'rtl' : 'ltr'}><div className="login-controls"><button type="button" onClick={() => onThemeModeChange(themeMode === 'light' ? 'dark' : 'light')} aria-label={ar ? 'تبديل الوضع' : 'Toggle theme'} title={ar ? 'تبديل الوضع' : 'Toggle theme'}><Icon name={themeMode === 'light' ? 'moon' : 'sun'} size={18} /></button><button type="button" onClick={() => onLocaleChange(ar ? 'en' : 'ar')} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}>{ar ? 'EN' : 'ع'}</button></div><section className="login-panel"><div className="login-brand"><span className="login-mark">E</span><div><strong>Elite POS</strong><small>{ar ? 'نظام نقاط البيع' : 'Point of sale'}</small></div></div><div className="login-heading"><h1>{ar ? 'مرحبًا بعودتك' : 'Welcome back'}</h1><p>{ar ? 'سجّل الدخول للمتابعة إلى مساحة العمل.' : 'Sign in to continue to your workspace.'}</p></div><form className="login-form" onSubmit={submit}><label>{ar ? 'البريد الإلكتروني أو رقم الهاتف' : 'Email or phone number'}<span className="login-input"><span className="login-input-icon" aria-hidden="true"><Icon name="user" size={19} /></span><TextInput autoFocus value={identifier} onChange={event => setIdentifier(event.target.value)} autoComplete="username" /></span></label><label>{ar ? 'كلمة المرور' : 'Password'}<span className="login-input"><span className="login-input-icon" aria-hidden="true"><Icon name="lock" size={19} /></span><TextInput type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" /></span></label>{error && <p className="login-error" role="alert">{error}</p>}<Button type="submit" variant="primary" loading={busy} className="login-submit">{ar ? 'تسجيل الدخول' : 'Sign in'}<Icon name="arrow-right" size={18} className="icon-flip-rtl" /></Button></form></section></main>
}
