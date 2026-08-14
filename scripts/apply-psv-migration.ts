#!/usr/bin/env node
/**
 * Print how to apply the PSV migration.
 * Prefer: supabase login && supabase link && npm run db:push
 */
import { resolve } from "path";

const sqlPath = resolve("supabase/migrations/00005_psv.sql");

console.log("Apply PSV schema with Supabase CLI:");
console.log("  npx supabase login");
console.log("  npx supabase link --project-ref jkfzojmltfxwgrkrrpsf");
console.log("  npm run db:push");
console.log("");
console.log("Or run the SQL in the Supabase Dashboard SQL editor:");
console.log(`  ${sqlPath}`);
console.log("");
console.log("Then seed demo cases:");
console.log("  npm run seed:psv-demo");
