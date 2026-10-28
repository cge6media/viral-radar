# Alerts (Viral Radar 4.0)

In-app alerts need no credentials: every collection computes `alerts` (rolling 7 days, deduplicated per subject with
a 48-hour cooldown) and the app shows what is new since your last visit (bookkeeping stays in your browser).

| kind | threshold |
|---|---|
| new_hit | a tracked video crossed its age-appropriate hit floor in the last 24 h (floor: 1M views at ≤24 h → 5M at 30 days) |
| acceleration | measured velocity ≥ 20K views/h and ≥ 2.5× the previous interval, ≥ 50K views gained in it |
| creator_outlier | ≥ 100× the creator's median recent upload (or ≥ 50× with ≥ 2M views), ≤ 7 days old; the five strongest per run |
| format_spreading | a repeatable format or meme gained ≥ 3 independent creators in 48 h and is actionable |
| category_momentum | a category wave with ≥ 3 independent creators measured at ≥ 2× growth |
| resurfacing | a video older than a week gaining ≥ 10K views/h, ≥ 3× its lifetime average |

## Optional external delivery (free, off by default)

1. Create a Discord webhook (Server settings → Integrations → Webhooks) **or** a Telegram bot (`@BotFather`) and get
   your chat id; the URL is `https://api.telegram.org/bot<token>/sendMessage?chat_id=<id>`.
2. Repository → Settings → Secrets and variables → Actions: add the **secret** `ALERT_WEBHOOK_URL` and the
   **variable** `VR_ALERT_WEBHOOK = 1`.
3. Each collection then posts its new high-severity alerts (≤ 10) via `pipeline/src/tools/notify.ts`. A failed
   notification never fails a collection; the URL is never logged. Nothing else is required and nothing is paid.
