#!/usr/bin/env node
/**
 * Apply 00005_psv.sql using DATABASE_URL if provided.
 * Fallback: print supabase login / db push instructions.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/apply-psv-migration.ts
 * or:
 *   supabase login && supabase link --project-ref jkfzojmltfxwgrkrrpsf && npm run db:push
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  const sqlPath = resolve("supabase/migrations/00005_psv.sql");
  const sql = readFileSync(sqlPath, "utf8");

  if (!dbUrl) {
    console.log("No DATABASE_URL / SUPABASE_DB_URL set.");
    console.log("Apply the PSV migration with:");
    console.log("  npx supabase login");
    console.log("  npx supabase link --project-ref jkfzojmltfxwgrkrrpsf");
    console.log("  npm run db:push");
    console.log("Then: npm run seed:psv-demo");
    process.exit(0);
  }

  const { default: pg } = await import("pg").catch(() => ({ default: null }));
  if (!pg) {
    console.error("Install pg to apply via DATABASE_URL: npm i -D pg");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Applied 00005_psv.sql");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
