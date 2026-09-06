import { Container, PageShell } from '../../ui/page-shell'
import { AuthCard } from './auth-card'

const FEATURES = [
  {
    title: 'Every click, with context',
    body: 'Referrer, country, device and browser are recorded on the redirect itself — not sampled, not estimated, not sold to anyone.',
    icon: 'M3 16.5 8 11l3.5 3.5L17 8m0 0h-4m4 0v4',
  },
  {
    title: 'Tags and expiry dates',
    body: 'Group a campaign under one tag and give a promo link a lifetime. When it runs out, visitors get a plain explanation instead of a dead page.',
    icon: 'M4 7.5A2.5 2.5 0 0 1 6.5 5h3.1l6.4 6.4-4.6 4.6L5 9.6V7.5Zm2.9.4h.01',
  },
  {
    title: 'A QR code for the paper world',
    body: 'Every link renders as a scalable QR you can drop into a slide or a poster, generated on the server and never leaving your domain.',
    icon: 'M5 5h4v4H5zM11 5h4v4h-4zM5 11h4v4H5zm6 3h1.5m1.5 0H15m0-3v.01M13 11h.01',
  },
  {
    title: 'Yours to host',
    body: 'One Node process and one Postgres database. No third-party pixel, no vendor that can rewrite your destinations or shut the links off.',
    icon: 'M4 6.5C4 5.1 6.7 4 10 4s6 1.1 6 2.5v7C16 14.9 13.3 16 10 16s-6-1.1-6-2.5v-7Zm12 0C16 7.9 13.3 9 10 9S4 7.9 4 6.5',
  },
]

const STEPS = [
  { title: 'Paste a URL', body: 'Add a tag, a custom code and an expiry date if you want them. Everything except the URL is optional.' },
  { title: 'Share the short link', body: 'Copy it, or grab the QR code. Redirects are a single database lookup and a 302.' },
  { title: 'Watch the dashboard', body: 'Clicks per day, unique visitors, and where they came from — visible the moment the first one lands.' },
]

const STACK = [
  ['Hono', 'the HTTP layer, on Node'],
  ['Drizzle ORM', 'schema and migrations in TypeScript'],
  ['Postgres', 'arrays, GIN indexes, real aggregates'],
  ['React 19', 'the dashboard, typed from the server'],
]

export function Landing({
  onSignIn,
  onSignUp,
}: {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
}) {
  return (
    <PageShell>
      <Container className="grid items-start gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-16 lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1 text-xs font-medium text-text-muted">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            Self-hosted · own API and database
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Short links that tell you <span className="text-accent">what happened next</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-text-muted text-pretty">
            Link Forge shortens a URL, then keeps the part everyone else charges for: who clicked,
            when, from where, and on what. Tags, expiry dates and QR codes come along for free.
          </p>

          <dl className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.title}>
                <dt className="flex items-center gap-2.5 font-medium">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <svg viewBox="0 0 20 20" className="size-4.5" fill="none" aria-hidden="true">
                      <path d={feature.icon} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {feature.title}
                </dt>
                <dd className="mt-2 text-sm text-text-muted text-pretty">{feature.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:sticky lg:top-24">
          <AuthCard onSignIn={onSignIn} onSignUp={onSignUp} />
        </div>
      </Container>

      <section className="border-y border-border bg-surface-raised/60 py-14">
        <Container>
          <h2 className="text-2xl font-semibold tracking-tight">Three steps, no setup</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-border bg-surface p-5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white tnum">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-medium">{step.title}</h3>
                <p className="mt-1.5 text-sm text-text-muted text-pretty">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="py-14">
        <Container className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">What is actually running</h2>
            <p className="mt-3 max-w-md text-text-muted text-pretty">
              No mock data and no fixture files. Clicks are rows in Postgres, the dashboard numbers
              are aggregates over those rows, and the schema is versioned in migrations that run on
              boot. The browser client is generated from the server's route types, so a renamed field
              is a build error rather than a blank card.
            </p>
          </div>
          <dl className="divide-y divide-border rounded-xl border border-border">
            {STACK.map(([name, what]) => (
              <div key={name} className="flex items-baseline gap-4 px-5 py-3.5">
                <dt className="w-28 shrink-0 font-medium">{name}</dt>
                <dd className="text-sm text-text-muted">{what}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>
    </PageShell>
  )
}
