/**
 * Backlog import: uploads a folder of images to the DISPATCH store.
 *
 *   npm run import -- dispatch-import/<board>        one folder
 *   npm run import -- dispatch-import                 every board folder inside
 *   npm run import -- ~/Desktop/old-work --dry-run    show what would happen
 *
 * With a manifest.json (written by `npm run pinterest:download`) each entry
 * becomes a work with the pin's title, description and date. Without one,
 * every image file becomes a work titled from its file name. Duplicates are
 * skipped — by pin id, or by the file's hash. Imported works show on the
 * site with `held` deliveries: they are never dispatched unless the backlog
 * drip (BACKLOG_DRIP_PER_DAY) picks them up.
 *
 * Needs DATABASE_URL and BLOB_READ_WRITE_TOKEN — put them in .env.local
 * (copy both from Vercel → Settings → Environment Variables).
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local: rely on the shell */
}

const IMAGE = /\.(jpe?g|png|webp|gif|tiff?|avif)$/i;
const VIDEO = /\.(mp4|mov|m4v|webm|avi)$/i;

interface ManifestPin {
  pinId?: string;
  title?: string;
  description?: string;
  date?: string;
  url?: string;
  file?: string;
}

interface Manifest {
  board?: string;
  pins?: ManifestPin[];
}

interface Entry {
  file: string;
  sourceId: string | null;
  title: string;
  fallbackTitle: string;
  caption: string;
  createdAt: Date | null;
  sourceUrl: string | null;
}

async function exists(p: string): Promise<boolean> {
  return stat(p).then(
    () => true,
    () => false
  );
}

async function foldersToImport(root: string): Promise<string[]> {
  if (await exists(path.join(root, "manifest.json"))) return [root];
  const children = await readdir(root, { withFileTypes: true });
  const boards = [];
  for (const c of children) {
    if (c.isDirectory() && !c.name.startsWith(".") && (await exists(path.join(root, c.name, "manifest.json")))) boards.push(path.join(root, c.name));
  }
  return boards.length > 0 ? boards : [root];
}

async function entriesFor(folder: string): Promise<{ entries: Entry[]; videos: string[] }> {
  const { titleFromFileName } = await import("../../lib/dispatch/images");
  const manifestPath = path.join(folder, "manifest.json");
  const videos: string[] = [];
  if (await exists(manifestPath)) {
    const raw = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest | ManifestPin[];
    const pins = Array.isArray(raw) ? raw : (raw.pins ?? []);
    const entries: Entry[] = [];
    for (const pin of pins) {
      if (!pin.file) continue;
      const file = path.join(folder, pin.file);
      if (VIDEO.test(pin.file)) {
        videos.push(pin.file);
        continue;
      }
      if (!(await exists(file))) {
        console.warn(`  missing file for pin ${pin.pinId ?? "?"}: ${pin.file}`);
        continue;
      }
      const date = pin.date ? new Date(pin.date) : null;
      const description = (pin.description ?? "").trim();
      const title = (pin.title ?? "").trim();
      entries.push({
        file,
        sourceId: pin.pinId ? String(pin.pinId) : null,
        title,
        fallbackTitle: description.split(/(?<=[.!?])\s/)[0]?.slice(0, 80) || titleFromFileName(pin.file),
        caption: description && description !== title ? description : "",
        createdAt: date && !Number.isNaN(date.getTime()) ? date : null,
        sourceUrl: pin.url ?? (pin.pinId ? `https://www.pinterest.com/pin/${pin.pinId}/` : null),
      });
    }
    return { entries, videos };
  }
  const files = (await readdir(folder)).filter((f) => !f.startsWith(".")).sort();
  const entries: Entry[] = [];
  for (const name of files) {
    if (VIDEO.test(name)) videos.push(name);
    if (!IMAGE.test(name)) continue;
    const info = await stat(path.join(folder, name));
    entries.push({
      file: path.join(folder, name),
      sourceId: null,
      title: titleFromFileName(name),
      fallbackTitle: "Untitled",
      caption: "",
      createdAt: info.birthtime.getTime() > 0 ? info.birthtime : info.mtime,
      sourceUrl: null,
    });
  }
  return { entries, videos };
}

