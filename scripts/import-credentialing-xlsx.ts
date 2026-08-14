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

const UNDERGRAD_SCHOOLS = [
  "State University",
  "Coastal College",
  "Midwestern University",
  "Pacific Liberal Arts College",
];

const MED_SCHOOLS = [
  "University School of Medicine",
  "Metropolitan Medical College",
  "Lakeside College of Osteopathic Medicine",
  "Harborview Medical School",
];

const RESIDENCY_SITES = [
  "City General Hospital",
  "Regional Medical Center",
  "University Health System",
  "Memorial Teaching Hospital",
];

const PRIOR_EMPLOYERS = [
  "Community Physicians Group",
  "Valley Health Partners",
  "Northside Medical Associates",
  "Riverside Clinic Network",
];

const CITY_BY_STATE: Record<string, { city: string; zip: string }> = {
  NY: { city: "Albany", zip: "12207" },
  CA: { city: "Sacramento", zip: "95814" },
  OH: { city: "Columbus", zip: "43215" },
  TX: { city: "Austin", zip: "78701" },
  FL: { city: "Tallahassee", zip: "32301" },
  AZ: { city: "Phoenix", zip: "85004" },
  PA: { city: "Harrisburg", zip: "17101" },
  IL: { city: "Springfield", zip: "62701" },
  MA: { city: "Boston", zip: "02108" },
  WA: { city: "Olympia", zip: "98501" },
};

function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick<T>(arr: readonly T[], seed: number): T {
  const i = Math.abs(seed >>> 0) % arr.length;
  return arr[i]!;
}

function pad4(n: number): string {
  return String(n % 10000).padStart(4, "0");
}

function syntheticEmail(first: string | null, last: string | null, ext: string) {
  const local = [first, last]
    .filter(Boolean)
    .join(".")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "") || ext.toLowerCase();
  return `${local}@example.health`;
}

function syntheticPhone(seed: number, area = 555): string {
  const n = seed >>> 0;
  const exchange = 200 + (n % 700); // 200-899
  const line = 1000 + (n % 9000); // 1000-9999
  return `(${area}) ${exchange}-${line}`;
}

