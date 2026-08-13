/**
 * Seed Supabase from Provider_Credentialing_Dataset.xlsx
 *
 * Usage: npm run seed:credentialing
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";

const WORKBOOK = resolve(
  process.cwd(),
  "data/fixtures/Provider_Credentialing_Dataset.xlsx",
);

type Row = Record<string, unknown>;

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

function sheetRows(wb: XLSX.WorkBook, name: string): Row[] {
  const sheet = wb.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, raw: false });
}

function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v).trim();
}

function excelDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    // Excel serial (Windows 1900 epoch)
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // Already ISO-ish or locale date
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function mapProviderStatus(raw: string | null): string {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("active") && !s.includes("pending")) return "active";
  if (s.includes("suspend")) return "suspended";
  if (s.includes("inactive") || s.includes("term")) return "inactive";
  return "pending";
}

function mapCredStatus(
  raw: string | null,
  expiresAt: string | null,
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (expiresAt) {
    const exp = new Date(expiresAt + "T00:00:00Z");
    const days = Math.round((exp.getTime() - today.getTime()) / 86400000);
    if (days < 0) return "expired";
    if (days <= 90) return "expiring_soon";
  }
  const s = (raw ?? "").toLowerCase();
  if (s.includes("expir")) return expiresAt ? "expired" : "expiring_soon";
  if (s.includes("active") || s.includes("valid") || s.includes("current"))
    return "valid";
  if (s.includes("reject")) return "rejected";
  return "pending_verification";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function upsertMany(
  sb: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict = "external_id",
) {
  if (rows.length === 0) return 0;
  const chunk = 200;
  let total = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error, count } = await sb
      .from(table)
      .upsert(slice, { onConflict, count: "exact" });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
    total += count ?? slice.length;
  }
  return total;
}

const SYNTHETIC_FACILITIES = [
  {
    id: "FAC-2001",
    name: "Coastal Ambulatory Surgery Center",
    type: "ASC",
    group: "Coastal Medical Group",
    tin: "83-1129483",
    npi: "1679902001",
    state: "NY",
    status: "Active",
    credStart: "2023-06-01",
    credEnd: "2026-06-01",
  },
  {
    id: "FAC-2002",
    name: "Harborview Imaging Center",
    type: "Imaging",
    group: "Harborview Multispecialty Group",
    tin: "86-4453321",
    npi: "1679902002",
    state: "CA",
    status: "Active",
    credStart: "2024-01-15",
    credEnd: "2027-01-15",
  },
  {
    id: "FAC-2003",
    name: "Sunrise Behavioral Health Clinic",
    type: "Clinic",
    group: "Sunrise Health Partners",
    tin: "81-3345210",
    npi: "1679902003",
    state: "OH",
    status: "Pending Recredentialing",
    credStart: "2023-03-01",
    credEnd: "2026-03-01",
  },
  {
    id: "FAC-2004",
    name: "Meridian Skilled Nursing",
    type: "SNF",
    group: "Meridian Physician Network",
    tin: "84-2201175",
    npi: "1679902004",
    state: "TX",
    status: "Active",
    credStart: "2022-09-01",
    credEnd: "2025-09-01",
  },
  {
    id: "FAC-2005",
    name: "Vanguard Urgent Care — Midtown",
    type: "Urgent Care",
    group: "Vanguard Clinical Associates",
    tin: "85-9987234",
    npi: "1679902005",
    state: "FL",
    status: "Active",
    credStart: "2024-05-01",
    credEnd: "2027-05-01",
  },
  {
    id: "FAC-2006",
    name: "Lakeside Reference Lab",
    type: "Lab",
    group: "Coastal Medical Group",
    tin: "83-1129483",
    npi: "1679902006",
    state: "NY",
    status: "Active",
    credStart: "2023-11-01",
    credEnd: "2026-11-01",
  },
  {
    id: "FAC-2007",
    name: "Summit Physical Therapy",
    type: "PT",
    group: "Harborview Multispecialty Group",
    tin: "86-4453321",
    npi: "1679902007",
    state: "CA",
    status: "Provisional",
    credStart: "2025-01-01",
    credEnd: "2028-01-01",
  },
  {
    id: "FAC-2008",
    name: "Independent Surgical Pavilion",
    type: "ASC",
    group: "Independent Surgical Holdings",
    tin: "92-5567812",
    npi: "1679902008",
    state: "AZ",
    status: "Under Committee Review",
    credStart: "2022-08-01",
    credEnd: "2025-08-01",
  },
] as const;

const PRACT_CHECKLIST = [
  { key: "medical_license_copy", label: "Medical license copy" },
  { key: "dea_certificate", label: "DEA certificate" },
  { key: "board_certification", label: "Board certification" },
  { key: "malpractice_coi", label: "Malpractice COI" },
  { key: "caqh_attestation", label: "CAQH attestation" },
];

const FAC_CHECKLIST = [
  { key: "facility_license", label: "Facility license" },
  { key: "accreditation", label: "Accreditation" },
  { key: "malpractice_coi", label: "Malpractice COI" },
  { key: "ownership_documentation", label: "Ownership documentation" },
];

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!existsSync(WORKBOOK)) {
    throw new Error(`Workbook not found: ${WORKBOOK}`);
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Reading", WORKBOOK);
  const wb = XLSX.readFile(WORKBOOK, { cellDates: true });
  console.log("Sheets:", wb.SheetNames.join(", "));

  const providersSheet = sheetRows(wb, "Providers");
  const licenses = sheetRows(wb, "Licenses");
  const boards = sheetRows(wb, "Board_Certifications");
  const dea = sheetRows(wb, "DEA_Registrations");
  const malpractice = sheetRows(wb, "Malpractice_Insurance");
  const sanctions = sheetRows(wb, "Sanctions_Exclusions_Monitoring");
  const facilitiesSheet = sheetRows(wb, "Facilities");

  // ---- organizations ----
  const orgByTin = new Map<string, { external_id: string; name: string; tin: string; org_type: string }>();
  for (const r of providersSheet) {
    const name = str(r["Group/TIN Entity"]);
    const tin = str(r["TIN"]);
    if (!name || !tin) continue;
    if (!orgByTin.has(tin)) {
      orgByTin.set(tin, {
        external_id: `ORG-${tin.replace(/[^0-9A-Za-z]/g, "")}`,
        name,
        tin,
        org_type: "group",
      });
    }
  }
  for (const f of SYNTHETIC_FACILITIES) {
    if (!orgByTin.has(f.tin)) {
      orgByTin.set(f.tin, {
        external_id: `ORG-${f.tin.replace(/[^0-9A-Za-z]/g, "")}`,
        name: f.group,
        tin: f.tin,
        org_type: "group",
      });
    }
  }
  // Also parse facility sheet orgs if present
  for (const r of facilitiesSheet) {
    const name = str(r["Group/TIN Entity"]) ?? str(r["Group"]);
    const tin = str(r["TIN"]);
    if (!name || !tin) continue;
    if (!orgByTin.has(tin)) {
      orgByTin.set(tin, {
        external_id: `ORG-${tin.replace(/[^0-9A-Za-z]/g, "")}`,
        name,
        tin,
        org_type: "group",
      });
    }
  }

  const orgRows = [...orgByTin.values()];
  console.log(`Upserting ${orgRows.length} organizations…`);
  await upsertMany(sb, "organizations", orgRows);

  const { data: orgData, error: orgErr } = await sb
    .from("organizations")
    .select("id, tin, external_id");
  if (orgErr) throw orgErr;
  const orgIdByTin = new Map(
    (orgData ?? []).filter((o) => o.tin).map((o) => [o.tin as string, o.id as string]),
  );

  // ---- practitioners ----
  const providerRows = providersSheet.map((r) => {
    const externalId = str(r["Provider ID"])!;
    const first = str(r["First Name"]);
    const last = str(r["Last Name"]);
    const tin = str(r["TIN"]);
    const credEnd = excelDate(r["Cred. Expiration Date"]);
    return {
      external_id: externalId,
      subject_type: "practitioner",
      organization_id: tin ? orgIdByTin.get(tin) ?? null : null,
      organization_name: str(r["Group/TIN Entity"]),
      npi: str(r["NPI"]),
      first_name: first,
      last_name: last,
      display_name: [first, last].filter(Boolean).join(" ") || externalId,
      specialty: str(r["Specialty"]),
      facility_type: null,
      email: null,
      phone: null,
      status: mapProviderStatus(str(r["Credentialing Status"])),
      cred_start_date: excelDate(r["Cred. Effective Date"]),
      cred_end_date: credEnd,
      recred_due_date: credEnd,
    };
  });

  // ---- facilities (from sheet or synthetic) ----
  let facilityRows;
  if (facilitiesSheet.length > 0) {
    facilityRows = facilitiesSheet.map((r) => {
      const externalId = str(r["Facility ID"])!;
      const name = str(r["Facility Name"]) ?? externalId;
      const tin = str(r["TIN"]);
      const credEnd = excelDate(r["Cred. Expiration Date"]);
      return {
        external_id: externalId,
        subject_type: "facility" as const,
        organization_id: tin ? orgIdByTin.get(tin) ?? null : null,
        organization_name: str(r["Group/TIN Entity"]) ?? str(r["Group"]),
        npi: str(r["NPI"]),
        first_name: null,
        last_name: null,
        display_name: name,
        specialty: null,
        facility_type: str(r["Facility Type"]),
        email: null,
        phone: null,
        status: mapProviderStatus(str(r["Credentialing Status"])),
        cred_start_date: excelDate(r["Cred. Effective Date"]),
        cred_end_date: credEnd,
        recred_due_date: credEnd,
      };
    });
  } else {
    console.log("No Facilities sheet — seeding 8 synthetic facilities from POC plan");
    facilityRows = SYNTHETIC_FACILITIES.map((f) => ({
      external_id: f.id,
      subject_type: "facility" as const,
      organization_id: orgIdByTin.get(f.tin) ?? null,
      organization_name: f.group,
      npi: f.npi,
      first_name: null,
      last_name: null,
      display_name: f.name,
      specialty: null,
      facility_type: f.type,
      email: null,
      phone: null,
      status: mapProviderStatus(f.status),
      cred_start_date: f.credStart,
      cred_end_date: f.credEnd,
      recred_due_date: f.credEnd,
    }));
  }

  console.log(
    `Upserting ${providerRows.length} practitioners + ${facilityRows.length} facilities…`,
  );
  await upsertMany(sb, "providers", [...providerRows, ...facilityRows]);

  const { data: provData, error: provErr } = await sb
    .from("providers")
    .select("id, external_id, subject_type");
  if (provErr) throw provErr;
  const providerIdByExt = new Map(
    (provData ?? []).map((p) => [p.external_id as string, p.id as string]),
  );

  // ---- credentials ----
  const credRows: Record<string, unknown>[] = [];

  for (const r of licenses) {
    const pid = str(r["Provider ID"]);
    if (!pid || !providerIdByExt.has(pid)) continue;
    const expires = excelDate(r["Expiration Date"]);
    const num = str(r["License Number"]);
    credRows.push({
      external_id: `${pid}-LIC-${num ?? slugify(str(r["State"]) ?? "x")}`,
      provider_id: providerIdByExt.get(pid),
      credential_type: "medical_license",
      credential_number: num,
      issuing_authority: str(r["State"]),
      issued_at: excelDate(r["Issue Date"]),
      expires_at: expires,
      status: mapCredStatus(str(r["Status"]), expires),
      name: str(r["License Type"]) ?? "Medical License",
    });
  }

  for (const r of boards) {
    const pid = str(r["Provider ID"]);
    if (!pid || !providerIdByExt.has(pid)) continue;
    const expires = excelDate(r["Expiration Date"]);
    const cert = str(r["Certification"]) ?? "Board Certification";
    credRows.push({
      external_id: `${pid}-BOARD-${slugify(cert)}`,
      provider_id: providerIdByExt.get(pid),
      credential_type: "board_certification",
      credential_number: null,
      issuing_authority: str(r["Certifying Board"]),
      issued_at: excelDate(r["Certification Date"]),
      expires_at: expires,
      status: mapCredStatus(str(r["Status"]), expires),
      name: cert,
    });
  }

  for (const r of dea) {
    const pid = str(r["Provider ID"]);
    if (!pid || !providerIdByExt.has(pid)) continue;
    const expires = excelDate(r["Expiration Date"]);
    const num = str(r["DEA Number"]);
    credRows.push({
      external_id: `${pid}-DEA-${num ?? "x"}`,
      provider_id: providerIdByExt.get(pid),
      credential_type: "dea",
      credential_number: num,
      issuing_authority: "DEA",
      issued_at: null,
      expires_at: expires,
      status: mapCredStatus(str(r["Status"]), expires),
      name: `DEA ${str(r["Schedule"]) ?? ""}`.trim(),
    });
  }

  for (const r of malpractice) {
    const pid = str(r["Provider ID"]);
    if (!pid || !providerIdByExt.has(pid)) continue;
    const expires = excelDate(r["Expiration Date"]);
    const num = str(r["Policy Number"]);
    credRows.push({
      external_id: `${pid}-MAL-${num ?? "x"}`,
      provider_id: providerIdByExt.get(pid),
      credential_type: "malpractice_insurance",
      credential_number: num,
      issuing_authority: str(r["Carrier"]),
      issued_at: excelDate(r["Effective Date"]),
      expires_at: expires,
      status: mapCredStatus(str(r["Status"]), expires),
      name: `Malpractice ${str(r["Coverage Limits"]) ?? ""}`.trim(),
    });
  }

  // Synthetic facility credentials when Facilities sheet absent
  if (facilitiesSheet.length === 0) {
    for (const f of SYNTHETIC_FACILITIES) {
      const providerId = providerIdByExt.get(f.id);
      if (!providerId) continue;
      const licenseExp =
        f.id === "FAC-2004"
          ? "2025-06-01" // expired-ish relative to mid-2026
          : f.id === "FAC-2003"
            ? "2026-09-15" // expiring soon
            : f.credEnd;
      credRows.push({
        external_id: `${f.id}-FACLIC`,
        provider_id: providerId,
        credential_type: "facility_license",
        credential_number: `${f.state}-FAC-${f.id.slice(-4)}`,
        issuing_authority: f.state,
        issued_at: f.credStart,
        expires_at: licenseExp,
        status: mapCredStatus("Active", licenseExp),
        name: `${f.type} Facility License`,
      });
      credRows.push({
        external_id: `${f.id}-ACCRED`,
        provider_id: providerId,
        credential_type: "accreditation",
        credential_number: `ACC-${f.id.slice(-4)}`,
        issuing_authority:
          f.type === "ASC"
            ? "AAAHC"
            : f.type === "SNF"
              ? "CMS"
              : "Joint Commission",
        issued_at: f.credStart,
        expires_at: f.credEnd,
        status: mapCredStatus("Active", f.credEnd),
        name: "Accreditation",
      });
      credRows.push({
        external_id: `${f.id}-MAL`,
        provider_id: providerId,
        credential_type: "malpractice_insurance",
        credential_number: `MP-FAC-${f.id.slice(-4)}`,
        issuing_authority: "Coverys",
        issued_at: f.credStart,
        expires_at: f.credEnd,
        status: mapCredStatus("Active", f.credEnd),
        name: "Entity Malpractice",
      });
      if (f.type === "Lab") {
        credRows.push({
          external_id: `${f.id}-CLIA`,
          provider_id: providerId,
          credential_type: "clia",
          credential_number: `CLIA-${f.id.slice(-4)}`,
          issuing_authority: "CMS",
          issued_at: f.credStart,
          expires_at: f.credEnd,
          status: mapCredStatus("Active", f.credEnd),
          name: "CLIA Certificate",
        });
      }
    }
  }

  console.log(`Upserting ${credRows.length} credentials…`);
  await upsertMany(sb, "credentials", credRows);

  // ---- sanctions ----
  const sanctionRows: Record<string, unknown>[] = [];
  for (const r of sanctions) {
    const pid = str(r["Provider ID"]);
    if (!pid || !providerIdByExt.has(pid)) continue;
    sanctionRows.push({
      external_id: `${pid}-SANC`,
      provider_id: providerIdByExt.get(pid),
      source: "OIG/SAM/NPDB/State Board",
      checked_at: excelDate(r["OIG LEIE Check Date"]),
      result: str(r["Result"]),
      notes: `Next due: ${excelDate(r["Next Monthly Check Due"]) ?? "n/a"}`,
    });
  }
  if (facilitiesSheet.length === 0) {
    for (const f of SYNTHETIC_FACILITIES) {
      const providerId = providerIdByExt.get(f.id);
      if (!providerId) continue;
      sanctionRows.push({
        external_id: `${f.id}-SANC`,
        provider_id: providerId,
        source: "OIG/SAM",
        checked_at: "2026-07-01",
        result: "Clear",
        notes: "Synthetic facility monitoring",
      });
    }
  }
  console.log(`Upserting ${sanctionRows.length} sanctions checks…`);
  await upsertMany(sb, "sanctions_checks", sanctionRows);

  // ---- POC overlays: demo applications + checklists + outreach ----
  const demoSubjects = [
    { ext: "PRV-1001", type: "new" as const, path: "caqh" as const, status: "incomplete" as const, attempts: 2 },
    { ext: "PRV-1002", type: "recred" as const, path: "caqh" as const, status: "in_review" as const, attempts: 0 },
    { ext: "FAC-2001", type: "new" as const, path: "facility" as const, status: "draft" as const, attempts: 0 },
    { ext: "FAC-2003", type: "recred" as const, path: "facility" as const, status: "incomplete" as const, attempts: 1 },
  ];

  const appRows = [];
  for (const d of demoSubjects) {
    const providerId = providerIdByExt.get(d.ext);
    if (!providerId) continue;
    const subjectType = d.ext.startsWith("FAC") ? "facility" : "practitioner";
    appRows.push({
      external_id: `${d.ext}-APP-${d.type.toUpperCase()}`,
      provider_id: providerId,
      organization_id: null,
      application_type: d.type,
      path: d.path,
      subject_type: subjectType,
      status: d.status,
      attempt_count: d.attempts,
      due_date: "2026-09-30",
      submitted_at: d.status === "draft" ? null : new Date().toISOString(),
    });
  }
  console.log(`Upserting ${appRows.length} demo applications…`);
  await upsertMany(sb, "applications", appRows);

  const { data: appData, error: appErr } = await sb
    .from("applications")
    .select("id, external_id, subject_type, status, attempt_count");
  if (appErr) throw appErr;

  const checklistRows: Record<string, unknown>[] = [];
  const outreachRows: Record<string, unknown>[] = [];
  for (const app of appData ?? []) {
    const template =
      app.subject_type === "facility" ? FAC_CHECKLIST : PRACT_CHECKLIST;
    template.forEach((item, idx) => {
      const complete =
        app.status === "in_review" ||
        app.status === "approved" ||
        (app.status === "incomplete" && idx < 2);
      checklistRows.push({
        external_id: `${app.external_id}-CHK-${item.key}`,
        application_id: app.id,
        item_key: item.key,
        label: item.label,
        required: true,
        complete,
        sort_order: idx + 1,
      });
    });
    const attempts = Number(app.attempt_count ?? 0);
    for (let n = 1; n <= attempts; n++) {
      outreachRows.push({
        external_id: `${app.external_id}-OUT-${n}`,
        application_id: app.id,
        attempt_number: n,
        channel: "phone",
        notes: `POC chase attempt ${n}`,
        attempted_at: new Date(Date.now() - (attempts - n) * 86400000).toISOString(),
      });
    }
  }
  console.log(`Upserting ${checklistRows.length} checklist items…`);
  await upsertMany(sb, "checklist_items", checklistRows);
  console.log(`Upserting ${outreachRows.length} outreach attempts…`);
  await upsertMany(sb, "outreach_attempts", outreachRows);

  // ---- summary ----
  const counts: Record<string, number> = {};
  for (const t of [
    "organizations",
    "providers",
    "credentials",
    "sanctions_checks",
    "applications",
    "checklist_items",
    "outreach_attempts",
  ]) {
    const { count, error } = await sb
      .from(t)
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    counts[t] = count ?? 0;
  }
  console.log("\nSeed complete:");
  console.table(counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
