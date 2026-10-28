# From public dashboard to subscription product — architecture notes

Viral Radar today is a static site on GitHub Pages fed by a scheduled GitHub Actions collector. That is the right
shape for a single creator's daily tool: free, cloud-only, no servers to babysit. It is **not** a subscription
backend. This note separates what exists from what a paid, multi-user product would need, so the two are not
confused.

## What exists (2.0)

| layer | implementation | limits |
|---|---|---|
| Collection | GitHub Actions cron (every 30 min), Node pipeline, quota ledger for YouTube | Public runner; secrets only in repo settings |
| Storage | NDJSON history + JSON snapshot committed to the repo (35-day / 14-day retention) | Public repository → data is public; no per-user data |
| Delivery | Static site on GitHub Pages, release gate before publish | Anyone with the URL sees the same dashboard |
| Personalisation | Preferences, watchlist, production queue in the viewer's `localStorage` | Per browser only; no sync, no account |
| Manual refresh | Link to the Actions page (requires GitHub sign-in) | No credentials in the browser (the 1.0 PAT field was removed) |

## What a subscription product needs (not built)

1. **Accounts & auth** — an identity provider (e.g. Clerk/Auth0/Supabase Auth or passkeys) in front of an API.
   The static site cannot keep a secret, so any personal data or paid feature must sit behind an API.
2. **Private data store** — preferences, watchlists, production queues, tracked results per user (Postgres via
   Supabase/Neon, or Cloudflare D1). The current `localStorage` model maps 1:1 onto a `user_watchlist` table.
3. **Private trend data** — the public repo would stop holding `data/`. The collector writes to object storage
   (R2/S3) or the database; the API serves windows/trends with entitlement checks (free tier: 7d window, no
   velocity; paid: 24h/48h, velocity, alerts).
4. **Manual refresh / webhooks** — a tiny server function (Cloudflare Worker / Vercel function) holding a scoped
   GitHub token calls `workflow_dispatch` for signed-in users with rate limiting. Never ship the token to a browser.
5. **Billing** — Stripe Checkout + customer portal; webhook → entitlement table. Keep billing state separate
   from trend data.
6. **Alerts** — a "new Strong/Developing microtrend in your interests" email/push after each run; needs the
   per-user interests in the database and an email provider.
7. **Compliance** — platform ToS review for redistributing titles/thumbnails (link out, don't rehost video),
   privacy policy, data deletion.

## Recommended path (cheapest first)

1. Keep the current collector and repo as the *data producer*.
2. Add a Cloudflare Worker (free tier) with D1: user table, watchlist table, `POST /refresh` (dispatches the
   workflow with a server-held token), `GET /me`. Front-end swaps `localStorage` for the API when signed in.
3. Move `data/latest.json` publication to R2 with a short cache and a signed URL for paid windows.
4. Stripe last.

None of this is required for the single-creator use case the product serves today.