function locForState(state: string | null | undefined, seed: number) {
  const st = (state && CITY_BY_STATE[state] ? state : null) ?? pick(Object.keys(CITY_BY_STATE), seed);
  const loc = CITY_BY_STATE[st]!;
  return { state: st, city: loc.city, zip: loc.zip };
}

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
    const h = stableHash(externalId);
    const practiceState = str(r["Practice State"]);
    const genders = ["female", "male", "non_binary", "prefer_not_to_say"] as const;
    const dobYear = 1965 + (h % 25);
    return {
      external_id: externalId,
      subject_type: "practitioner",
      organization_id: tin ? orgIdByTin.get(tin) ?? null : null,
      organization_name: str(r["Group/TIN Entity"]),
      npi: str(r["NPI"]),
      first_name: first,
      middle_name: h % 3 === 0 ? "A" : null,
      last_name: last,
      name_suffix: h % 7 === 0 ? "MD" : null,
      display_name: [first, last].filter(Boolean).join(" ") || externalId,
      specialty: str(r["Specialty"]),
      facility_type: null,
      email: syntheticEmail(first, last, externalId),
      phone: syntheticPhone(h),
      mobile_phone: syntheticPhone(h >>> 2, 212),
      date_of_birth: `${dobYear}-${String(1 + (h % 12)).padStart(2, "0")}-${String(1 + (h % 28)).padStart(2, "0")}`,
      gender: genders[h % genders.length],
      ssn_last4: pad4(h),
      birth_country: "US",
      preferred_languages: h % 4 === 0 ? "English, Spanish" : "English",
      caqh_id: str(r["CAQH ID"]) ?? `CAQH-${externalId.replace(/\D/g, "").slice(-8) || pad4(h)}`,
      practice_state: practiceState,
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
      const h = stableHash(externalId);
      return {
        external_id: externalId,
        subject_type: "facility" as const,
        organization_id: tin ? orgIdByTin.get(tin) ?? null : null,
        organization_name: str(r["Group/TIN Entity"]) ?? str(r["Group"]),
        npi: str(r["NPI"]),
        first_name: null,
        middle_name: null,
        last_name: null,
        name_suffix: null,
        display_name: name,
        specialty: null,
        facility_type: str(r["Facility Type"]),
        email: `${slugify(name)}@facility.example`,
        phone: syntheticPhone(h, 800),
        mobile_phone: null,
        date_of_birth: null,
        gender: null,
        ssn_last4: null,
        birth_country: null,
        preferred_languages: null,
        caqh_id: null,
        practice_state: str(r["State"]) ?? str(r["Practice State"]),
        status: mapProviderStatus(str(r["Credentialing Status"])),
        cred_start_date: excelDate(r["Cred. Effective Date"]),
        cred_end_date: credEnd,
        recred_due_date: credEnd,
      };
    });
  } else {
    console.log("No Facilities sheet — seeding 8 synthetic facilities from POC plan");
    facilityRows = SYNTHETIC_FACILITIES.map((f) => {
      const h = stableHash(f.id);
      return {
        external_id: f.id,
        subject_type: "facility" as const,
        organization_id: orgIdByTin.get(f.tin) ?? null,
        organization_name: f.group,
        npi: f.npi,
        first_name: null,
        middle_name: null,
        last_name: null,
        name_suffix: null,
        display_name: f.name,
        specialty: null,
        facility_type: f.type,
        email: `${slugify(f.name)}@facility.example`,
        phone: syntheticPhone(h, 800),
        mobile_phone: null,
        date_of_birth: null,
        gender: null,
        ssn_last4: null,
        birth_country: null,
        preferred_languages: null,
        caqh_id: null,
        practice_state: f.state,
        status: mapProviderStatus(f.status),
        cred_start_date: f.credStart,
        cred_end_date: f.credEnd,
        recred_due_date: f.credEnd,
      };
    });
  }

  console.log(
    `Upserting ${providerRows.length} practitioners + ${facilityRows.length} facilities…`,
  );
  await upsertMany(sb, "providers", [...providerRows, ...facilityRows]);

  const { data: provData, error: provErr } = await sb
    .from("providers")
    .select(
      "id, external_id, subject_type, practice_state, organization_name, display_name",
    );
  if (provErr) throw provErr;
  const providerIdByExt = new Map(
    (provData ?? []).map((p) => [p.external_id as string, p.id as string]),
  );

  // ---- addresses (synthetic; workbook has no address sheets) ----
  const addressRows: Record<string, unknown>[] = [];
  for (const p of provData ?? []) {
    const h = stableHash(p.external_id);
    const loc = locForState(p.practice_state, h);
    const streetNum = 100 + (h % 8900);
    if (p.subject_type === "practitioner") {
      const homeLoc = locForState(loc.state, h >> 1);
      addressRows.push(
        {
          external_id: `${p.external_id}-ADDR-HOME`,
          provider_id: p.id,
          address_type: "home",
          line1: `${streetNum} Oak Street`,
          line2: h % 5 === 0 ? `Apt ${1 + (h % 20)}` : null,
          city: homeLoc.city,
          state: homeLoc.state,
          postal_code: homeLoc.zip,
          country: "US",
          is_primary: true,
        },
        {
          external_id: `${p.external_id}-ADDR-WORK`,
          provider_id: p.id,
          address_type: "work",
          line1: `${200 + (h % 700)} Medical Parkway`,
          line2: "Suite 200",
          city: loc.city,
          state: loc.state,
          postal_code: loc.zip,
          country: "US",
          is_primary: false,
        },
        {
          external_id: `${p.external_id}-ADDR-MAIL`,
          provider_id: p.id,
          address_type: "mailing",
          line1: `${streetNum} Oak Street`,
          line2: h % 5 === 0 ? `Apt ${1 + (h % 20)}` : null,
          city: homeLoc.city,
          state: homeLoc.state,
          postal_code: homeLoc.zip,
          country: "US",
          is_primary: false,
        },
      );
    } else {
      addressRows.push(
        {
          external_id: `${p.external_id}-ADDR-WORK`,
          provider_id: p.id,
          address_type: "work",
          line1: `${300 + (h % 600)} Campus Drive`,
          line2: null,
          city: loc.city,
          state: loc.state,
          postal_code: loc.zip,
          country: "US",
          is_primary: true,
        },
        {
          external_id: `${p.external_id}-ADDR-MAIL`,
          provider_id: p.id,
          address_type: "mailing",
          line1: `${300 + (h % 600)} Campus Drive`,
          line2: "Attn Credentialing",
          city: loc.city,
          state: loc.state,
          postal_code: loc.zip,
          country: "US",
          is_primary: false,
        },
      );
    }
  }
  console.log(`Upserting ${addressRows.length} provider addresses…`);
  await upsertMany(sb, "provider_addresses", addressRows);

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

  // ---- education + work history (synthetic; workbook has no sheets) ----
  const { data: practProviders, error: practErr } = await sb
    .from("providers")
    .select(
      "id, external_id, specialty, organization_name, cred_start_date, subject_type",
    )
    .eq("subject_type", "practitioner");
  if (practErr) throw practErr;

  const educationRows: Record<string, unknown>[] = [];
  const workRows: Record<string, unknown>[] = [];
  for (const p of practProviders ?? []) {
    const h = stableHash(p.external_id);
    const specialty = p.specialty || "Medicine";
    const degree = h % 5 === 0 ? "do" : "md";
    const medSchool =
      degree === "do" ? MED_SCHOOLS[2]! : pick(MED_SCHOOLS, h);
    const undergradYear = 2000 + (h % 10);
    const medGradYear = undergradYear + 8;
    const residencyEndYear = medGradYear + 3 + (h % 2);

    educationRows.push(
      {
        external_id: `${p.external_id}-EDU-BS`,
        provider_id: p.id,
        institution_name: pick(UNDERGRAD_SCHOOLS, h),
        degree_type: "bachelors",
        field_of_study: "Biology",
        start_date: `${undergradYear - 4}-08-15`,
        end_date: `${undergradYear}-05-15`,
        graduation_year: undergradYear,
        country: "US",
      },
      {
        external_id: `${p.external_id}-EDU-MD`,
        provider_id: p.id,
        institution_name: medSchool,
        degree_type: degree,
        field_of_study: "Medicine",
        start_date: `${undergradYear}-08-01`,
        end_date: `${medGradYear}-05-15`,
        graduation_year: medGradYear,
        country: "US",
      },
      {
        external_id: `${p.external_id}-EDU-RES`,
        provider_id: p.id,
        institution_name: pick(RESIDENCY_SITES, h >>> 3),
        degree_type: "residency",
        field_of_study: specialty,
        start_date: `${medGradYear}-07-01`,
        end_date: `${residencyEndYear}-06-30`,
        graduation_year: residencyEndYear,
        country: "US",
      },
    );

    if (h % 3 === 0) {
      educationRows.push({
        external_id: `${p.external_id}-EDU-FEL`,
        provider_id: p.id,
        institution_name: pick(RESIDENCY_SITES, h >>> 5),
        degree_type: "fellowship",
        field_of_study: specialty,
        start_date: `${residencyEndYear}-07-01`,
        end_date: `${residencyEndYear + 1}-06-30`,
        graduation_year: residencyEndYear + 1,
        country: "US",
      });
    }

    const priorStart = `${residencyEndYear + (h % 3 === 0 ? 1 : 0) + 1}-07-01`;
    const priorEnd = p.cred_start_date ?? `${residencyEndYear + 5}-06-30`;
    workRows.push(
      {
        external_id: `${p.external_id}-WRK-PRIOR`,
        provider_id: p.id,
        employer_name: pick(PRIOR_EMPLOYERS, h),
        title: `${specialty} Physician`,
        department: specialty,
        start_date: priorStart,
        end_date: priorEnd,
        is_current: false,
        location: "US",
      },
      {
        external_id: `${p.external_id}-WRK-CUR`,
        provider_id: p.id,
        employer_name: p.organization_name || "Current Practice Group",
        title: `Attending ${specialty}`,
        department: specialty,
        start_date: priorEnd,
        end_date: null,
        is_current: true,
        location: "US",
      },
    );
  }

  console.log(`Upserting ${educationRows.length} education history rows…`);
  await upsertMany(sb, "education_history", educationRows);
  console.log(`Upserting ${workRows.length} work history rows…`);
  await upsertMany(sb, "work_history", workRows);

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
    "provider_addresses",
    "credentials",
    "sanctions_checks",
    "education_history",
    "work_history",
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
