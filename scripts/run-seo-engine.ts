#!/usr/bin/env tsx
// Standalone runner: npx tsx scripts/run-seo-engine.ts
import path from "path";
import fs from "fs";

// Load .env.local manually (no dotenv dependency)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx);
      const val = trimmed.slice(eqIdx + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

import { runSEOEngine } from "../lib/ai/seo-engine";

async function main() {
  console.log("Starting SEO engine...");
  const logs = await runSEOEngine();
  console.log(`\nCompleted. Processed ${logs.length} posts.\n`);
  for (const log of logs) {
    console.log(`\n=== ${log.slug} ===`);
    console.log("Meta:", log.operations.metaDescription);
    console.log("Tags:", log.operations.tags);
    console.log("Title:", log.operations.titleTag);
    console.log("Excerpt:", log.operations.excerpt);
    console.log("Schema:", log.operations.schema);
  }
}

main().catch(console.error);
