# DISPATCH setup

DISPATCH turns emillavinen.com into a portfolio of all your work (the grid at
**/work**), and posts each new work to the platforms you don't post on by
hand: Are.na, X, Threads, LinkedIn, Bluesky and Tumblr. Instagram, TikTok and
Pinterest stay manual, and DISPATCH never touches them.

It starts **safe**: dry run is on, so nothing is posted until you switch it
off in step 6. Every step below can be done in any browser. Step 5 is the
only one that needs your computer.

You'll need about an hour. Keep this page open and work down it.

---

## 1. Vercel: add the database and image storage

1. Open [vercel.com](https://vercel.com) → the **emillavinen-com** project → **Storage**.
2. **Already done?** If Neon is already listed under Storage (the /admin/instagram
   page uses it), skip to 3. DISPATCH shares that database; its tables don't
   overlap the Instagram page's `igout_*` tables. Otherwise:
   **Create Database** → **Neon** (Serverless Postgres) → the free plan → region
   **Frankfurt (eu-central-1)** or **Stockholm**, whichever is offered nearest.
   When it asks which environments to connect, tick **all of them**
   (Production, Preview, Development). This adds `DATABASE_URL` for you.
3. **Create** again → **Blob** → name it `dispatch`. If it asks for access,
   choose **Public** (the platforms fetch the images by their address).
   Connect it to **all environments**. This adds `BLOB_READ_WRITE_TOKEN` for you.

Both are free. The database tables are created automatically the next time
the site builds.

**One limit to know about:** free Blob storage allows about 2,000 uploads and
1 GB a month. Each image on the site is 4 uploads (four sizes), so roughly
400 new images a month. Going over doesn't cost money, but Vercel then
switches Blob off for 30 days, which would break the images. DISPATCH stops
adding works just before that (`BLOB_MONTHLY_PUT_BUDGET`, `BLOB_STORAGE_BUDGET_MB`),
tells you once, and carries on by itself the next month. The current numbers
are at the bottom of /admin/connections.

---

## 2. Environment variables

Vercel → the project → **Settings → Environment Variables**. Add each value
below for **Production** (and Preview, if you want previews to behave like the
real site). After changing variables, redeploy from **Deployments → ⋯ → Redeploy**.

### Three secrets you make yourself

Open **Terminal** on your Mac and run each command once. Copy the line it prints.

| Variable | Command | What it does |
|---|---|---|
| `CRON_SECRET` | **Already set** for the site's existing crons. Reuse it: open it in Vercel and copy the value. If it isn't there, run `openssl rand -hex 32`. | The password the hourly trigger uses to start DISPATCH. |
| `ADMIN_PASSWORD` | **Already set** if you use /admin today. Otherwise `openssl rand -base64 24` (or a long password of your own). | Your password for emillavinen.com/admin. |
| `DISPATCH_ENCRYPTION_KEY` | `openssl rand -base64 32` | Locks the platform logins DISPATCH stores. Set it once and never change it: changing it means reconnecting X, Threads and LinkedIn. |

### `CRON_SECRET` also goes to GitHub

The hourly trigger runs on GitHub. **Before merging**, add the same value there:

1. [github.com/emillavinen/emillavinen-com](https://github.com/emillavinen/emillavinen-com) → **Settings → Secrets and variables → Actions**.
2. **New repository secret** → Name `CRON_SECRET` → paste the same value as in Vercel → **Add secret**.

If this is missing, the daily backup run will warn you that the hourly trigger isn't running.

### The rest

Every variable, with where its value comes from, is listed in
[`.env.example`](.env.example). The platform ones are explained in step 4.
You only need the platforms you want. A platform with nothing set is simply
off, and nothing breaks.

Useful defaults you can leave alone:

| Variable | Default | Meaning |
|---|---|---|
| `DRY_RUN` | `true` | Does everything except post, and tells you what it would have posted. Switch off in step 6. |
| `DISPATCH_ENABLED` | `true` | The kill switch. `false` stops DISPATCH completely. Also a button in /admin. |
| `POSTING_WINDOW` | `09:00-22:00` | Helsinki time when posts may go out. |
| `CAP_X`, `CAP_THREADS`, … | X 3, Threads 3, LinkedIn 1, Bluesky 3, Tumblr 3, Are.na 10 | Most posts per platform per day. |
| `BACKLOG_DRIP_PER_DAY` | `0` | Set to e.g. `1` to slowly send old work to platforms where it's new. |

---

## 3. Telegram: where DISPATCH talks to you

**Reusing a bot you already have works.** DISPATCH only sends messages, so it
never gets in the way of another program using the same bot. Its messages
start with "DISPATCH —" so you can tell them apart. Copy that bot's token and
your chat id into `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, and skip the
three steps below.

DISPATCH sends you one short message per new work (with links to each post,
or why something didn't post), plus a message whenever something needs you.

1. In Telegram, open **@BotFather** → send `/newbot` → give it a name (e.g.
   *Dispatch Emil*) and a username ending in `bot`. BotFather replies with a
   token like `123456:ABC-…` → that's **`TELEGRAM_BOT_TOKEN`**.
2. Open your new bot (BotFather links to it) and send it `/start`.
3. In a browser, open `https://api.telegram.org/bot<TOKEN>/getUpdates` (put
   your token in place of `<TOKEN>`). Find `"chat":{"id":123456789` — that
   number is **`TELEGRAM_CHAT_ID`**.

Add both in Vercel. (No Telegram? Set `RESEND_API_KEY` and `NOTIFY_EMAIL`
instead and you'll get email. With neither, messages only go to the Vercel logs.)

---

## 4. Platforms

Do these in any order. After adding a platform's variables, redeploy. Then
open **emillavinen.com/admin/connections** and press **Check** next to it. Check
makes one harmless call that never posts, and tells you which account it
reached.

> **Connect buttons** (X OAuth 2.0, Threads, LinkedIn) only work on
> **emillavinen.com/admin**, not on a preview link, because that's where the
> platforms send you back to.

### Are.na

1. [are.na/settings/personal-access-tokens](https://www.are.na/settings/personal-access-tokens)
   → **New token** → tick **write** → copy it → **`ARENA_TOKEN`**.
2. Pick the channel DISPATCH should add to. Its slug is the last part of its
   address: `are.na/emil-lavinen/`**`emillavinen`** → **`ARENA_CHANNEL`**.
   Your existing `emillavinen` channel is **private**: blocks added there are
   only visible to you. Make the channel public (channel → ⋯ → Edit) if you
   want people to see them, or create a new public one.

### X

X charges per request, so set a limit first.

1. [developer.x.com](https://developer.x.com) → **Billing**: buy credits and
   set a **spending limit**.
2. Your app → **Settings → User authentication settings**: app permissions
   **Read and write**, type **Web App**. Save.
3. Then pick **one** of the two ways in:

   **A. Keys (simplest).** Your app → **Keys and tokens**:
   - **API Key and Secret** → `X_API_KEY`, `X_API_SECRET`
   - **Access Token and Secret** → `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`.
     These must be generated **after** "Read and write" was saved. If yours
     are older, press **Regenerate**.

   Leave the callback URL as it is (`https://emillavinen.com/callback`).

   **B. OAuth 2.0 (what your saved tokens are).** The tokens you saved are
   OAuth 2.0 (Client ID, Client Secret, access and refresh token), not the
   four keys in A.
   - **Client ID and Client Secret** → `X_CLIENT_ID`, `X_CLIENT_SECRET`
   - In **User authentication settings**, change the **Callback URI** to
     `https://emillavinen.com/api/auth/x/callback`. This is required for B.
   - After deploying, press **Connect** next to X in /admin/connections and approve.

   You can do both. With A set, DISPATCH posts with the keys, and B is only
   used if X refuses image uploads with the keys (some pay-per-use apps do).

Links are left out of X posts by default (`X_INCLUDE_LINK=false`), because a
post with a URL costs far more credits. If X runs out of credits, you get one
message saying "top up X credits", and X waits until you do.

### Threads

1. [developers.facebook.com/apps](https://developers.facebook.com/apps) →
   **Create app** → use case **Access the Threads API**.
2. **Use cases → Threads API → Settings**: add `https://emillavinen.com/api/auth/threads/callback`
   as a **Redirect callback URL** (and the same address as the uninstall and
   delete callbacks if it asks). Turn on the permission
   **threads_content_publish** (threads_basic is on by default).
3. **App roles → Roles → Add people → Threads Tester** → your Threads username.
4. In the **Threads app**: **Settings → Account → Website permissions →
   Invites** → accept.
5. **App settings → Basic**: copy **App ID** → `THREADS_APP_ID` and the
   **Threads app secret** from the Threads use case settings → `THREADS_APP_SECRET`.
6. Redeploy, then **Connect** next to Threads in /admin/connections.

The Threads login lasts 60 days and DISPATCH renews it by itself every day.

### LinkedIn (your personal profile)

1. [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps) → **Create app**.
   It asks for a **LinkedIn Page**: pick any page you admin (it's only the
   app's owner; posts go to your personal profile).
2. **Products**: add **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**.
3. **Auth → Authorized redirect URLs**: add `https://emillavinen.com/api/auth/linkedin/callback`.
4. **Auth**: copy **Client ID** → `LINKEDIN_CLIENT_ID`, **Primary Client Secret** → `LINKEDIN_CLIENT_SECRET`.
5. **`LINKEDIN_VERSION`**: the current month as `YYYYMM` (e.g. `202609`).
   LinkedIn retires versions after about a year. When that happens, DISPATCH
   pauses LinkedIn and tells you to update this one value.
6. Redeploy, then **Connect** next to LinkedIn in /admin/connections.

LinkedIn logins last 60 days. Seven days before it expires you get a message
with the link to reconnect. That's one click.

### Bluesky

Bluesky → **Settings → Privacy and security → App passwords → Add App Password**.
Set `BSKY_HANDLE` (e.g. `emillavinen.bsky.social`) and `BSKY_APP_PASSWORD`.

### Tumblr (optional)

[tumblr.com/oauth/apps](https://www.tumblr.com/oauth/apps) → register an
app → **OAuth Consumer Key** and **Secret** → `TUMBLR_CONSUMER_KEY`,
`TUMBLR_CONSUMER_SECRET`. Then open the [API console](https://api.tumblr.com/console),
enter the two, allow access, and copy the **Token** and **Token Secret** →
`TUMBLR_TOKEN`, `TUMBLR_TOKEN_SECRET`. `TUMBLR_BLOG` is your blog name.

### Pinterest (the main input)

Paste the address of every board that holds **only your own work** into
`PINTEREST_BOARDS`, separated by commas:

```
https://www.pinterest.com/emillavinen/<board>/,https://www.pinterest.com/emillavinen/<other-board>/
```

Boards must be **public** (secret boards have no feed). Don't add boards with
pins saved from other people — everything on these boards goes to the site
and out to the platforms.

What happens: the **first time** DISPATCH reads a board, every pin already on
it becomes a work on the site, but is **never posted** anywhere. From then on,
every **new** pin you add is put on the site and sent out, staggered over a
few hours and only between 09:00 and 22:00.

You can also add work by hand from your phone at **emillavinen.com/admin/drop**
(1–4 images, optional title, caption, client, tools, year and tags).

---

## 5. Old work: the backlog import (on your computer, once)

The board feeds only show the latest ~25 pins. To bring in everything older:

1. Install **Node.js** (the LTS version) from [nodejs.org](https://nodejs.org).
2. Open **Terminal** and run, one line at a time:
   ```
   git clone https://github.com/emillavinen/emillavinen-com.git
   cd emillavinen-com
   npm install
   npx playwright install chromium
   ```
3. Create a file called `.env.local` in that folder with these three lines.
   Copy the values from Vercel → Settings → Environment Variables (click the eye icon):
   ```
   DATABASE_URL=...
   BLOB_READ_WRITE_TOKEN=...
   CRON_SECRET=...
   ```
4. Download your boards:
   ```
   npm run pinterest:download -- https://www.pinterest.com/emillavinen/<board>/
   ```
   A browser window opens. **Log in to Pinterest yourself** in that window.
   The script never sees or stores your password. Then press Enter in
   Terminal. It scrolls each board to the end and saves every image at full
   size, plus a `manifest.json`, into `dispatch-import/<board>/`. Video pins
   are skipped and listed. You can pass several boards. If it stops halfway,
   run it again and it picks up where it left off.
5. Upload them:
   ```
   npm run import -- dispatch-import
   ```
   Every image becomes a work on the site, held back from the platforms.
   Running it twice never creates duplicates. It starts by showing how much of
   this month's free image storage is left. A big backlog (more than about
   350 images) stops when the month's allowance is used. Run the same command
   next month and it carries on where it stopped. You can also import any folder
   of images (`npm run import -- ~/Desktop/old-work`); each file becomes a work
   titled from its file name. Add `--dry-run` to see what would happen first.

If the download finds no pins (Pinterest changes its pages now and then),
run it with `--debug` and send the files it saves in `dispatch-import/<board>/debug/`
to whoever maintains the site. The selectors live in one file,
`scripts/dispatch/pinterest-selectors.ts`.

---

## 6. Going live

1. **Merge** the DISPATCH pull request on GitHub. Vercel deploys it.
2. Check that **GitHub → Actions → DISPATCH** is enabled. It runs every hour
   at :23. You can also press **Run workflow** to start it right away.
3. Open **emillavinen.com/admin/connections**:
   - press **Check** on every platform you set up: each should say *checks out*;
   - press **Run now** once. Your boards are read and the existing pins
     appear at **emillavinen.com/work**.
4. Add a new pin to one of your boards (or drop a work at /admin/drop). Within
   a few hours you'll get a Telegram message showing, for each platform, the
   **exact text it would have posted**. Read it.
5. Happy with it? In /admin/connections press **Turn off** next to **Dry run**.
   From now on new work is posted for real.

### Day to day

- **Nothing to do.** Pin as usual. You'll get one message per new work.
- **A message says a platform needs attention** (expired login, out of X
  credits, LinkedIn version): fix what it says. The platform's queue waits and
  starts again by itself once it checks out. You get one reminder a day until then.
- **"may or may not have posted"**: a post was interrupted at the last moment.
  Look on that platform. Then, in /admin/works, press **It posted** or **Retry**.
  DISPATCH never retries these by itself, because a double post is worse than a missed one.
- **Stop everything**: /admin/connections → Runner → **Turn off**.
- **Hide a work from the site**: /admin/works → **Hide**. Hidden work is never posted.

### For developers

`pnpm dev:db` starts a local Postgres (PGlite) on port 5433. Run the site with
`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres` and
`BLOB_READ_WRITE_TOKEN=local` (images go to `public/dispatch-local/`) to work
on DISPATCH without Neon or Blob. `pnpm db:generate` writes a migration after a
schema change. `pnpm build` applies migrations when `DATABASE_URL` is set.
