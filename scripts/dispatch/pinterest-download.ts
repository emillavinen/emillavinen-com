/**
 * Backlog download, run once on Emil's own computer:
 *
 *   npm run pinterest:download -- https://www.pinterest.com/emillavinen/<board>/ [more boards] [--debug]
 *
 * Opens a visible Chromium window and waits for Emil to log in himself — the
 * script never asks for, sees or stores a password (the session lives only
 * in dispatch-import/.browser-profile on his machine). Then, per board, it
 * scrolls to the end, saves every pin image at full size plus a
 * manifest.json (pin id, title, description, date, URL) into
 * dispatch-import/<board>/, and lists video pins, which are skipped.
 * Run it again to resume: pins already saved are not downloaded twice.
 *
 * Afterwards: `npm run import -- dispatch-import`.
 *
 * Selectors live in pinterest-selectors.ts. With --debug, the HTML and a
 * screenshot of every page that yields nothing are saved next to the
 * manifest so the selectors can be fixed.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import type { BrowserContext, Page } from "playwright";
import * as S from "./pinterest-selectors";

interface PinData {
  pinId: string;
  title: string;
  description: string;
  date: string | null;
  imageUrl: string | null;
  isVideo: boolean;
}

interface ManifestPin {
  pinId: string;
  title: string;
  description: string;
  date: string | null;
  url: string;
  file: string;
}

interface Manifest {
  board: string;
  downloadedAt: string;
  pins: ManifestPin[];
  videos: { pinId: string; url: string }[];
  failed: { pinId: string; url: string; reason: string }[];
}

const OUT = path.resolve("dispatch-import");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── JSON digging ───────────────────────────────────────────────────────────

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  return undefined;
}

function pickPath(obj: unknown, paths: string[][]): string | undefined {
  for (const p of paths) {
    let cur: unknown = obj;
    for (const k of p) cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[k] : undefined;
    if (typeof cur === "string" && cur.startsWith("http")) return cur;
  }
  return undefined;
}

function asPin(obj: Record<string, unknown>): PinData | null {
  const id = pick(obj, S.FIELDS.id);
  if (typeof id !== "string" && typeof id !== "number") return null;
  const pinId = String(id);
  if (!/^\d{6,}$/.test(pinId)) return null;
  const imageUrl = pickPath(obj, S.FIELDS.image);
  const video = pick(obj, S.FIELDS.video);
  if (!imageUrl && !video) return null;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const date = pick(obj, S.FIELDS.date);
  return {
    pinId,
    title: text(pick(obj, S.FIELDS.title)),
    description: text(pick(obj, S.FIELDS.description)),
    date: typeof date === "string" && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : null,
    imageUrl: imageUrl ?? null,
    isVideo: Boolean(video && (typeof video !== "object" || Object.keys(video as object).length > 0)),
  };
}

/** Every pin-shaped object anywhere in a JSON tree. */
function collectPins(tree: unknown, into: Map<string, PinData>, depth = 0): void {
  if (!tree || typeof tree !== "object" || depth > 40) return;
  if (Array.isArray(tree)) {
    for (const item of tree) collectPins(item, into, depth + 1);
    return;
  }
  const pin = asPin(tree as Record<string, unknown>);
  if (pin) {
    const known = into.get(pin.pinId);
    into.set(pin.pinId, {
      ...pin,
      title: pin.title || known?.title || "",
      description: pin.description || known?.description || "",
      date: pin.date ?? known?.date ?? null,
      imageUrl: pin.imageUrl ?? known?.imageUrl ?? null,
      isVideo: pin.isVideo || Boolean(known?.isVideo),
    });
  }
  for (const value of Object.values(tree)) collectPins(value, into, depth + 1);
}

async function embeddedPins(page: Page, into: Map<string, PinData>): Promise<void> {
  for (const selector of S.EMBEDDED_JSON) {
    const blobs = await page.$$eval(selector, (nodes) => nodes.map((n) => n.textContent ?? ""));
    for (const raw of blobs) {
      try {
        collectPins(JSON.parse(raw), into);
      } catch {
        /* not JSON */
      }
    }
  }
}

// ── Pages ──────────────────────────────────────────────────────────────────

async function firstMatch(page: Page, selectors: string[]): Promise<string | null> {
  for (const s of selectors) if ((await page.$(s)) !== null) return s;
  return null;
}

