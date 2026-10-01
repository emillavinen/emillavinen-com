# DISPATCH decisions

One line of reasoning per call made while building DISPATCH without stopping to ask.

## Repo and stack

- **Next.js 16.2.9, App Router, Turbopack, Tailwind 4, Vercel.** Confirmed from the repo; new code follows its conventions (inline `<style>` blocks and CSS tokens, plain `<img>`, `@/` imports).
- **Kept `middleware.ts`** although Next 16 renames it to `proxy`: it still works, renaming is unrelated to DISPATCH, and it runs on edge, so it holds no database code.
- **pnpm** is the current lockfile; `package-lock.json` was also present and is kept in sync so either install path gives the pinned versions.
- **Every dependency pinned exactly**, the existing carets included (pinned to the versions already locked), so "pin exact versions" holds for the whole package.json.
- **Fixed pre-existing failures** (five React lint errors in `TableOfContents.tsx`/`PostForm.tsx`, a test still expecting the old homepage title) without changing behaviour, because the gate requires lint and tests to pass.
- **Plausible was blocked by the site's own CSP** (`script-src`/`connect-src` lacked plausible.io, verified on the live site). Allowed it, because DISPATCH's UTM links are worthless if Plausible can't record them. Also allowed `vercel.com` and `*.blob.vercel-storage.com` for the drop page's browser uploads.
- **`pnpm-workspace.yaml` allowBuilds placeholders set to `false`**: sharp, esbuild and unrs-resolver ship prebuilt binaries; core-js only prints a banner.

## Store

- **Neon over HTTP (`drizzle-orm/neon-http`)**: the recommended serverless driver. It has no interactive transactions, so every state change is a single conditional `UPDATE … WHERE … RETURNING` (claims, alerts, summaries, feed items, drip slots). That also makes overlapping runs safe.
- **Rotating X refresh tokens use a lease column** (`platform_state.lock_until`) as the DB lock, since there are no transactions; the new token is saved before it is used.
- **The application clock is injected everywhere**; no comparison uses SQL `now()`. That is how the end-to-end test runs on a mocked clock.
- **Extra tables:** `alerts` (alert-on-change state), `counters` (daily drip slots), `pinterest_boards` and `feed_items` (baseline and ingest queue). **Extra columns:** `skip_reason`, `text` (what went or would go out), `claimed_at`, `queued_at`, `summary_*`, `media_type`/`kind` (ready for video). The spec allowed renaming as long as the meaning held.
- **Migrations run before `next build` when `DATABASE_URL` is set; a failed migration fails the build**: code deployed on an old schema would be worse than a failed deploy. Preview builds share the database, so they migrate it too.
- **Raw SQL passes timestamps as ISO text.** Found by running against a real Postgres driver: Drizzle maps dates only for typed columns, not for raw `sql` parameters.
- **Local development store:** a `localhost` `DATABASE_URL` uses `postgres-js`, and `pnpm dev:db` serves PGlite over TCP. `BLOB_READ_WRITE_TOKEN=local` writes images to `public/dispatch-local/`. Both are dev-only and let the whole thing run without Neon or Blob.

## Images

- **sharp rotates from EXIF first, then converts to sRGB, flattens onto white and writes no metadata** (no EXIF, GPS, XMP or ICC). The tests check each of these, including a CMYK source.
- **Stored width and height come from the `display` output**, so the grid reserves exact space before images load.
- **`bsky` is held under 950,000 bytes** by lowering quality, then shrinking 15% at a time. `social` is held under 4.5 MB the same way.
- **HEIC and video are rejected with a message**; prebuilt sharp can't decode HEIC, and the drop page's `accept` already makes iPhones send JPEG.
- **Plain `<img>`, not `next/image`**: the variants are already sized, and Vercel Hobby's image-optimisation quota would be spent for nothing.

## Site

