/**
 * Backfill PSV results from Supabase → Salesforce for one application.
 * Usage: npx tsx scripts/sync-psv-to-sf.ts [applicationId|external_id]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createServiceClient } from "../src/lib/supabase/admin";
import { syncPsvResultsToSalesforce } from "../src/lib/salesforce/psvSync";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      "Usage: npx tsx scripts/sync-psv-to-sf.ts <applicationId|external_id>",
    );
    process.exit(1);
  }

  const sb = createServiceClient();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      arg,
    );

  const query = isUuid
    ? sb
        .from("applications")
        .select("id, external_id, psv_status, readiness_score")
        .eq("id", arg)
        .limit(1)
    : sb
        .from("applications")
        .select("id, external_id, psv_status, readiness_score")
        .eq("external_id", arg)
        .limit(1);

  const { data: apps, error } = await query;
  if (error) throw error;
  const app = apps?.[0];
  if (!app) {
    console.error("Application not found:", arg);
    process.exit(1);
  }

  console.log(
    "Syncing PSV",
    app.external_id,
    app.psv_status,
    `${app.readiness_score ?? "—"}%`,
  );
  const result = await syncPsvResultsToSalesforce(app.id);
  console.log(result);
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
