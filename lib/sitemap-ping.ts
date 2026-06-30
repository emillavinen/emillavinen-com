import fs from "fs";
import path from "path";

const PING_LOG_PATH = path.join(process.cwd(), "PING_LOG.md");
const SITEMAP_URL = "https://emillavinen.com/sitemap.xml";

const PING_TARGETS = {
  Google: `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
  Bing: `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
};

function appendPingLog(entry: string) {
  const timestamp = new Date().toISOString();
  const line = `\n[${timestamp}] ${entry}`;
  try {
    if (!fs.existsSync(PING_LOG_PATH)) {
      fs.writeFileSync(PING_LOG_PATH, "# Sitemap Ping Log\n", "utf8");
    }
    fs.appendFileSync(PING_LOG_PATH, line, "utf8");
  } catch {
    // Never throw — log failures silently
  }
}

async function pingOne(name: string, url: string, attempt = 1): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "GET" });
    if (res.ok) {
      appendPingLog(`✓ ${name} ping succeeded (HTTP ${res.status})`);
      return true;
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    if (attempt === 1) {
      await new Promise((r) => setTimeout(r, 5000));
      return pingOne(name, url, 2);
    }
    appendPingLog(`✗ ${name} ping failed after retry: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export async function pingSitemap(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    appendPingLog("Skipped (non-production environment)");
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    appendPingLog("Skipped (NEXT_PUBLIC_SITE_URL not set)");
    return;
  }

  try {
    await Promise.all(
      Object.entries(PING_TARGETS).map(([name, url]) => pingOne(name, url))
    );
  } catch {
    // Never throw
  }
}
