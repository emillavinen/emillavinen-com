import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { env, logOnce } from "../config";
import * as schema from "./schema";

/**
 * The store is Postgres through Drizzle. In production that is Neon over
 * HTTP (`drizzle-orm/neon-http`), which has no interactive transactions — so
 * every state change in DISPATCH is a single conditional statement. Tests run
 * the same code against PGlite.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let instance: Db | null | undefined;
let closeLocal: (() => Promise<void>) | null = null;

export function isStoreConfigured(): boolean {
  return instance ? true : Boolean(env("DATABASE_URL"));
}

/**
 * Returns the database, or null when DATABASE_URL is not set. Loaded lazily
 * so a build with no DISPATCH configuration never touches the driver.
 */
export async function getDb(): Promise<Db | null> {
  if (instance !== undefined && instance !== null) return instance;
  const url = env("DATABASE_URL");
  if (!url) {
    logOnce("no-db", "DATABASE_URL is not set — the works store is off (gallery empty, runner idle).");
    return null;
  }
  if (isLocalUrl(url)) {
    // Development only: a Postgres on this machine (e.g. `pnpm dev:db`),
    // reached over TCP instead of Neon's HTTP endpoint.
    const [{ default: postgres }, { drizzle }] = await Promise.all([import("postgres"), import("drizzle-orm/postgres-js")]);
    const client = postgres(url, { max: 1 });
    closeLocal = () => client.end();
    instance = drizzle(client, { schema }) as unknown as Db;
    return instance;
  }
  const [{ neon }, { drizzle }] = await Promise.all([
    import("@neondatabase/serverless"),
    import("drizzle-orm/neon-http"),
  ]);
  instance = drizzle(neon(url), { schema }) as unknown as Db;
  return instance;
}

export function isLocalUrl(url: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Lets a script exit: closes the local TCP connection (Neon over HTTP holds none). */
export async function closeDb(): Promise<void> {
  await closeLocal?.();
  closeLocal = null;
  instance = undefined;
}

/** Test hook: point DISPATCH at another database (PGlite), or reset. */
export function setDbForTests(db: Db | null | undefined): void {
  instance = db;
}
