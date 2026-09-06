import { useTheme, type Theme } from '../hooks/use-theme'

const ICONS: Record<Theme, { path: string; label: string }> = {
  light: { path: 'M10 3v1.5M10 15.5V17M17 10h-1.5M4.5 10H3m11.95-4.95-1.06 1.06M6.11 13.89l-1.06 1.06m9.9 0-1.06-1.06M6.11 6.11 5.05 5.05', label: 'Light theme' },
  dark: { path: 'M15.5 11.6A6 6 0 0 1 8.4 4.5a6 6 0 1 0 7.1 7.1Z', label: 'Dark theme' },
  system: { path: 'M4 5.5h12v7H4zM7.5 15.5h5', label: 'System theme' },
}

export function ThemeToggle() {
  const { theme, cycle } = useTheme()
  const icon = ICONS[theme]

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${icon.label}. Click to change.`}
      title={icon.label}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
    >
      <svg viewBox="0 0 20 20" className="size-4.5" fill="none" aria-hidden="true">
        {theme === 'dark' ? (
          <path d={icon.path} fill="currentColor" />
        ) : (
          <>
            {theme === 'light' && <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1.6" />}
            <path d={icon.path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  )
}
