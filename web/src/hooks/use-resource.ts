import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api/client'

export type Resource<T> = {
  data: T | null
  error: string | null
  loading: boolean
  /** True only on the first load, so a refresh does not blank the screen. */
  initial: boolean
  reload: () => Promise<void>
  setData: (updater: (current: T) => T) => void
  replace: (value: T) => void
}

/**
 * One place for the three states every screen needs. Results from a superseded
 * request are dropped, so a fast filter change cannot render stale rows.
 */
export function useResource<T>(load: () => Promise<T>, deps: unknown[]): Resource<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [initial, setInitial] = useState(true)
  const generation = useRef(0)

  const run = useCallback(async () => {
    const current = ++generation.current
    setLoading(true)
    try {
      const result = await load()
      if (current !== generation.current) return
      setData(result)
      setError(null)
    } catch (cause) {
      if (current !== generation.current) return
      setError(errorMessage(cause))
    } finally {
      if (current === generation.current) {
        setLoading(false)
        setInitial(false)
      }
    }
    // The caller's `deps` are the dependency list on purpose: `load` is a fresh
    // closure on every render, and re-running on that would loop forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, deps)

  useEffect(() => {
    void run()
  }, [run])

  const patch = useCallback((updater: (current: T) => T) => {
    setData((current) => (current === null ? current : updater(current)))
  }, [])

  const replace = useCallback((value: T) => {
    setData(value)
    setError(null)
    setInitial(false)
  }, [])

  return { data, error, loading, initial, reload: run, setData: patch, replace }
}
