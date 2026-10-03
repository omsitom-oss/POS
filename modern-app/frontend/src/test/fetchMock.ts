import { vi } from 'vitest'

type Route = { method?: string; path: string | RegExp; status?: number; body?: unknown }

// Answers fetch calls from a fixed route table so pages can render without the .NET service.
export function mockFetch(routes: Route[]) {
  const handler = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname + input.search : input.url
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.split('?')[0]
    const route = routes.find(candidate => (candidate.method ?? 'GET').toUpperCase() === method
      && (typeof candidate.path === 'string' ? candidate.path === path : candidate.path.test(path)))
    if (!route) return new Response(`No mock for ${method} ${url}`, { status: 404 })
    const body = route.body === undefined ? '' : typeof route.body === 'string' ? route.body : JSON.stringify(route.body)
    return new Response(body, { status: route.status ?? 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', handler)
  return handler
}
