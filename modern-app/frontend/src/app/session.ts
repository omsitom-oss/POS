import type { AuthSession } from '../features/auth/LoginPage'

const sessionKey = 'elite-pos-session'
export const sessionExpiredEvent = 'elite-pos-session-expired'

export function readSession(): AuthSession | null {
  try {
    const value = localStorage.getItem(sessionKey)
    const session = value ? JSON.parse(value) as AuthSession : null
    // Sessions saved before the API issued tokens cannot call it; sign in again.
    return session?.token ? session : null
  } catch { return null }
}

export function saveSession(session: AuthSession) {
  try { localStorage.setItem(sessionKey, JSON.stringify(session)) } catch { /* The session still works until the page reloads. */ }
}

export function clearSession() {
  try { localStorage.removeItem(sessionKey) } catch { /* Nothing stored. */ }
}

function isApiRequest(url: string) {
  const parsed = new URL(url, window.location.origin)
  return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/')
}

// Adds the bearer token to every same-origin /api request, so feature pages keep calling fetch() directly.
// A 401 from the API means the session ended (expired, signed out elsewhere, user deactivated).
export function installAuthFetch() {
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!isApiRequest(url)) return originalFetch(input, init)
    const token = readSession()?.token
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
    const response = await originalFetch(input, { ...init, headers })
    if (response.status === 401 && token && !url.includes('/api/auth/login')) {
      clearSession()
      window.dispatchEvent(new Event(sessionExpiredEvent))
    }
    return response
  }
}
