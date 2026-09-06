import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Logo } from './logo'
import { ThemeToggle } from './theme-toggle'

export const REPO_URL = 'https://github.com/MrNedNick/link-forge'

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6', className)}>{children}</div>
}

export function Header({ actions }: { actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-3">
        <a href="/" className="flex items-center gap-2.5 rounded-md font-semibold tracking-tight">
          <Logo />
          <span className="text-base">
            Link<span className="text-accent">Forge</span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          {actions}
          <ThemeToggle />
        </div>
      </Container>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border py-8 text-sm text-text-muted">
      <Container className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Link Forge — short links with the analytics that make them worth shortening.
        </p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a className="rounded hover:text-text" href={REPO_URL}>
            Source
          </a>
          <a className="rounded hover:text-text" href={`${REPO_URL}#readme`}>
            README
          </a>
          <a className="rounded hover:text-text" href="/health">
            API health
          </a>
        </nav>
      </Container>
    </footer>
  )
}

export function PageShell({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a className="skip-link rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent" href="#main">
        Skip to content
      </a>
      <Header actions={actions} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
