// The API answers errors with RFC 9457 problem details; show their detail instead of the raw JSON body.
export async function readProblem(response: Response, fallback?: string) {
  const otherwise = fallback ?? (response.status === 403 ? 'You do not have permission to do this.' : `Request failed (${response.status})`)
  try {
    const text = await response.text()
    try { const body = JSON.parse(text) as { detail?: string; title?: string }; return body.detail ?? body.title ?? otherwise } catch { return text || otherwise }
  } catch { return otherwise }
}
