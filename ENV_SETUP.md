# Environment Variables — emillavinen.com

Complete setup guide for all environment variables required by the project.

## Ready-to-copy `.env.local` template

```env
# ── AI Features ───────────────────────────────────────────────────────────────

# OpenAI API key — required for SEO engine and content gap analyser
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-...

# Enable/disable the AI SEO engine (defaults to true if not set)
# Set to "false" to disable without removing the API key
SEO_ENGINE_ENABLED=true

# ── Security ──────────────────────────────────────────────────────────────────

# Secret token for protecting cron endpoints from unauthorised access
# Vercel passes this automatically in the Authorization: Bearer <token> header
# Generate with: openssl rand -hex 32
CRON_SECRET=change-me-to-a-secure-random-string

# ── Site ──────────────────────────────────────────────────────────────────────

# Public site URL — used for sitemap pings (only pings in production)
NEXT_PUBLIC_SITE_URL=https://emillavinen.com

# ── GitHub CMS (existing) ─────────────────────────────────────────────────────

# GitHub personal access token for admin CMS (existing feature)
GITHUB_TOKEN=ghp_...

# GitHub repo owner (your GitHub username or org)
GITHUB_OWNER=your-github-username

# GitHub repo name
GITHUB_REPO=emillavinen-com
```

---

## Variable reference

| Variable | Required | Description | Where to get it |
|---|---|---|---|
| `OPENAI_API_KEY` | Required | OpenAI API key for AI SEO and content features | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `SEO_ENGINE_ENABLED` | Optional | Set to `"false"` to disable SEO engine | N/A — set manually |
| `CRON_SECRET` | Required | Protects cron endpoints | `openssl rand -hex 32` |
| `NEXT_PUBLIC_SITE_URL` | Required | Production site URL for sitemap pings | `https://emillavinen.com` |
| `GITHUB_TOKEN` | Required (admin) | GitHub PAT for CMS content editing | GitHub Settings → Developer Settings → PATs |
| `GITHUB_OWNER` | Required (admin) | GitHub username or org | Your GitHub profile |
| `GITHUB_REPO` | Required (admin) | Repository name | Your repo settings |

---

## Vercel Dashboard Setup

Add all variables at: **Settings → Environment Variables**

Variables to add in Vercel:
1. `OPENAI_API_KEY` — Production + Preview
2. `CRON_SECRET` — Production only
3. `SEO_ENGINE_ENABLED` — Production (`true`)
4. `NEXT_PUBLIC_SITE_URL` — Production (`https://emillavinen.com`)
5. `GITHUB_TOKEN` — Production + Preview
6. `GITHUB_OWNER` — Production + Preview
7. `GITHUB_REPO` — Production + Preview

---

## Cron Schedule (vercel.json)

| Endpoint | Schedule | Description |
|---|---|---|
| `/api/cron/seo-engine` | `0 3 * * *` | Daily at 3am UTC — AI SEO enhancement |
| `/api/cron/content-gap` | `0 4 * * 1` | Every Monday at 4am UTC — content gap analysis |

---

## Deploy Webhook Setup

To trigger sitemap pings after each deploy:
1. Go to Vercel → Project → Settings → Git → Deploy Hooks
2. Create a hook pointing to `POST https://emillavinen.com/api/ping-sitemap`
3. Or add as a webhook from the Vercel dashboard under Deploy notifications

---

## Gitignore Check

`.env.local` is listed in `.gitignore` — confirmed safe.
No actual secret values exist in the committed codebase.
