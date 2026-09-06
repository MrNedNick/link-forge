import { ConfirmDialogProvider } from './components/confirm-dialog/confirm-dialog'
import { ToastProvider } from './components/toast/toast'
import { Dashboard } from './features/dashboard/dashboard'
import { Landing } from './features/auth/landing'
import { useSession } from './hooks/use-session'
import { useTheme } from './hooks/use-theme'
import { Logo } from './ui/logo'

function Booting() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex items-center gap-3 text-text-muted">
        <Logo />
        <span className="text-sm">Loading your dashboard…</span>
      </div>
    </div>
  )
}

export function App() {
  const session = useSession()
  // Mounted once at the root so the stored theme applies to every screen.
  useTheme()

  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        {session.status === 'loading' ? (
          <Booting />
        ) : session.user ? (
          <Dashboard user={session.user} onSignOut={() => void session.signOut()} />
        ) : (
          <Landing onSignIn={session.signIn} onSignUp={session.signUp} />
        )}
      </ConfirmDialogProvider>
    </ToastProvider>
  )
}
