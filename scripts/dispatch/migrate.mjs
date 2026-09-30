// Applies DISPATCH's database migrations (drizzle/) before `next build`.
// With no DATABASE_URL it does nothing, quietly, so the site still builds
// with zero DISPATCH configuration. A failing migration fails the build: a
// deploy running new code against an old schema would be worse.

const url = process.env.DATABASE_URL?.trim();

if (!url) {
  console.info("[dispatch] DATABASE_URL not set — skipping migrations.");
  process.exit(0);
}

const { neon } = await import("@neondatabase/serverless");
const { drizzle } = await import("drizzle-orm/neon-http");
const { migrate } = await import("drizzle-orm/neon-http/migrator");

const started = Date.now();
await migrate(drizzle(neon(url)), { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
console.info(`[dispatch] migrations applied in ${Date.now() - started} ms.`);