async function revalidateSite(slugs: string[]): Promise<void> {
  const { siteUrl } = await import("../../lib/dispatch/config");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.info("CRON_SECRET not set locally: /work refreshes by itself within the hour.");
    return;
  }
  try {
    const res = await fetch(`${siteUrl()}/api/dispatch/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ slugs }),
    });
    console.info(res.ok ? "Site refreshed." : `Site refresh answered ${res.status}: /work refreshes by itself within the hour.`);
  } catch {
    console.info("Could not reach the site: /work refreshes by itself within the hour.");
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const dryRun = args.includes("--dry-run");
  const roots = args.filter((a) => !a.startsWith("--"));
  if (roots.length === 0) {
    console.error("Usage: npm run import -- <folder> [--dry-run]");
    process.exit(1);
  }

  const { getDb } = await import("../../lib/dispatch/db/client");
  const { isBlobConfigured, blobStore } = await import("../../lib/dispatch/blob");
  const { sha256Hex } = await import("../../lib/dispatch/crypto");
  const { createWork, findBySource } = await import("../../lib/dispatch/works");
  const { BlobBudgetError, blobUsage } = await import("../../lib/dispatch/budget");

  const db = await getDb();
  if (!db || (!isBlobConfigured() && !dryRun)) {
    console.error("DATABASE_URL and BLOB_READ_WRITE_TOKEN must be set (in .env.local). See SETUP.md, step 5.");
    process.exit(1);
  }

  let imported = 0;
  let skipped = 0;
  const failed: string[] = [];
  const allVideos: string[] = [];
  const slugs: string[] = [];
  let stopped = false;

  const usage = await blobUsage(db, new Date());
  console.info(
    `Image storage this month: ${usage.puts} of ${usage.putBudget} operations, ${usage.mb} of ${usage.mbBudget} MB (each image uses 4 operations).`
  );

  for (const root of roots) {
    if (stopped) break;
    for (const folder of await foldersToImport(path.resolve(root))) {
      if (stopped) break;
      const { entries, videos } = await entriesFor(folder);
      allVideos.push(...videos.map((v) => path.join(folder, v)));
      console.info(`\n${folder}: ${entries.length} images`);
      for (const entry of entries) {
        const buffer = await readFile(entry.file);
        const sourceId = entry.sourceId ?? `sha256:${sha256Hex(buffer)}`;
        if (await findBySource(db, sourceId)) {
          skipped++;
          continue;
        }
        const label = entry.title || entry.fallbackTitle;
        if (dryRun) {
          console.info(`  would import: ${label}`);
          imported++;
          continue;
        }
        try {
          const { work, created } = await createWork(
            { db, now: new Date(), blob: blobStore(), rand: Math.random, revalidate: () => {} },
            {
              origin: "import",
              sourceId,
              sourceUrl: entry.sourceUrl,
              title: entry.title,
              fallbackTitle: entry.fallbackTitle,
              caption: entry.caption,
              createdAt: entry.createdAt ?? undefined,
              images: [{ buffer, alt: label }],
            },
            { mode: "held" }
          );
          if (created) {
            imported++;
            slugs.push(work.slug);
            console.info(`  + ${work.title}`);
          } else {
            skipped++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (err instanceof BlobBudgetError) {
            console.info(`\n${message}\nStopped here. Run the same command next month to continue — works already imported are skipped.`);
            stopped = true;
            break;
          }
          failed.push(`${entry.file}: ${message}`);
          console.warn(`  ! ${path.basename(entry.file)}: ${message}`);
        }
      }
    }
  }

  console.info(`\n${dryRun ? "Would import" : "Imported"} ${imported}, already there ${skipped}, failed ${failed.length}.`);
  if (allVideos.length > 0) console.info(`Videos are not supported yet and were left out:\n  ${allVideos.join("\n  ")}`);
  if (failed.length > 0) console.info(`Failed:\n  ${failed.join("\n  ")}`);
  if (!dryRun && imported > 0) await revalidateSite(slugs);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { closeDb } = await import("../../lib/dispatch/db/client");
    await closeDb();
  });
