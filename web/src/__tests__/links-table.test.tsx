import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialogProvider } from '../components/confirm-dialog/confirm-dialog'
import { ToastProvider } from '../components/toast/toast'
import { LinksTable } from '../features/links/links-table'
import type * as ApiClient from '../api/client'
import type { LinkItem } from '../api/types'

const remove = vi.fn()

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof ApiClient>('../api/client')
  return {
    ...actual,
    api: { api: { links: { ':id': { $delete: (...args: unknown[]) => remove(...args) } } } },
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
    tags: ['launch'],
    expiresAt: null,
    createdAt: new Date().toISOString(),
    clicks: 128,
    visitors: 96,
    sparkline: [1, 4, 2, 9],
    expired: false,
    ...overrides,
  }) as LinkItem

const renderTable = (props: Partial<Parameters<typeof LinksTable>[0]> = {}) =>
  render(
    <ToastProvider>
      <ConfirmDialogProvider>
        <LinksTable
          links={[link()]}
          loading={false}
          filtered={false}
          onDeleted={props.onDeleted ?? vi.fn()}
          onShowQr={vi.fn()}
          onShowStats={vi.fn()}
          onClearFilters={vi.fn()}
          {...props}
        />
      </ConfirmDialogProvider>
    </ToastProvider>,
  )

beforeEach(() => {
  remove.mockReset()
  // A real 204 carries no body, so json() rejects. Mocking it any other way
  // hides exactly the bug this asserts against.
  remove.mockResolvedValue({
    ok: true,
    status: 204,
    json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
  })
})

describe('LinksTable', () => {
  it('shows the short link, its destination and both click counts', () => {
    renderTable()
    expect(screen.getByRole('link', { name: '/launch' })).toHaveAttribute('href', 'http://localhost:8787/launch')
    expect(screen.getByText('128')).toBeInTheDocument()
    expect(screen.getByText('96 unique')).toBeInTheDocument()
  })

  it('marks a link whose lifetime has run out', () => {
    renderTable({ links: [link({ expired: true, expiresAt: new Date().toISOString() })] })
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('deletes a link only after the confirmation is accepted', async () => {
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    renderTable({ onDeleted })

    await user.click(screen.getByRole('button', { name: 'Delete launch' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Delete /launch?')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(remove).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete launch' }))
    const again = await screen.findByRole('dialog')
    await user.click(within(again).getByRole('button', { name: 'Delete link' }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('link-1'))
    expect(remove).toHaveBeenCalledWith({ param: { id: 'link-1' } })
  })

  it('offers a way out when a filter matches nothing', async () => {
    const user = userEvent.setup()
    const onClearFilters = vi.fn()
    renderTable({ links: [], filtered: true, onClearFilters })

    expect(screen.getByText('Nothing matches that filter')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onClearFilters).toHaveBeenCalled()
  })

  it('invites a first link when the account is empty', () => {
    renderTable({ links: [], filtered: false })
    expect(screen.getByText('No links yet')).toBeInTheDocument()
  })
})