- **The portfolio lives at `/work`.** The homepage stays the hand-curated list of three projects. `/work` is linked from the top nav (right side, same style as the wordmark link) and first in the homepage footer row.
- **Masonry is computed on the server for 2, 3 and 4 columns, and CSS shows the one that fits.** True ratios, no JS, no layout shift. Lazy images inside hidden layouts are never fetched.
- **One quiet line under each image (title left, year right)**: the homepage row in miniature. There is no other card chrome.
- **Work pages cap each image at 85% of the screen height**, with the box sized from the stored ratio, so tall posters never need scrolling to see whole.
- **Pages are `force-static` and revalidated on every write** (`revalidatePath`). An hourly revalidate is the backstop for writes made outside the site (the local import, which also calls `/api/dispatch/revalidate`).
- **A store failure during `next build` renders empty instead of failing the deploy.** At runtime it throws, so Next keeps serving the last good page.
- **OG/Twitter images use the `social` JPEG** (WebP previews don't render everywhere). JSON-LD is `CreativeWork` on work pages and `CollectionPage` on `/work`.
- **Work pages and `/work` are added to the sitemap.** It's an addition only: existing entries are unchanged.

## Inputs

- **Pinterest:** feed items are recorded first, then turned into works one by one within a time budget. Twenty-five pins of image processing can't safely fit one call, and items survive a run that dies.
- **Baseline is per board, taken at its first successful read.** A board whose feed failed at first still gets a proper baseline later.
- **New pins are processed before baseline backlog**, so a fresh pin never waits behind old ones.
- **Pin ids may be alphanumeric, and items without an image are skipped.** Found in a real feed: idea pins arrive with `/pin/tq8azUQE/` and an empty `<img>`.
- **Blank pin titles fall back to the description's first sentence, then the board name.** Titles over 90 characters are shortened, with the full text kept as the caption: real pins use whole product descriptions as titles.
- **A pin already in the store under any origin is never a second work.** The spec's unique key is (origin, source_id); the lookup also checks across `pinterest`/`import`.
- **Images try `originals`, then `1200x`, then `736x`, then the feed's own size.** All three rewrites were verified against i.pinimg.com.
- **Drop uploads go to `uploads/` in Blob; the server accepts only URLs from its own store under that prefix** (no SSRF) and deletes the raw uploads after processing (no originals kept).
- **Import dedupes by pin id or `sha256:` of the file**, and gives held deliveries.
- **The downloader's selectors live in `scripts/dispatch/pinterest-selectors.ts` with fallbacks.** Pin data is taken from Pinterest's embedded/XHR JSON first and DOM second, and pins under the "More ideas" heading are ignored. It is **untested against a logged-in Pinterest** from here, as the spec anticipated.

## Runner and scheduling

- **Triggers:** GitHub Actions at :23 every hour (off the top of the hour), and one Vercel cron at 07:10 UTC, inside the posting window. Vercel Hobby allows 100 daily crons (checked).
- **The trigger is identified** by `?trigger=github`, a `vercel-cron` user agent, or else `manual`. Only the Vercel run checks GitHub's health: it alerts after 6 h of silence, or if GitHub has never run.
- **Budget:** 50 s per call. Pinterest processing gets ≤ 25 s; no new delivery starts with < 20 s left; at most 3 deliveries, never two for one work.
- **A platform paused mid-run gets no second attempt in that run.** Found by a test.
- **Platforms not connected when a work is queued get `skipped/disabled`**, which turns into `held` once the platform is enabled. **The held backfill runs every run**, so works written by another process (the local import) get their rows.
- **Daily caps count by Helsinki day**: `posted_at`, plus anything in flight. Over the cap moves to the next morning's opening plus 0–30 min jitter.
- **Dry run makes no platform calls at all**, uploads included (X uploads cost credits). Those deliveries end as `skipped`/`dry_run` with the text stored, and turning dry run off doesn't resend them. Use **Queue again** in admin if you want one.
- **New error kind `ambiguous`**: a network failure or unreadable response on the *final* publish call becomes `unknown`, never retried, because a duplicate post is worse than a missed one. Network failures before that call (uploads) are `transient`. A 5xx on publish still retries, as the spec says.
- **Are.na:** if a later block fails after earlier ones landed, the delivery reports what posted with a note instead of retrying into duplicates.
- **Auth/credits errors pause the platform; it is re-checked at most every 3 hours** (one cheap call, which costs a read on X), so its queue resumes by itself.
- **Hidden works aren't dispatched** (`skipped/hidden`): their link would 404.
- **The backlog drip moves at most one work per run**, up to `BACKLOG_DRIP_PER_DAY` per Helsinki day, oldest first, claimed through a counter row.

## Notifications

- **One summary per work once nothing is pending or posting.** It lists the deliveries touched since the work was queued, leaving out platforms Emil unticked. In dry run it shows the exact text, indented.
- **Alerts fire on the first occurrence, then once a day while still open, then one line when resolved.** An `unknown` delivery stays open until it is marked in admin.
- **A pin that fails 5 times (or is not an image) is notified once and dropped.** A permanent per-pin alert would nag forever.
- **The Resend fallback defaults to `onboarding@resend.dev`** (delivers to the Resend account owner); `NOTIFY_FROM` overrides it once a domain is verified.

## Admin and auth

- **The existing `/admin` (posts) is kept; DISPATCH adds Works, Drop and Connections** behind the same login, with a small shared nav.
- **The session cookie is now HMAC-signed with an expiry** (`v2.<exp>.<sig>`). It used to be an unsalted hash of the password. Existing sessions are signed out once; TOTP still works.
- **Login is rate-limited to 5 failures per 15 minutes per IP.** Counted in the event log when the store exists, in memory otherwise.
- **Signed-out `/api/admin/*` calls get a 401 JSON instead of a redirect to the login HTML**, so the upload client shows a real error.
- **OAuth state lives in its own signed, httpOnly, SameSite=Lax cookie scoped to `/api/auth`**: the admin cookie is SameSite=Strict, so it isn't sent on the platform's redirect back. X uses PKCE; Threads and LinkedIn are confidential clients with state.
- **Server actions re-check the session**, as defence in depth on top of middleware.

## Platforms

- **Docs read 2026-09-30.** Are.na v3 OpenAPI; X `api.x.com/2/openapi.json`; Threads and LinkedIn official docs (LinkedIn current version 202609); Tumblr's docs repo on GitHub; `@atproto/api` 0.22. No adapter is marked "unverified".
- **Live checks, read-only only:** the Are.na token reached `/v3/me` and the channel; the X OAuth 2.0 access token reached `/2/users/me` (@emillavinen). Nothing was posted: posting is the go-live step.
- **X: the provided files are OAuth 2.0 credentials** (client id/secret, user access and refresh token). The OAuth 1.0a API key and access token secret aren't among them, so X runs on OAuth 2.0 until the four keys are set. Both paths are built.
- **X: the refresh token was deliberately not used here.** X rotates it, and using it would have invalidated the one Emil saved. `X_OAUTH2_REFRESH_TOKEN` can seed the store once; Connect in admin is the normal path.
- **X: the two-hour access-token expiry is never alerted** (it refreshes itself); only refresh failures are.
- **X text is the title plus the caption only if the whole caption fits** (twitter-text weighting); a caption isn't cut mid-way.
- **X media uses `POST /2/media/upload` (multipart, `tweet_image`) and `POST /2/media/metadata`** for alt text, which is non-fatal if it fails.
- **Threads counts emoji by UTF-8 bytes**, per its docs. The token refreshes once it is over 24 hours old (in practice daily).
- **LinkedIn has no hardcoded version**: without `LINKEDIN_VERSION` it is not configured. A retired version, `426`, or a version error pauses it with a note naming the variable. Commentary is escaped for "little" text format, including the link's underscores. Two or more images post as `multiImage`.
- **Bluesky facets come from `detectFacetsWithoutResolution`** (links only, no extra network calls). An invalid response on the post call is `ambiguous`.
- **Tumblr is built** (NPF multipart, tags, OAuth 1.0a), as time allowed.
- **Not built:** Reddit (self-serve API closed November 2025, and its policy bars mixed-use personal accounts), Behance (no publishing API), Instagram, TikTok and Pinterest (posted by hand).

## Left to Emil

- **Not done from here:** provisioning Neon/Blob, setting Vercel or GitHub variables, or posting. Each is an account action, so SETUP.md walks through it.
