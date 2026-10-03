import { useState, type FormEvent } from 'react'
import { Button, TextInput } from '../../components/shared'
import type { Locale } from '../../layouts/AppLayout'

export type AuthSession = { userId: number; userName: string; branchId: number; branchCode: string; branchNameAr: string; branchNameEn: string; mustChangePassword: boolean; roleIds: number[] }

export function LoginPage({ locale, onLogin, themeMode, onLocaleChange, onThemeModeChange }: { locale: Locale; onLogin: (session: AuthSession) => void; themeMode: 'light' | 'dark'; onLocaleChange: (locale: Locale) => void; onThemeModeChange: (mode: 'light' | 'dark') => void }) {
  const ar = locale === 'ar'
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!identifier.trim() || !password) { setError(ar ? 'أدخل اسم المستخدم وكلمة المرور.' : 'Enter your username and password.'); return }
    setBusy(true); setError('')
    try { const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password }) }); if (!response.ok) throw new Error(ar ? 'بيانات الدخول غير صحيحة.' : 'Invalid username or password.'); const session = await response.json() as AuthSession; localStorage.setItem('elite-pos-session', JSON.stringify(session)); onLogin(session) } catch (reason) { setError(reason instanceof Error ? reason.message : (ar ? 'تعذر تسجيل الدخول.' : 'Could not sign in.')) } finally { setBusy(false) }
  }
  return <main className="login-screen" dir={ar ? 'rtl' : 'ltr'}><div className="login-controls"><button type="button" onClick={() => onThemeModeChange(themeMode === 'light' ? 'dark' : 'light')} aria-label={ar ? 'تبديل الوضع' : 'Toggle theme'}>{themeMode === 'light' ? '☾' : '☀'}</button><button type="button" onClick={() => onLocaleChange(ar ? 'en' : 'ar')} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}>{ar ? 'EN' : 'ع'}</button></div><div className="login-decoration" aria-hidden="true"><span className="login-orbit orbit-one" /><span className="login-orbit orbit-two" /><span className="login-orbit orbit-three" /><span className="login-glow" /></div><section className="login-panel"><div className="login-brand"><span className="login-mark">E</span><div><strong>Elite POS</strong><small>{ar ? 'نظام نقاط البيع' : 'Point of sale'}</small></div></div><div className="login-heading"><h1>{ar ? 'مرحبًا بعودتك' : 'Welcome back'}</h1><p>{ar ? 'سجّل الدخول للمتابعة إلى مساحة العمل.' : 'Sign in to continue to your workspace.'}</p></div><form className="login-form" onSubmit={submit}><label>{ar ? 'البريد الإلكتروني أو رقم الهاتف' : 'Email or phone number'}<span className="login-input"><span className="login-input-icon">♙</span><TextInput autoFocus value={identifier} onChange={event => setIdentifier(event.target.value)} autoComplete="username" /></span></label><label>{ar ? 'كلمة المرور' : 'Password'}<span className="login-input"><span className="login-input-icon">▣</span><TextInput type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" /></span></label>{error && <p className="login-error" role="alert">{error}</p>}<Button type="submit" variant="primary" loading={busy} className="login-submit">{ar ? 'تسجيل الدخول' : 'Login'} <span aria-hidden="true">→</span></Button></form></section></main>
}
