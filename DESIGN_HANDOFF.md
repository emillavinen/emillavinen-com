# Design Handoff — Emil Lavinen Personal Site

This document is written for a designer opening this project in Lovable.
Everything visual flows through a single file. Everything functional is off-limits.

---

## Design Philosophy

This site follows a radical minimalism approach inspired by yeezy.com's design language:
**No boxes. No decoration. Extreme whitespace. Typography is the design.**

- No borders, card outlines, dividers, or background fills on sections
- No gradients, shadows, or decorative elements
- Generous whitespace — section padding is intentionally uncomfortable
- Monochromatic: near-black on pure white only
- The one permitted decorative line: a 2px left border on blockquotes

---

## The Single Source of Visual Truth

**File: `/styles/tokens.css`**

This is the only file you need to change the entire visual appearance of the site.

### Typefaces

```css
--font-sans:    var(--font-inter), "Helvetica Neue", Helvetica, Arial, sans-serif;
--font-display: var(--font-space-grotesk), "Helvetica Neue", Helvetica, Arial, sans-serif;
--font-mono:    ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
```

**Inter** (body) — neutral grotesque, the closest available proxy to Helvetica Neue on Google Fonts. Invisible at body size, structured at display scale. Loaded via `next/font` (self-hosted, no external requests).

**Space Grotesk** (display) — geometric grotesque with distinctive letterforms at large sizes. Used only for hero H1 and major section headings. Maintains grotesque-family coherence while providing visual personality at 8rem. Loaded via `next/font`.

Fonts are loaded in `/app/layout.tsx` via `next/font/google` with `display: swap`. They are self-hosted by Next.js at build time — no Google Fonts CDN requests, CSP-compatible.

### Type Scale

```css
--text-xs:   0.75rem;    /*  12px */
--text-sm:   0.875rem;   /*  14px */
--text-base: 1rem;       /*  16px */
--text-lg:   1.125rem;   /*  18px */
--text-xl:   1.25rem;    /*  20px */
--text-2xl:  1.5rem;     /*  24px */
--text-3xl:  2rem;       /*  32px */
--text-4xl:  3rem;       /*  48px */
--text-5xl:  4.5rem;     /*  72px */
--text-6xl:  6rem;       /*  96px */
--text-7xl:  8rem;       /* 128px */
```

### Line Height & Letter Spacing

```css
--leading-tight:   1.05;
--leading-snug:    1.2;
--leading-normal:  1.6;
--leading-relaxed: 1.75;

--tracking-tight:   -0.03em;
--tracking-normal:   0em;
--tracking-wide:     0.08em;
--tracking-widest:   0.2em;
```

### Colors

```css
--color-bg:           #FFFFFF;   /* page background */
--color-fg:           #0A0A0A;   /* primary text */
--color-fg-secondary: #6B6B6B;   /* secondary text, nav at rest */
--color-fg-muted:     #ADADAD;   /* labels, dates, contact bar at rest */
--color-border:       transparent; /* all borders are off — see blockquote exception below */
--color-accent:       #0A0A0A;   /* same as fg — no separate accent color */
--color-muted:        #6B6B6B;   /* retained alias for admin/TipTap editor */
```

### Spacing

```css
--space-1:  0.25rem;   /*   4px */
--space-2:  0.5rem;    /*   8px */
--space-3:  0.75rem;   /*  12px */
--space-4:  1rem;      /*  16px */
--space-6:  1.5rem;    /*  24px */
--space-8:  2rem;      /*  32px */
--space-12: 3rem;      /*  48px */
--space-16: 4rem;      /*  64px */
--space-20: 5rem;      /*  80px */
--space-24: 6rem;      /*  96px */
--space-32: 8rem;      /* 128px — minimum section padding */
--space-40: 10rem;     /* 160px */
--space-48: 12rem;     /* 192px */
```

Section padding uses `--space-32` (8rem / 128px) as the minimum on desktop.

---

## How to Change Fonts

1. Open `/app/layout.tsx`
2. Replace `Inter` and/or `Space_Grotesk` imports with your chosen font from `next/font/google`
3. Update `--font-sans` and/or `--font-display` in `/styles/tokens.css` to reference the new CSS variable names

