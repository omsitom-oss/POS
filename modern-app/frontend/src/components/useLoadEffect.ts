import { useEffect } from 'react'

/**
 * Runs an API loader on mount and again whenever the loader changes (wrap it in useCallback with its inputs).
 * Loaders set their loading/error/result state while the request runs, which the set-state-in-effect rule
 * cannot tell apart from deriving state in an effect, so this is the one place that pattern lives.
 */
export function useLoadEffect(load: () => Promise<unknown>) {
  useEffect(() => { void load() }, [load])
}
