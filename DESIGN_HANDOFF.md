# Design Handoff — Emil Lavinen Personal Site

This document is written for a designer opening this project in Lovable.
Everything visual flows through a single file. Everything functional is off-limits.

---

## The Single Source of Visual Truth

**File: `/styles/tokens.css`**

This is the only file you need to change the entire visual appearance of the site.
It contains CSS custom properties for every design decision:

```css
--font-sans      /* primary typeface */
--font-serif     /* secondary typeface */
--color-bg       /* page background */
--color-fg       /* primary text and borders */
--color-muted    /* secondary text, labels */
--color-border   /* dividers and outlines */
--color-accent   /* call-to-action colour */
--space-1 … --space-16   /* spacing scale */
--text-xs … --text-4xl   /* type scale */
--radius-sm/md/lg        /* border radii */
--transition-fast/base/slow  /* animation speeds */
```

Every component consumes *only* these tokens. Change a value here,
it propagates everywhere.

---

## How to Change Fonts

1. Open `/styles/tokens.css`
2. Change `--font-sans` and/or `--font-serif`
3. If using a Google Font or custom font: import it in `/app/globals.css`
   before the tokens import line

```css
/* example: */
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap");
```

Then in tokens.css:
```css
--font-sans: "Inter", sans-serif;
```

---

## How to Change Colors

Open `/styles/tokens.css` and edit the color block:

```css
--color-bg:     #ffffff;   /* → change to your background */
--color-fg:     #111111;   /* → change to your primary text/ink */
--color-muted:  #737373;   /* → change to your secondary/grey */
--color-border: #e5e5e5;   /* → change to your divider colour */
--color-accent: #111111;   /* → change to your accent/CTA colour */
```

The site currently uses a near-black/white minimal palette.
All prose text, headings, borders, nav, footer, and contact bar
read from these tokens automatically.

---

## How to Change Spacing

Edit the spacing scale in `/styles/tokens.css`. The scale goes from
`--space-1` (4px) to `--space-16` (64px). Adding or removing a step
requires updating any component that references the removed token.

---

## Component Map

### Layout

| Component | File | Controls |
|---|---|---|
| Top navigation | `components/layout/Nav.tsx` | Header bar, logo, nav links, mobile menu |
| Page footer | `components/layout/Footer.tsx` | Bottom bar with copyright |
| Contact bar | `components/layout/ContactBar.tsx` | Fixed-bottom link strip |
| Public wrapper | `app/(public)/layout.tsx` | Assembles Nav + main + Footer + ContactBar |

### UI (content components)

| Component | File | Used in |
|---|---|---|
| SpotifyEmbed | `components/ui/SpotifyEmbed.tsx` | MDX blog posts |
| VideoEmbed | `components/ui/VideoEmbed.tsx` | MDX blog posts |
| Callout | `components/ui/Callout.tsx` | MDX blog posts |
| ImageBlock | `components/ui/ImageBlock.tsx` | MDX blog posts |

### Pages

| Route | File | Notes |
|---|---|---|
| `/` | `app/(public)/page.tsx` | Hero + About section |
| `/blog` | `app/(public)/blog/page.tsx` | Post listing |
| `/blog/[slug]` | `app/(public)/blog/[slug]/page.tsx` | Post detail |
| `/admin` | `app/admin/page.tsx` | Password-protected dashboard |
| `/admin/login` | `app/admin/login/page.tsx` | Auth form |

---

## What NOT to Touch

These are functional, not visual. Changing them can break the site:

- `/middleware.ts` — authentication logic
- `/app/api/` — all API routes
- `/lib/github.ts` — GitHub file storage
- `/lib/mdx.ts` — blog post parsing
- `/app/sitemap.ts` — SEO sitemap
- `/app/robots.ts` — crawler rules
- `/components/admin/` — admin panel
- `/content/blog/` — MDX content files

---

## URL Structure (must never change)

These URLs are indexed by Google. Changing them requires 301 redirects.

```
/               Homepage
/blog           Blog index
/blog/[slug]    Individual posts
/about          About page (links from nav)
/sitemap.xml    Auto-generated
/robots.txt     Auto-generated
```

Admin routes (`/admin/*`) are intentionally excluded from sitemaps.

---

## Content Sources

All content lives in two places:

1. **`/lib/constants.ts`** — site name, description, social links.
   Update this when contact details change.

2. **`/content/blog/*.mdx`** — blog posts.
   Managed via the admin panel at `/admin`.

No content is hardcoded in JSX components.

---

## Environment Variables Required

```env
ADMIN_PASSWORD=          # Admin login password
TOTP_SECRET=             # Base32 TOTP secret for 2FA
GITHUB_TOKEN=            # GitHub PAT with repo content write access
GITHUB_OWNER=            # GitHub org/user (emillavinen-cmd)
GITHUB_REPO=             # Repository name (emillavinen-com)
GITHUB_BRANCH=main       # Branch to write posts to
VERCEL_DEPLOY_HOOK_URL=  # Vercel deploy hook for publish button
```
