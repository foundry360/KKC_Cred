#!/usr/bin/env node
/**
 * Apply 00007_provider_ids.sql when DATABASE_URL is set, otherwise print SQL.
 * Example: DATABASE_URL=postgresql://... npx tsx scripts/apply-provider-ids.ts
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: ".env.local" });
config();

const sqlPath = resolve("supabase/migrations/00007_provider_ids.sql");
const sql = readFileSync(sqlPath, "utf8");
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

async function main() {
  if (!databaseUrl) {
    console.log("Set DATABASE_URL (or SUPABASE_DB_URL) to apply automatically.");
    console.log("Or run this in the Supabase SQL editor:\n");
    console.log(sql);
    process.exit(0);
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Applied", sqlPath);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
