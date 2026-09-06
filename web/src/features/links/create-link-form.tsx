import { useState, type FormEvent } from 'react'
import { Button } from '../../components/button/button'
import { Field } from '../../components/field/field'
import { Input } from '../../components/input/input'
import { Select } from '../../components/select/select'
import { api, errorMessage, unwrap } from '../../api/client'
import type { LinkItem } from '../../api/types'

const EXPIRY_OPTIONS = [
  { value: '', label: 'Never expires' },
  { value: '1', label: 'In 24 hours' },
  { value: '7', label: 'In 7 days' },
  { value: '30', label: 'In 30 days' },
  { value: '90', label: 'In 90 days' },
]

const parseTags = (value: string) =>
  [...new Set(value.split(/[,\s]+/).map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 8)

export function CreateLinkForm({
  knownTags,
  onCreated,
}: {
  knownTags: string[]
  onCreated: (link: LinkItem) => void
}) {
  const [url, setUrl] = useState('')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [expiry, setExpiry] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const expiresAt = expiry
        ? new Date(Date.now() + Number(expiry) * 86_400_000).toISOString()
        : null
      const { link } = await unwrap(
        await api.api.links.$post({
          json: {
            url,
            code: code.trim() || undefined,
            title: title.trim() || undefined,
            tags: parseTags(tags),
            expiresAt,
          },
        }),
      )
      onCreated(link as LinkItem)
      setUrl('')
      setCode('')
      setTitle('')
      setTags('')
      setExpiry('')
      setAdvanced(false)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-4 sm:p-5" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Field label="Destination URL" className="flex-1" error={error ?? undefined} required>
          <Input
            name="url"
            inputMode="url"
            placeholder="example.com/a-very-long-address"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required
          />
        </Field>
        <Button type="submit" loading={busy} className="sm:mt-6.5 sm:w-auto">
          Shorten
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setAdvanced((open) => !open)}
        aria-expanded={advanced}
        className="mt-1 inline-flex items-center gap-1.5 rounded text-xs font-medium text-text-muted hover:text-text"
      >
        <svg
          viewBox="0 0 12 12"
          className={`size-3 transition-transform ${advanced ? 'rotate-90' : ''}`}
          fill="none"
          aria-hidden="true"
        >
          <path d="m4.5 2.5 3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Custom code, tags and expiry
      </button>

      {advanced && (
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Custom code" hint="Leave empty for a random one.">
            <Input
              name="code"
              placeholder="spring-sale"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>
          <Field label="Label" hint="Only you see this.">
            <Input
              name="title"
              placeholder="Spring campaign"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field label="Tags" hint="Comma separated.">
            <Input
              name="tags"
              list="known-tags"
              placeholder="marketing, launch"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </Field>
          <Field label="Expires">
            <Select name="expiry" value={expiry} onChange={(event) => setExpiry(event.target.value)}>
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <datalist id="known-tags">
            {knownTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </div>
      )}
    </form>
  )
}
