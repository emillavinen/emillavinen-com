import { defineConfig } from "drizzle-kit";

// DISPATCH migrations. `pnpm db:generate` writes SQL into drizzle/ from the
// schema; scripts/dispatch/migrate.mjs applies it during `pnpm build` when
// DATABASE_URL is set.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/dispatch/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
