import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateLinkForm } from '../features/links/create-link-form'
import type * as ApiClient from '../api/client'

const create = vi.fn()

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof ApiClient>('../api/client')
  return { ...actual, api: { api: { links: { $post: (...args: unknown[]) => create(...args) } } } }
})

const ok = (link: Record<string, unknown>, reused = false) => ({
  ok: true,
  status: reused ? 200 : 201,
  json: async () => ({ link, reused }),
})

const failure = (status: number, error: Record<string, unknown>) => ({
  ok: false,
  status,
  json: async () => ({ error }),
})

const renderForm = (onCreated = vi.fn()) => {
  render(<CreateLinkForm knownTags={['launch']} onCreated={onCreated} />)
  return { onCreated, user: userEvent.setup() }
}

const urlBox = () => screen.getByPlaceholderText('example.com/a-very-long-address')

beforeEach(() => {
  create.mockReset()
  create.mockResolvedValue(ok({ id: '1', code: 'abc', shortUrl: 'http://localhost:8787/abc' }))
})

describe('CreateLinkForm', () => {
  it('sends the pasted address and reports the created link', async () => {
    const { onCreated, user } = renderForm()

    await user.type(urlBox(), 'example.com/pricing')
    await user.click(screen.getByRole('button', { name: 'Shorten' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(create).toHaveBeenCalledWith({
      json: { url: 'example.com/pricing', code: undefined, title: undefined, tags: [], expiresAt: null },
    })
    expect(onCreated.mock.calls[0]?.[1]).toBe(false)
  })

  it('empties the field afterwards, so the next paste starts clean', async () => {
    const { user } = renderForm()
    await user.type(urlBox(), 'example.com/pricing')
    await user.click(screen.getByRole('button', { name: 'Shorten' }))
    await waitFor(() => expect(urlBox()).toHaveValue(''))
  })

  it('passes the custom code, label, parsed tags and expiry from the advanced panel', async () => {
    const { user } = renderForm()

    await user.type(urlBox(), 'example.com/spring')
    await user.click(screen.getByRole('button', { name: /Custom code, tags and expiry/ }))
    await user.type(screen.getByPlaceholderText('spring-sale'), 'spring')
    await user.type(screen.getByPlaceholderText('Spring campaign'), 'Spring push')
    await user.type(screen.getByPlaceholderText('marketing, launch'), 'Marketing, marketing  LAUNCH')
    await user.selectOptions(screen.getByLabelText('Expires'), '7')
    await user.click(screen.getByRole('button', { name: 'Shorten' }))

    await waitFor(() => expect(create).toHaveBeenCalled())
    const sent = create.mock.calls[0]?.[0].json
    expect(sent.code).toBe('spring')
    expect(sent.title).toBe('Spring push')
    expect(sent.tags).toEqual(['marketing', 'launch'])
    expect(new Date(sent.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('shows a rejected code as a sentence next to the field', async () => {
    create.mockResolvedValue(failure(409, { code: 'conflict', message: '“spring” is already taken.' }))
    const { onCreated, user } = renderForm()

    await user.type(urlBox(), 'example.com/x')
    await user.click(screen.getByRole('button', { name: 'Shorten' }))

    expect(await screen.findByText('“spring” is already taken.')).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
    expect(urlBox()).toHaveValue('example.com/x')
  })

  it('puts a code error under the code field and reopens the panel that holds it', async () => {
    create.mockResolvedValue(
      failure(409, { code: 'conflict', message: '“spring” is already taken.', field: 'code' }),
    )
    const { user } = renderForm()

    await user.click(screen.getByRole('button', { name: /Custom code, tags and expiry/ }))
    await user.type(screen.getByPlaceholderText('spring-sale'), 'spring')
    await user.type(urlBox(), 'example.com/x')
    // Collapsing the panel must not hide the answer to what went wrong.
    await user.click(screen.getByRole('button', { name: /Custom code, tags and expiry/ }))
    await user.click(screen.getByRole('button', { name: 'Shorten' }))

    const code = await screen.findByPlaceholderText('spring-sale')
    expect(code).toHaveAccessibleDescription('“spring” is already taken.')
    expect(code).toHaveAttribute('aria-invalid', 'true')
    expect(urlBox()).not.toHaveAttribute('aria-invalid')
  })

  it('shows the validator message when the destination is refused', async () => {
    create.mockResolvedValue(
      failure(422, { code: 'invalid', message: 'Only http and https links can be shortened.', field: 'url' }),
    )
    const { user } = renderForm()

    await user.type(urlBox(), 'javascript:alert(1)')
    await user.click(screen.getByRole('button', { name: 'Shorten' }))

    expect(await urlBox()).toHaveAccessibleDescription('Only http and https links can be shortened.')
  })

  it('tells the caller when the API handed back a link that already existed', async () => {
    create.mockResolvedValue(ok({ id: '1', code: 'abc', shortUrl: 'http://localhost:8787/abc' }, true))
    const { onCreated, user } = renderForm()

    await user.type(urlBox(), 'example.com/again')
    await user.click(screen.getByRole('button', { name: 'Shorten' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(onCreated.mock.calls[0]?.[1]).toBe(true)
  })

  it('stops the field at the length the server accepts', () => {
    renderForm()
    expect(urlBox()).toHaveAttribute('maxlength', '2048')
  })
})
