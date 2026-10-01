// Applies DISPATCH's database migrations (drizzle/) before `next build`.
// With no DATABASE_URL it does nothing, quietly, so the site still builds
// with zero DISPATCH configuration. A failing migration fails the build: a
// deploy running new code against an old schema would be worse.

const url = process.env.DATABASE_URL?.trim();

if (!url) {
  console.info("[dispatch] DATABASE_URL not set — skipping migrations.");
  process.exit(0);
}

const migrationsFolder = new URL("../../drizzle", import.meta.url).pathname;
const started = Date.now();
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();

if (["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
  // Development: a local Postgres (pnpm dev:db) over TCP.
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder });
  await client.end();
} else {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { migrate } = await import("drizzle-orm/neon-http/migrator");
  await migrate(drizzle(neon(url)), { migrationsFolder });
}
console.info(`[dispatch] migrations applied in ${Date.now() - started} ms.`);