**Important:** Do not use `@import url("https://fonts.googleapis.com/...")` — the Content Security Policy blocks external font sources. Always use `next/font/google` which self-hosts the fonts.

---

## How to Change Colors

Open `/styles/tokens.css` and edit the color block. The site is intentionally monochromatic — black text on white. Adding colors should be done with extreme restraint.

---

## Component Map

### Layout

| Component | File | Controls |
|---|---|---|
| Top navigation | `components/layout/Nav.tsx` | Fixed header, wordmark, nav links, mobile overlay |
| Page footer | `components/layout/Footer.tsx` | Copyright line |
| Contact bar | `components/layout/ContactBar.tsx` | Fixed-bottom social link strip |
| Public wrapper | `app/(public)/layout.tsx` | Assembles Nav + main + Footer + ContactBar |

### UI (content components)

| Component | File | Used in |
|---|---|---|
| SpotifyEmbed | `components/ui/SpotifyEmbed.tsx` | MDX blog posts |
| VideoEmbed | `components/ui/VideoEmbed.tsx` | MDX blog posts |
| Callout | `components/ui/Callout.tsx` | MDX blog posts — left-border treatment |
| ImageBlock | `components/ui/ImageBlock.tsx` | MDX blog posts |

### Pages

| Route | File | Notes |
|---|---|---|
| `/` | `app/(public)/page.tsx` | Hero (100svh, display font, clamp type) + About |
| `/about` | `app/(public)/about/page.tsx` | Full-page about with contact details |
| `/blog` | `app/(public)/blog/page.tsx` | List — title + date only, no cards |
| `/blog/[slug]` | `app/(public)/blog/[slug]/page.tsx` | Post — 680px max-width, display font title |
| `/admin` | `app/admin/page.tsx` | Password-protected dashboard |
| `/admin/login` | `app/admin/login/page.tsx` | Auth form |

---

## Design Rules — enforced in code

1. **No box-shadow anywhere**
2. **No border-radius above 4px** (`--radius-lg` clamped to 4px)
3. **No background fills on sections** (all sections are white)
4. **No visible borders** (`--color-border: transparent`) — except:
   - Blockquote: `2px solid var(--color-fg)` left border only
   - Code blocks: `1px solid var(--color-fg-muted)` border
5. **No font-weight above 500** on any public-facing element
6. **Uppercase text only on**: navigation, labels, dates, contact bar links
7. **Hero H1 type**: `clamp(3rem, 8vw, 8rem)` for fluid scaling across breakpoints

### Conscious Exclusion: OG Image

`app/(public)/opengraph-image.tsx` uses hardcoded hex values (`#ffffff`, `#111111`, `#999999`, `#aaaaaa`) and a `borderTop: "4px solid #111111"` — a deliberate exception. The `ImageResponse` renderer (`@vercel/og`) runs in an edge runtime that does not resolve CSS custom properties; tokens cannot be used here. The file generates a static social preview image, not a rendered page, so this is outside the design system scope.

---

## What NOT to Touch

These are functional, not visual. Changing them can break the site:

- `/middleware.ts` — authentication logic
- `/app/api/` — all API routes
- `/lib/github.ts` — GitHub file storage
- `/lib/mdx.ts` — blog post parsing
- `/app/sitemap.ts` — SEO sitemap
- `/app/robots.ts` — crawler rules
- `/components/admin/editor/` — TipTap editor (functionality and extensions)
- `/content/blog/` — MDX content files

---

## URL Structure (must never change)

```
/               Homepage
/blog           Blog index
/blog/[slug]    Individual posts
/about          About page
/sitemap.xml    Auto-generated
/robots.txt     Auto-generated
```

Admin routes (`/admin/*`) are intentionally excluded from sitemaps.

---

## Content Sources

All content lives in two places:

1. **`/lib/constants.ts`** — site name, description, social links.
2. **`/content/blog/*.mdx`** — blog posts. Managed via the admin panel at `/admin`.

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