async function saveDebug(page: Page, dir: string, name: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${name}.html`), await page.content());
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });
  console.info(`  debug: saved ${name}.html and ${name}.png in ${dir}`);
}

async function waitForLogin(page: Page): Promise<void> {
  await page.goto(S.LOGIN_URL, { waitUntil: "domcontentloaded" });
  if (await firstMatch(page, S.SIGNED_IN)) return;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("\nLog in to Pinterest in the browser window (this script never sees your password).\nWhen your boards are visible, press Enter here… ");
  rl.close();
}

function boardSlug(boardUrl: string): string {
  const parts = new URL(boardUrl).pathname.split("/").filter(Boolean);
  return parts.slice(0, 2).join("-") || "board";
}

/** Scrolls the board to its end and returns the pin ids that belong to it, in order. */
async function scrollBoard(page: Page, data: Map<string, PinData>, debugDir: string | null): Promise<string[]> {
  const grid = (await firstMatch(page, S.BOARD_GRID)) ?? "body";
  const headerText = await page.evaluate(() => document.body.innerText.slice(0, 4000));
  const countMatch = headerText.match(S.PIN_COUNT_TEXT);
  const expected = countMatch ? Number(countMatch[1].replace(/[^\d]/g, "")) : null;
  if (expected) console.info(`  board says ${expected} pins`);

  const order: string[] = [];
  const seen = new Set<string>();
  let idle = 0;
  for (let round = 0; round < 2000 && idle < 10; round++) {
    const found = await page.evaluate(
      ({ grid, link, headings, headingText }) => {
        const re = new RegExp(headingText.source, headingText.flags);
        // Where the recommendations start, if they are on the page.
        let stopAt = Infinity;
        for (const sel of headings) {
          for (const el of Array.from(document.querySelectorAll(sel))) {
            if (re.test(el.textContent ?? "")) stopAt = Math.min(stopAt, el.getBoundingClientRect().top + window.scrollY);
          }
        }
        const root = document.querySelector(grid) ?? document.body;
        const out: { href: string; top: number }[] = [];
        for (const a of Array.from(root.querySelectorAll(link))) {
          const top = a.getBoundingClientRect().top + window.scrollY;
          if (top < stopAt) out.push({ href: (a as HTMLAnchorElement).getAttribute("href") ?? "", top });
        }
        return { links: out, reachedRecommendations: stopAt !== Infinity };
      },
      { grid, link: S.PIN_LINK, headings: S.RECOMMENDATIONS_HEADING, headingText: { source: S.RECOMMENDATIONS_TEXT.source, flags: S.RECOMMENDATIONS_TEXT.flags } }
    );
    let added = 0;
    for (const { href } of found.links) {
      const id = href.match(S.PIN_ID_FROM_HREF)?.[1];
      if (id && !seen.has(id)) {
        seen.add(id);
        order.push(id);
        added++;
      }
    }
    idle = added === 0 ? idle + 1 : 0;
    if (found.reachedRecommendations && idle >= 3) break;
    if (expected && order.length >= expected) break;
    await page.mouse.wheel(0, 2200);
    await sleep(900 + Math.random() * 600);
    await embeddedPins(page, data);
  }
  if (order.length === 0 && debugDir) await saveDebug(page, debugDir, "board");
  if (expected && order.length < expected) console.warn(`  found ${order.length} of ${expected} pins — re-run to resume, or use --debug`);
  return order;
}

async function pinFromPage(context: BrowserContext, pinId: string, debugDir: string | null): Promise<PinData | null> {
  const page = await context.newPage();
  try {
    await page.goto(`${S.PINTEREST}/pin/${pinId}/`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await sleep(1200);
    const data = new Map<string, PinData>();
    await embeddedPins(page, data);
    const fromJson = data.get(pinId);
    if (fromJson?.imageUrl || fromJson?.isVideo) return fromJson;
    const read = async (selectors: string[], attr: "content" | "src" | "text") => {
      for (const s of selectors) {
        const el = await page.$(s);
        if (!el) continue;
        const v = attr === "text" ? await el.textContent() : await el.getAttribute(s.startsWith("meta") ? "content" : attr);
        if (v && v.trim()) return v.trim();
      }
      return null;
    };
    const isVideo = (await firstMatch(page, S.PIN_PAGE.video)) !== null;
    const imageUrl = await read(S.PIN_PAGE.image, "src");
    if (!imageUrl && !isVideo) {
      if (debugDir) await saveDebug(page, debugDir, `pin-${pinId}`);
      return null;
    }
    return {
      pinId,
      title: (await read(S.PIN_PAGE.title, "text")) ?? "",
      description: (await read(S.PIN_PAGE.description, "content")) ?? "",
      date: fromJson?.date ?? null,
      imageUrl,
      isVideo,
    };
  } finally {
    await page.close();
  }
}

function sizeCandidates(url: string): string[] {
  const m = url.match(/^(https?:\/\/i\.pinimg\.com\/)([^/]+)(\/.+)$/);
  if (!m) return [url];
  const list = ["originals", "1200x", "736x"].map((s) => `${m[1]}${s}${m[3]}`);
  return list.includes(url) ? list : [...list, url];
}

async function download(context: BrowserContext, url: string, dir: string, pinId: string): Promise<string> {
  let lastError = "";
  for (const candidate of sizeCandidates(url)) {
    const res = await context.request.get(candidate, { timeout: 60_000 });
    if (!res.ok()) {
      lastError = `${candidate} → ${res.status()}`;
      continue;
    }
    const type = res.headers()["content-type"] ?? "";
    if (!type.startsWith("image/")) {
      lastError = `${candidate} is ${type}`;
      continue;
    }
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("gif") ? "gif" : "jpg";
    const file = `${pinId}.${ext}`;
    await writeFile(path.join(dir, file), await res.body());
    return file;
  }
  throw new Error(lastError || "no image");
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const debug = args.includes("--debug");
  const boards = args.filter((a) => !a.startsWith("--"));
  if (boards.length === 0) {
    console.error("Usage: npm run pinterest:download -- <board URL> [<board URL>…] [--debug]");
    process.exit(1);
  }

  const { chromium } = await import("playwright");
  await mkdir(OUT, { recursive: true });
  const context = await chromium.launchPersistentContext(path.join(OUT, ".browser-profile"), {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] ?? (await context.newPage());

  // Pin objects arrive in XHR responses as the board scrolls.
  const data = new Map<string, PinData>();
  page.on("response", async (res) => {
    if (!S.FEED_RESPONSE.test(res.url())) return;
    try {
      collectPins(await res.json(), data);
    } catch {
      /* not JSON */
    }
  });

  try {
    await waitForLogin(page);

    for (const boardUrl of boards) {
      const url = boardUrl.startsWith("http") ? boardUrl : `https://${boardUrl}`;
      const dir = path.join(OUT, boardSlug(url));
      const debugDir = debug ? path.join(dir, "debug") : null;
      await mkdir(dir, { recursive: true });
      const manifestPath = path.join(dir, "manifest.json");
      const manifest: Manifest = await readFile(manifestPath, "utf8")
        .then((t) => JSON.parse(t) as Manifest)
        .catch(() => ({ board: url, downloadedAt: "", pins: [], videos: [], failed: [] }));
      const done = new Set([...manifest.pins.map((p) => p.pinId), ...manifest.videos.map((v) => v.pinId)]);
      manifest.failed = [];

      console.info(`\n${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await sleep(2500);
      await embeddedPins(page, data);
      const ids = await scrollBoard(page, data, debugDir);
      console.info(`  ${ids.length} pins on the board, ${ids.filter((id) => done.has(id)).length} already saved`);

      for (const [i, pinId] of ids.entries()) {
        if (done.has(pinId)) continue;
        const pinUrl = `${S.PINTEREST}/pin/${pinId}/`;
        let pin = data.get(pinId) ?? null;
        if (!pin?.imageUrl && !pin?.isVideo) pin = await pinFromPage(context, pinId, debugDir);
        if (!pin) {
          manifest.failed.push({ pinId, url: pinUrl, reason: "no image found (try --debug)" });
          continue;
        }
        if (pin.isVideo) {
          manifest.videos.push({ pinId, url: pinUrl });
          console.info(`  video, skipped: ${pinUrl}`);
          continue;
        }
        try {
          const file = await download(context, pin.imageUrl!, dir, pinId);
          manifest.pins.push({ pinId, title: pin.title, description: pin.description, date: pin.date, url: pinUrl, file });
          console.info(`  ${i + 1}/${ids.length} ${pin.title || pinId}`);
        } catch (err) {
          manifest.failed.push({ pinId, url: pinUrl, reason: err instanceof Error ? err.message : String(err) });
        }
        manifest.downloadedAt = new Date().toISOString();
        if (manifest.pins.length % 10 === 0) await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        await sleep(300 + Math.random() * 400);
      }

      manifest.downloadedAt = new Date().toISOString();
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.info(`  saved ${manifest.pins.length} images to ${dir}`);
      if (manifest.videos.length > 0) console.info(`  video pins skipped (${manifest.videos.length}):\n    ${manifest.videos.map((v) => v.url).join("\n    ")}`);
      if (manifest.failed.length > 0) console.info(`  failed (${manifest.failed.length}):\n    ${manifest.failed.map((f) => `${f.url} — ${f.reason}`).join("\n    ")}`);
    }
  } finally {
    await context.close();
  }
  console.info("\nDone. Next: npm run import -- dispatch-import");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
