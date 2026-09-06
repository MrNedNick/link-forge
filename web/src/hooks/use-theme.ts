import { useCallback, useEffect } from 'react'
import { useLocalStorage } from '../lib/use-local-storage'

export type Theme = 'light' | 'dark' | 'system'

const apply = (theme: Theme) => {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  if (theme !== 'system') root.classList.add(theme)
}

/** Three states, not two: "system" has to stay reachable once you leave it. */
export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>('link-forge:theme', 'system')

  useEffect(() => {
    apply(theme)
  }, [theme])

  const cycle = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light'))
  }, [setTheme])

  return { theme, setTheme, cycle }
}
