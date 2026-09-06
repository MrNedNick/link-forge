import { useState, type FormEvent } from 'react'
import { Button } from '../../components/button/button'
import { Field } from '../../components/field/field'
import { Input } from '../../components/input/input'
import { Modal } from '../../components/modal/modal'
import { Select } from '../../components/select/select'
import { api, errorMessage, unwrap } from '../../api/client'
import type { LinkItem } from '../../api/types'
import { MAX_TITLE_LENGTH } from '../../lib/limits'
import { EXPIRY_OPTIONS, MAX_TAGS, expiryFromDays, formatTags, parseTags } from '../../lib/tags'
import { formatDateTime } from '../../lib/format'

type Expiry = 'keep' | 'clear' | (typeof EXPIRY_OPTIONS)[number]['value']

/**
 * Editing what a link says about itself — its label, its tags, when it stops
 * working. The destination and the code stay fixed on purpose: changing either
 * would silently repoint a link other people have already shared.
 */
export function EditLinkDialog({
  link,
  onClose,
  onSaved,
}: {
  link: LinkItem | null
  onClose: () => void
  onSaved: (link: LinkItem) => void
}) {
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [expiry, setExpiry] = useState<Expiry>('keep')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  // Reset from the link being opened, without an effect that fights React.
  if (link && editing !== link.id) {
    setEditing(link.id)
    setTitle(link.title ?? '')
    setTags(formatTags(link.tags))
    setExpiry('keep')
    setError(null)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!link) return
    setError(null)
    setBusy(true)
    try {
      const { link: updated } = await unwrap(
        await api.api.links[':id'].$patch({
          param: { id: link.id },
          json: {
            title: title.trim() || null,
            tags: parseTags(tags),
            ...(expiry === 'keep'
              ? {}
              : { expiresAt: expiry === 'clear' ? null : expiryFromDays(expiry) }),
          },
        }),
      )
      onSaved(updated as LinkItem)
      onClose()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={link !== null}
      onClose={onClose}
      size="sm"
      title={link ? `Edit /${link.code}` : 'Edit link'}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {/* Submits through the form, not through an onClick as well — two
              handlers on one button is how a request gets sent twice. */}
          <Button size="sm" type="submit" form="edit-link-form" loading={busy}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-link-form" onSubmit={save} className="space-y-4" noValidate>
        <p className="-mt-1 truncate text-sm text-text-muted" title={link?.url}>
          Points at {link?.url}
        </p>

        <Field label="Label" hint="Only you see this." error={error ?? undefined}>
          <Input
            name="title"
            maxLength={MAX_TITLE_LENGTH}
            placeholder="Spring campaign"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <Field label="Tags" hint={`Comma separated, up to ${MAX_TAGS}.`}>
          <Input
            name="tags"
            placeholder="marketing, launch"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
        </Field>

        <Field
          label="Expiry"
          hint={
            link?.expiresAt
              ? `Currently ends ${formatDateTime(link.expiresAt)}.`
              : 'Currently never expires.'
          }
        >
          <Select
            name="expiry"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value as Expiry)}
          >
            <option value="keep">Leave as it is</option>
            {link?.expiresAt && <option value="clear">Never expire</option>}
            {EXPIRY_OPTIONS.filter((option) => option.value).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  )
}
