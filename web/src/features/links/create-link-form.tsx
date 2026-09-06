import { useState, type FormEvent } from 'react'
import { Button } from '../../components/button/button'
import { Field } from '../../components/field/field'
import { Input } from '../../components/input/input'
import { Select } from '../../components/select/select'
import { api, errorField, errorMessage, unwrap } from '../../api/client'
import type { LinkItem } from '../../api/types'
import { EXPIRY_OPTIONS, MAX_TAGS, expiryFromDays, parseTags } from '../../lib/tags'
import { MAX_CODE_LENGTH, MAX_TITLE_LENGTH, MAX_URL_LENGTH } from '../../lib/limits'


export function CreateLinkForm({
  knownTags,
  onCreated,
}: {
  knownTags: string[]
  onCreated: (link: LinkItem, reused: boolean) => void
}) {
  const [url, setUrl] = useState('')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [expiry, setExpiry] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [error, setError] = useState<{ message: string; field?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // An error about the custom code belongs under the custom code, not under the
  // destination — the server says which field it is, so use it.
  const errorFor = (name: string) =>
    error && (error.field === name || (error.field === undefined && name === 'url'))
      ? error.message
      : undefined

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { link, reused } = await unwrap(
        await api.api.links.$post({
          json: {
            url,
            code: code.trim() || undefined,
            title: title.trim() || undefined,
            tags: parseTags(tags),
            expiresAt: expiryFromDays(expiry),
          },
        }),
      )
      onCreated(link as LinkItem, reused)
      setUrl('')
      setCode('')
      setTitle('')
      setTags('')
      setExpiry('')
      setAdvanced(false)
    } catch (cause) {
      const field = errorField(cause)
      setError({ message: errorMessage(cause), field })
      // A hidden panel would swallow the message that explains the failure.
      if (field && field !== 'url') setAdvanced(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-4 sm:p-5" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Field label="Destination URL" className="flex-1" error={errorFor('url')} required>
          <Input
            name="url"
            inputMode="url"
            maxLength={MAX_URL_LENGTH}
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
          <Field label="Custom code" hint="Leave empty for a random one." error={errorFor('code')}>
            <Input
              name="code"
              maxLength={MAX_CODE_LENGTH}
              placeholder="spring-sale"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>
          <Field label="Label" hint="Only you see this." error={errorFor('title')}>
            <Input
              name="title"
              maxLength={MAX_TITLE_LENGTH}
              placeholder="Spring campaign"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field label="Tags" hint={`Comma separated, up to ${MAX_TAGS}.`} error={errorFor('tags')}>
            <Input
              name="tags"
              list="known-tags"
              placeholder="marketing, launch"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </Field>
          <Field label="Expires" error={errorFor('expiresAt')}>
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
