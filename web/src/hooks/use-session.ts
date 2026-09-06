import { useCallback } from 'react'
import { api, unwrap } from '../api/client'
import { useResource } from './use-resource'

export type SessionUser = { id: string; email: string; createdAt: string }
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous'

/**
 * `/api/auth/me` answers 200 with a null user for a visitor, so signed-out is a
 * normal result here rather than an error path.
 */
export function useSession() {
  const me = useResource(async () => unwrap(await api.api.auth.me.$get()), [])
  const user = me.data?.user ?? null

  const status: SessionStatus = me.initial ? 'loading' : user ? 'authenticated' : 'anonymous'

  const signIn = useCallback(
    async (email: string, password: string) => {
      me.replace(await unwrap(await api.api.auth.login.$post({ json: { email, password } })))
    },
    [me],
  )

  const signUp = useCallback(
    async (email: string, password: string) => {
      me.replace(await unwrap(await api.api.auth.register.$post({ json: { email, password } })))
    },
    [me],
  )

  const signOut = useCallback(async () => {
    await api.api.auth.logout.$post()
    me.replace({ user: null })
  }, [me])

  return { status, user, error: me.error, refresh: me.reload, signIn, signUp, signOut }
}
