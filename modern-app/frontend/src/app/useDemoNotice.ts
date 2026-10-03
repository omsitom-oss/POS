import { useEffect, useState } from 'react'

export function useDemoNotice() {
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])
  return { notice, showNotice: setNotice }
}
