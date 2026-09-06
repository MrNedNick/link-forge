import { useCallback, useMemo, useSyncExternalStore, type SetStateAction } from 'react'
import { MISSING, storeFor, type Stored } from './core/local-storage-store'

const subscribeToHydration = () => () => undefined

/**
 * State that survives a reload. SSR-safe: the server snapshot is the initial
 * value, so markup hydrates deterministically and React then reads the browser
 * snapshot without a setState-in-effect pass. Storage being unavailable
 * (private mode, blocked cookies) degrades to in-memory state instead of
 * throwing. The fourth element is false until hydration, for UI that must not
 * differ between server and first client render.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const store = useMemo(() => storeFor<T>(key), [key])

  const stored = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => MISSING as Stored<T>,
  )
  const value = stored === MISSING ? initial : stored

  const set = useCallback(
    (next: SetStateAction<T>) => {
      const current = store.getSnapshot()
      const resolved =
        typeof next === 'function'
          ? (next as (current: T) => T)(current === MISSING ? initial : current)
          : next
      try {
        store.write(JSON.stringify(resolved))
      } catch {
        /* value is not serialisable — nothing to persist */
      }
    },
    [store, initial],
  )

  const reset = useCallback(() => store.write(null), [store])

  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false)

  return [value, set, reset, hydrated] as const
}
