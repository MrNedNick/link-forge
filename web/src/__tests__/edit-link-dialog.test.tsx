import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditLinkDialog } from '../features/links/edit-link-dialog'
import type { LinkItem } from '../api/types'
import type * as ApiClient from '../api/client'

const patch = vi.fn()

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof ApiClient>('../api/client')
  return {
    ...actual,
    api: { api: { links: { ':id': { $patch: (...args: unknown[]) => patch(...args) } } } },
  }
})

const link = (overrides: Partial<LinkItem> = {}): LinkItem =>
  ({
    id: 'link-1',
    userId: 'user-1',
    code: 'launch',
    url: 'https://example.com/launch',
    shortUrl: 'http://localhost:8787/launch',
    title: 'Launch thread',
    tags: ['launch', 'social'],
    expiresAt: null,
    createdAt: new Date().toISOString(),
    clicks: 4,
    visitors: 3,
    sparkline: [],
    expired: false,
    ...overrides,
  }) as LinkItem

const open = (value = link(), onSaved = vi.fn(), onClose = vi.fn()) => {
  render(<EditLinkDialog link={value} onClose={onClose} onSaved={onSaved} />)
  return { onSaved, onClose, user: userEvent.setup() }
}

beforeEach(() => {
  patch.mockReset()
  patch.mockImplementation(async ({ json }: { json: Record<string, unknown> }) => ({
    ok: true,
    status: 200,
    json: async () => ({ link: { ...link(), ...json } }),
  }))
})

describe('EditLinkDialog', () => {
  it('opens filled in with what the link says today', () => {
    open()
    expect(screen.getByLabelText('Label')).toHaveValue('Launch thread')
    expect(screen.getByLabelText(/^Tags/)).toHaveValue('launch, social')
    expect(screen.getByText('Currently never expires.')).toBeInTheDocument()
  })

  it('saves a new label and normalised tags', async () => {
    const { onSaved, onClose, user } = open()

    await user.clear(screen.getByLabelText('Label'))
    await user.type(screen.getByLabelText('Label'), 'Spring push')
    await user.clear(screen.getByLabelText(/^Tags/))
    await user.type(screen.getByLabelText(/^Tags/), 'Spring, spring, MARKETING')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    // Once, not twice: the button submits the form rather than also calling save.
    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch).toHaveBeenCalledWith({
      param: { id: 'link-1' },
      json: { title: 'Spring push', tags: ['spring', 'marketing'] },
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('leaves the expiry alone unless it is deliberately changed', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(patch).toHaveBeenCalled())
    expect(patch.mock.calls[0]?.[0].json).not.toHaveProperty('expiresAt')
  })

  it('can clear an expiry that is set, and set one that is not', async () => {
    const { user } = open(link({ expiresAt: new Date(Date.now() + 86_400_000).toISOString() }))
    expect(screen.getByText(/Currently ends/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/^Expiry/), 'clear')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(patch).toHaveBeenCalled())
    expect(patch.mock.calls[0]?.[0].json.expiresAt).toBeNull()
  })

  it('sets a future expiry when one of the presets is chosen', async () => {
    const { user } = open()
    await user.selectOptions(screen.getByLabelText(/^Expiry/), '30')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(patch).toHaveBeenCalled())
    const sent = patch.mock.calls[0]?.[0].json.expiresAt as string
    expect(new Date(sent).getTime()).toBeGreaterThan(Date.now())
  })

  it('offers no "never expire" option for a link that never expires', () => {
    open()
    expect(screen.queryByRole('option', { name: 'Never expire' })).not.toBeInTheDocument()
  })

  it('keeps the dialog open and shows why when the API refuses', async () => {
    patch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: { code: 'invalid', message: 'The expiry date is already in the past.' } }),
    })
    const { onSaved, onClose, user } = open()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('The expiry date is already in the past.')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
