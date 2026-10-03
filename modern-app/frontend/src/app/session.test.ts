import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch } from '../test/fetchMock'
import { installAuthFetch, readSession, saveSession, sessionExpiredEvent } from './session'
import type { AuthSession } from '../features/auth/LoginPage'

const session: AuthSession = { userId: 7, userName: 'Mona', branchId: 1, branchCode: 'B1', branchNameAr: 'أ', branchNameEn: 'Main branch', mustChangePassword: false, roleIds: [1], permissions: ['SALES_VIEW'], token: 'token-1', expiresAt: '2030-01-01T00:00:00Z' }

describe('session', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('ignores sessions saved before the API issued tokens', () => {
    localStorage.setItem('elite-pos-session', JSON.stringify({ ...session, token: undefined }))
    expect(readSession()).toBeNull()
  })

  it('adds the bearer token to API calls only', async () => {
    saveSession(session)
    const fetchMock = mockFetch([{ path: '/api/sales', body: [] }, { path: '/other', body: {} }])
    installAuthFetch()
    await fetch('/api/sales')
    await fetch('/other')
    const headersFor = (url: string) => new Headers(fetchMock.mock.calls.find(([input]) => input === url)?.[1]?.headers)
    expect(headersFor('/api/sales').get('Authorization')).toBe('Bearer token-1')
    expect(headersFor('/other').get('Authorization')).toBeNull()
  })

  it('ends the session when the API answers 401', async () => {
    saveSession(session)
    mockFetch([{ path: '/api/sales', status: 401 }])
    installAuthFetch()
    const expired = vi.fn()
    window.addEventListener(sessionExpiredEvent, expired)
    await fetch('/api/sales')
    window.removeEventListener(sessionExpiredEvent, expired)
    expect(expired).toHaveBeenCalledOnce()
    expect(readSession()).toBeNull()
  })
})
