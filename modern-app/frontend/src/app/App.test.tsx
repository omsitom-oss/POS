import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockFetch } from '../test/fetchMock'
import App from './App'

const session = { userId: 7, userName: 'Mona', branchId: 1, branchCode: 'B1', branchNameAr: 'الفرع الرئيسي', branchNameEn: 'Main branch', mustChangePassword: false, roleIds: [1], permissions: ['SALES_VIEW'], token: 'token-1', expiresAt: '2030-01-01T00:00:00Z' }
const health = { method: 'GET', path: '/api/health', body: { provider: 'SQLite', connected: true, message: 'ok' } }

describe('App', () => {
  it('shows the login screen when there is no saved session', () => {
    mockFetch([health])
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('switches the document to RTL Arabic and back', async () => {
    mockFetch([health])
    render(<App />)
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    await userEvent.click(screen.getByRole('button', { name: 'التبديل إلى العربية' }))
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    expect(document.documentElement).toHaveAttribute('lang', 'ar')
    expect(screen.getByRole('heading', { name: 'مرحبًا بعودتك' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Switch to English' }))
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
  })

  it('persists the theme choice', async () => {
    mockFetch([health])
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Toggle theme' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('elite-pos-theme')).toBe('dark')
  })

  it('signs in and opens the workspace', async () => {
    window.history.replaceState(null, '', '/design-lab')
    const fetchMock = mockFetch([health, { method: 'POST', path: '/api/auth/login', body: session }])
    render(<App />)
    await userEvent.type(screen.getByLabelText(/Username, email or phone/), 'mona')
    await userEvent.type(screen.getByLabelText(/^Password/), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /Sign in/ }))
    expect(await screen.findByTitle('Log out')).toBeInTheDocument()
    expect(screen.getByText('Main branch')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/auth/login')!
    expect(JSON.parse(String(init?.body))).toEqual({ identifier: 'mona', password: 'secret' })
  })

  it('keeps the user on the login screen when sign-in fails', async () => {
    mockFetch([health, { method: 'POST', path: '/api/auth/login', status: 401 }])
    render(<App />)
    await userEvent.type(screen.getByLabelText(/Username, email or phone/), 'mona')
    await userEvent.type(screen.getByLabelText(/^Password/), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /Sign in/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.')
    expect(screen.queryByTitle('Log out')).not.toBeInTheDocument()
  })

  it('asks for both fields before calling the service', async () => {
    const fetchMock = mockFetch([health])
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /Sign in/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your username and password.')
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/auth/login')).toBe(false)
  })

  it('logs out and returns to the login screen', async () => {
    window.history.replaceState(null, '', '/design-lab')
    localStorage.setItem('elite-pos-session', JSON.stringify(session))
    mockFetch([health])
    render(<App />)
    await userEvent.click(screen.getByTitle('Log out'))
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem('elite-pos-session')).toBeNull())
  })
})
