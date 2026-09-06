import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../components/button/button'
import { Field } from '../../components/field/field'
import { Input } from '../../components/input/input'
import { errorMessage } from '../../api/client'

export const DEMO = { email: 'demo@link-forge.dev', password: 'forge-demo-2026' }

type Mode = 'signin' | 'signup'

export function AuthCard({
  onSignIn,
  onSignUp,
}: {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
}) {
  const id = useId()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent, credentials = { email, password }) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await (mode === 'signin' ? onSignIn : onSignUp)(credentials.email, credentials.password)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const useDemo = async (event: FormEvent) => {
    setMode('signin')
    setEmail(DEMO.email)
    setPassword(DEMO.password)
    await submit(event, DEMO)
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-7">
      <div
        role="tablist"
        aria-label="Account"
        className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-surface-raised p-1 text-sm font-medium"
      >
        {(['signin', 'signup'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            id={`${id}-tab-${value}`}
            aria-selected={mode === value}
            aria-controls={`${id}-panel`}
            onClick={() => {
              setMode(value)
              setError(null)
            }}
            className={
              mode === value
                ? 'rounded-md bg-surface px-3 py-1.5 shadow-sm'
                : 'rounded-md px-3 py-1.5 text-text-muted hover:text-text'
            }
          >
            {value === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <form id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${mode}`} onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" required>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>

        <Field
          label="Password"
          required
          hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
          error={error ?? undefined}
        >
          <Input
            type="password"
            name="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </Field>

        <Button type="submit" className="w-full" loading={busy}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <div className="mt-5 border-t border-border pt-5">
        <Button variant="outline" className="w-full" onClick={useDemo} disabled={busy}>
          Open the demo account
        </Button>
        <p className="mt-2 text-center text-xs text-text-muted">
          Ten links and three months of click history, already seeded.
        </p>
      </div>
    </div>
  )
}
