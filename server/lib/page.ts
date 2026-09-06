/**
 * Standalone HTML for the two pages a visitor can hit outside the app: an
 * unknown code and an expired one. Inlined on purpose — a redirect endpoint
 * should not depend on the dashboard bundle being built.
 */
export function noticePage({
  status,
  title,
  message,
  code,
  home,
}: {
  status: number
  title: string
  message: string
  code?: string
  home: string
}): Response {
  const escape = (value: string) =>
    value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch)

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · Link Forge</title>
<style>
  :root { color-scheme: light dark; --bg:#ffffff; --fg:#14171c; --muted:#5b6472; --line:#e3e6ea; --accent:#3b6cf6; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#14171c; --fg:#eef1f5; --muted:#9aa4b2; --line:#2b313a; --accent:#5b86ff; }
  }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100dvh; display:grid; place-items:center; padding:24px;
         background:var(--bg); color:var(--fg);
         font:16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width:29rem; text-align:center; }
  .mark { display:inline-flex; align-items:center; gap:.5rem; font-weight:650; letter-spacing:-.01em; margin-bottom:1.75rem; }
  .mark span { width:1.5rem; height:1.5rem; border-radius:7px; background:var(--accent); }
  h1 { font-size:1.5rem; line-height:1.25; margin:0 0 .5rem; letter-spacing:-.02em; }
  p { margin:0 0 1.5rem; color:var(--muted); }
  code { padding:.15em .45em; border:1px solid var(--line); border-radius:6px; font-size:.9em; }
  a { display:inline-block; padding:.6rem 1.1rem; border-radius:10px; background:var(--accent);
      color:#fff; text-decoration:none; font-weight:550; }
  a:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
</style>
</head>
<body>
  <main>
    <p class="mark"><span aria-hidden="true"></span>Link Forge</p>
    <h1>${escape(title)}</h1>
    <p>${escape(message)}${code ? ` The code was <code>${escape(code)}</code>.` : ''}</p>
    <a href="${escape(home)}">Go to Link Forge</a>
  </main>
</body>
</html>`

  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
