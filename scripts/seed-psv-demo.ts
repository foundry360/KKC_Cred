/**
 * Seed two PSV demo cases:
 * 1) Jane Smith — identity match (LIVE NPPES NPI 1780347815)
 * 2) Jane Smith application vs Jane Smyth license fixture — mismatch
 *
 * Usage: npx tsx scripts/seed-psv-demo.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function ext(prefix: string, tag: string) {
  return `${prefix}-PSV-${tag}`;
}

async function upsertProvider(row: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("providers")
    .upsert(row, { onConflict: "external_id" })
    .select("id, external_id")
    .single();
  if (error) throw error;
  return data;
}

async function upsertApp(row: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("applications")
    .upsert(row, { onConflict: "external_id" })
    .select("id, external_id")
    .single();
  if (error) throw error;
  return data;
}

async function clearPsvArtifacts(appId: string) {
  await supabase.from("credential_requirements").delete().eq("application_id", appId);
  await supabase.from("verifications").delete().eq("application_id", appId);
  await supabase.from("verification_evidence").delete().eq("application_id", appId);
  await supabase.from("credentialing_exceptions").delete().eq("application_id", appId);
  await supabase.from("extracted_credential_data").delete().eq("application_id", appId);
  await supabase.from("documents").delete().eq("application_id", appId);
  await supabase
    .from("applications")
    .update({ psv_status: "not_started", readiness_score: null, psv_ran_at: null })
    .eq("id", appId);
}

async function main() {
  const matchProvider = await upsertProvider({
    external_id: ext("PRV", "JANE-MATCH"),
    subject_type: "practitioner",
    npi: "1780347815",
    first_name: "Jane",
    last_name: "Smith",
    display_name: "Jane Smith",
    specialty: "Speech-Language Pathology",
    email: "jane.smith.psv@example.com",
    phone: "813-555-0100",
    practice_state: "FL",
    status: "pending",
  });

  const matchApp = await upsertApp({
    external_id: ext("APP", "JANE-MATCH"),
    provider_id: matchProvider.id,
    application_type: "new",
    path: "in_house",
    subject_type: "practitioner",
    status: "incomplete",
    credentialing_action: "initial",
    profession: "Speech-Language Pathologist",
    license_number: "SZ10229",
    license_state: "FL",
    requesting_organization: "Meridian Credentialing POC",
    psv_status: "not_started",
  });

  const mismatchProvider = await upsertProvider({
    external_id: ext("PRV", "JANE-MISMATCH"),
    subject_type: "practitioner",
    npi: "1780347815",
    first_name: "Jane",
    middle_name: "A",
    last_name: "Smith",
    display_name: "Jane A. Smith",
    specialty: "Cardiology",
    email: "jane.smyth.psv@example.com",
    phone: "813-555-0199",
    practice_state: "FL",
    status: "pending",
  });

  const mismatchApp = await upsertApp({
    external_id: ext("APP", "JANE-MISMATCH"),
    provider_id: mismatchProvider.id,
    application_type: "new",
    path: "in_house",
    subject_type: "practitioner",
    status: "incomplete",
    credentialing_action: "initial",
    profession: "Medical Doctor",
    license_number: "SZ99999",
    license_state: "FL",
    requesting_organization: "Meridian Credentialing POC",
    psv_status: "not_started",
  });

  await clearPsvArtifacts(matchApp.id);
  await clearPsvArtifacts(mismatchApp.id);

  const docs = [
    {
      external_id: ext("DOC", "JANE-MATCH-LIC"),
      provider_id: matchProvider.id,
      application_id: matchApp.id,
      file_name: "florida-medical-license.pdf",
      content_type: "application/pdf",
      storage_path: "demo/florida-medical-license.pdf",
      document_type: "medical_license",
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
    },
    {
      external_id: ext("DOC", "JANE-MATCH-CV"),
      provider_id: matchProvider.id,
      application_id: matchApp.id,
      file_name: "jane-smith-cv.pdf",
      content_type: "application/pdf",
      storage_path: "demo/jane-smith-cv.pdf",
      document_type: "cv",
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
    },
    {
      external_id: ext("DOC", "JANE-MISMATCH-LIC"),
      provider_id: mismatchProvider.id,
      application_id: mismatchApp.id,
      file_name: "license-jane-smyth.pdf",
      content_type: "application/pdf",
      storage_path: "demo/license-jane-smyth.pdf",
      document_type: "medical_license",
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
    },
  ];

  const { error: docErr } = await supabase.from("documents").insert(docs);
  if (docErr) throw docErr;

  console.log("Seeded PSV demo cases:");
  console.log("  MATCH   ", matchApp.external_id, matchApp.id);
  console.log("  MISMATCH", mismatchApp.external_id, mismatchApp.id);
  console.log("Open /psv and run the PSV pipeline on each case.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
