/**
 * Export Supabase POC data to Salesforce Data Loader / Bulk API CSVs.
 *
 * Usage: npm run export:salesforce-csv
 * Output: data/exports/salesforce/*.csv
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve(process.cwd(), "data/exports/salesforce");

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i);
    const val = trimmed.slice(i + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Salesforce External_Id__c is Text(40). */
function sfExtId(v: unknown): string {
  const s = String(v ?? "");
  if (s.length <= 40) return s;
  // deterministic shrink: prefix + short hash
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hash = h.toString(16).padStart(8, "0").slice(0, 8);
  return `${s.slice(0, 31)}-${hash}`;
}

function writeCsv(
  filename: string,
  headers: string[],
  rows: Record<string, unknown>[],
) {
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ];
  const path = resolve(OUT_DIR, filename);
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
  console.log(`Wrote ${rows.length} rows → ${path}`);
}

function mapProviderStatus(s: string | null): string {
  switch ((s ?? "").toLowerCase()) {
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    case "suspended":
      return "Suspended";
    default:
      return "Pending";
  }
}

function mapCredType(s: string | null): string {
  const map: Record<string, string> = {
    medical_license: "Medical_License",
    dea: "DEA",
    board_certification: "Board_Certification",
    malpractice_insurance: "Malpractice_Insurance",
    facility_license: "Facility_License",
    accreditation: "Accreditation",
    clia: "CLIA",
    cme: "CME",
    other: "Other",
  };
  return map[(s ?? "").toLowerCase()] ?? "Other";
}

function mapCredStatus(s: string | null): string {
  const map: Record<string, string> = {
    valid: "Valid",
    expiring_soon: "Expiring_Soon",
    expired: "Expired",
    pending_verification: "Pending_Verification",
    rejected: "Rejected",
  };
  return map[(s ?? "").toLowerCase()] ?? "Pending_Verification";
}

function mapAppType(s: string | null): string {
  return (s ?? "").toLowerCase() === "recred" ? "Recred" : "New";
}

function mapPath(s: string | null): string {
  const map: Record<string, string> = {
    caqh: "CAQH",
    in_house: "In_House",
    facility: "Facility",
    delegated: "In_House",
  };
  return map[(s ?? "").toLowerCase()] ?? "CAQH";
}

function mapAppStatus(s: string | null): string {
  const map: Record<string, string> = {
    draft: "Draft",
    incomplete: "Incomplete",
    in_review: "In_Review",
    pending_committee: "Pending_Committee",
    approved: "Approved",
    denied: "Denied",
    withdrawn: "Withdrawn",
    termed: "Denied",
  };
  return map[(s ?? "").toLowerCase()] ?? "Draft";
}

function mapSubject(s: string | null): string {
  return (s ?? "").toLowerCase() === "facility" ? "Facility" : "Practitioner";
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");

  mkdirSync(OUT_DIR, { recursive: true });
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: providers, error: pErr } = await sb
    .from("providers")
    .select("*")
    .order("external_id");
  if (pErr) throw pErr;

  const { data: credentials, error: cErr } = await sb
    .from("credentials")
    .select("*, providers!inner(external_id)")
    .order("external_id");
  if (cErr) throw cErr;

  const { data: applications, error: aErr } = await sb
    .from("applications")
    .select("*, providers!inner(external_id)")
    .order("external_id");
  if (aErr) throw aErr;

  const { data: checklist, error: chErr } = await sb
    .from("checklist_items")
    .select("*, applications!inner(external_id)")
    .order("external_id");
  if (chErr) throw chErr;

  writeCsv(
    "01_Provider__c.csv",
    [
      "Name",
      "External_Id__c",
      "Subject_Type__c",
      "NPI__c",
      "First_Name__c",
      "Last_Name__c",
      "Specialty__c",
      "Facility_Type__c",
      "Organization_Name__c",
      "Email__c",
      "Phone__c",
      "Credentialing_Status__c",
      "Cred_Start_Date__c",
      "Cred_End_Date__c",
      "Recred_Due_Date__c",
    ],
    (providers ?? []).map((p) => ({
      Name: p.display_name,
      External_Id__c: sfExtId(p.external_id),
      Subject_Type__c: mapSubject(p.subject_type),
      NPI__c: p.npi,
      First_Name__c: p.first_name,
      Last_Name__c: p.last_name,
      Specialty__c: p.specialty,
      Facility_Type__c: p.facility_type,
      Organization_Name__c: p.organization_name,
      Email__c: p.email,
      Phone__c: p.phone,
      Credentialing_Status__c: mapProviderStatus(p.status),
      Cred_Start_Date__c: p.cred_start_date,
      Cred_End_Date__c: p.cred_end_date,
      Recred_Due_Date__c: p.recred_due_date,
    })),
  );

  writeCsv(
    "02_Provider_Credential__c.csv",
    [
      "External_Id__c",
      "Provider__r.External_Id__c",
      "Credential_Type__c",
      "Credential_Number__c",
      "Issuing_Authority__c",
      "Issued_Date__c",
      "Expiration_Date__c",
      "Status__c",
    ],
    (credentials ?? []).map((c) => ({
      External_Id__c: sfExtId(c.external_id),
      "Provider__r.External_Id__c": sfExtId(
        (c.providers as { external_id: string }).external_id,
      ),
      Credential_Type__c: mapCredType(c.credential_type),
      Credential_Number__c: c.credential_number,
      Issuing_Authority__c: c.issuing_authority,
      Issued_Date__c: c.issued_at,
      Expiration_Date__c: c.expires_at,
      Status__c: mapCredStatus(c.status),
    })),
  );

  writeCsv(
    "03_Credentialing_Application__c.csv",
    [
      "External_Id__c",
      "Provider__r.External_Id__c",
      "Application_Type__c",
      "Path__c",
      "Status__c",
      "Subject_Type__c",
      "Attempt_Count__c",
      "Due_Date__c",
    ],
    (applications ?? []).map((a) => ({
      External_Id__c: sfExtId(a.external_id),
      "Provider__r.External_Id__c": sfExtId(
        (a.providers as { external_id: string }).external_id,
      ),
      Application_Type__c: mapAppType(a.application_type),
      Path__c: mapPath(a.path),
      Status__c: mapAppStatus(a.status),
      Subject_Type__c: mapSubject(a.subject_type),
      Attempt_Count__c: a.attempt_count ?? 0,
      Due_Date__c: a.due_date,
    })),
  );

  writeCsv(
    "04_Checklist_Item__c.csv",
    [
      "Name",
      "External_Id__c",
      "Credentialing_Application__r.External_Id__c",
      "Item_Key__c",
      "Required__c",
      "Complete__c",
      "Sort_Order__c",
    ],
    (checklist ?? []).map((c) => ({
      Name: c.label,
      External_Id__c: sfExtId(c.external_id),
      "Credentialing_Application__r.External_Id__c": sfExtId(
        (c.applications as { external_id: string }).external_id,
      ),
      Item_Key__c: c.item_key,
      Required__c: c.required ? "true" : "false",
      Complete__c: c.complete ? "true" : "false",
      Sort_Order__c: c.sort_order ?? 0,
    })),
  );

  console.log("\nReady for upsert (External_Id__c). Order: 01 → 02 → 03 → 04");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
