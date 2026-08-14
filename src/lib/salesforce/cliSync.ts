import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { sfExtId } from "@/lib/salesforce/portalIntake";

export type PortalSfSyncInput = {
  provider: {
    externalId: string;
    displayName: string;
    subjectType: "practitioner" | "facility";
    npi?: string | null;
    organizationName?: string | null;
    specialty?: string | null;
    facilityType?: string | null;
    email?: string | null;
    phone?: string | null;
    mobilePhone?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    nameSuffix?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    ssnLast4?: string | null;
    birthCountry?: string | null;
    preferredLanguages?: string | null;
    caqhId?: string | null;
    practiceState?: string | null;
  };
  application: {
    externalId: string;
    applicationType: "new" | "recred";
    path: string;
    subjectType: "practitioner" | "facility";
    status: string;
    dueDate: string;
  };
  checklist: Array<{
    externalId: string;
    itemKey: string;
    label: string;
    complete: boolean;
    sortOrder: number;
  }>;
  addresses?: Array<{
    externalId: string;
    addressType: string;
    line1: string;
    line2?: string | null;
    city: string;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    isPrimary: boolean;
  }>;
  education?: Array<{
    externalId: string;
    institutionName: string;
    degreeType: string;
    fieldOfStudy?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    graduationYear?: number | null;
    country?: string | null;
  }>;
  workHistory?: Array<{
    externalId: string;
    employerName: string;
    title?: string | null;
    department?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    isCurrent: boolean;
    location?: string | null;
  }>;
};

export type PortalSfSyncResult = {
  ok: boolean;
  skipped?: boolean;
  message?: string;
};

function targetOrg(): string {
  return process.env.SF_TARGET_ORG || "cred-poc";
}

export function isSalesforceCliSyncEnabled(): boolean {
  const flag = (process.env.SF_SYNC_VIA_CLI || "true").toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  return true;
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(path: string, headers: string[], rows: Record<string, unknown>[]) {
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ];
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
}

function mapSubject(s: string): string {
  return s === "facility" ? "Facility" : "Practitioner";
}

function mapAppType(s: string): string {
  return s === "recred" ? "Recred" : "New";
}

function mapPath(s: string): string {
  const map: Record<string, string> = {
    caqh: "CAQH",
    in_house: "In_House",
    facility: "Facility",
    delegated: "In_House",
  };
  return map[s] || "CAQH";
}

function mapStatus(s: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    incomplete: "Intake",
    in_review: "In_Review",
    pending_committee: "Pending_Committee",
    approved: "Approved",
    denied: "Denied",
    withdrawn: "Withdrawn",
  };
  return map[s] || "Intake";
}

function mapGender(s: string | null | undefined): string {
  const map: Record<string, string> = {
    male: "Male",
    female: "Female",
    non_binary: "Non_Binary",
    prefer_not_to_say: "Prefer_Not_To_Say",
    unknown: "Unknown",
  };
  return map[(s ?? "").toLowerCase()] ?? "";
}

function mapDegreeType(s: string | null | undefined): string {
  const map: Record<string, string> = {
    md: "MD",
    do: "DO",
    mbbs: "MBBS",
    phd: "PhD",
    masters: "Masters",
    bachelors: "Bachelors",
    residency: "Residency",
    fellowship: "Fellowship",
    internship: "Internship",
    other: "Other",
  };
  return map[(s ?? "").toLowerCase()] ?? "Other";
}

function mapAddressType(s: string | null | undefined): string {
  const map: Record<string, string> = {
    home: "Home",
    work: "Work",
    mailing: "Mailing",
  };
  return map[(s ?? "").toLowerCase()] ?? "Home";
}

function runSf(args: string[]): { ok: boolean; output: string } {
  const res = spawnSync("sf", args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const output = `${res.stdout || ""}\n${res.stderr || ""}`.trim();
  return { ok: res.status === 0, output };
}

/**
 * Upsert one portal application into Salesforce using the local `sf` CLI
 * (already authenticated as SF_TARGET_ORG / cred-poc). No Connected App needed.
 */
export function syncPortalApplicationViaCli(
  input: PortalSfSyncInput,
): PortalSfSyncResult {
  if (!isSalesforceCliSyncEnabled()) {
    return { ok: true, skipped: true, message: "SF CLI sync disabled" };
  }

  const which = spawnSync("sf", ["--version"], { encoding: "utf8" });
  if (which.status !== 0) {
    return {
      ok: false,
      message: "Salesforce CLI (sf) not found — install/auth to sync portal records",
    };
  }

  const org = targetOrg();
  const dir = resolve(tmpdir(), `cred-portal-sync-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  const providerExt = sfExtId(input.provider.externalId);
  const appExt = sfExtId(input.application.externalId);

  const providerFile = resolve(dir, "provider.csv");
  const appFile = resolve(dir, "application.csv");
  const checklistFile = resolve(dir, "checklist.csv");

  writeCsv(
    providerFile,
    [
      "Name",
      "External_Id__c",
      "Subject_Type__c",
      "NPI__c",
      "First_Name__c",
      "Middle_Name__c",
      "Last_Name__c",
      "Name_Suffix__c",
      "Organization_Name__c",
      "Specialty__c",
      "Facility_Type__c",
      "Email__c",
      "Phone__c",
      "Mobile_Phone__c",
      "Date_Of_Birth__c",
      "Gender__c",
      "SSN_Last_4__c",
      "Birth_Country__c",
      "Preferred_Languages__c",
      "CAQH_ID__c",
      "Practice_State__c",
      "Credentialing_Status__c",
    ],
    [
      {
        Name: input.provider.displayName,
        External_Id__c: providerExt,
        Subject_Type__c: mapSubject(input.provider.subjectType),
        NPI__c: input.provider.npi || "",
        First_Name__c: input.provider.firstName || "",
        Middle_Name__c: input.provider.middleName || "",
        Last_Name__c: input.provider.lastName || "",
        Name_Suffix__c: input.provider.nameSuffix || "",
        Organization_Name__c: input.provider.organizationName || "",
        Specialty__c: input.provider.specialty || "",
        Facility_Type__c: input.provider.facilityType || "",
        Email__c: input.provider.email || "",
        Phone__c: input.provider.phone || "",
        Mobile_Phone__c: input.provider.mobilePhone || "",
        Date_Of_Birth__c: input.provider.dateOfBirth || "",
        Gender__c: mapGender(input.provider.gender),
        SSN_Last_4__c: input.provider.ssnLast4 || "",
        Birth_Country__c: input.provider.birthCountry || "",
        Preferred_Languages__c: input.provider.preferredLanguages || "",
        CAQH_ID__c: input.provider.caqhId || "",
        Practice_State__c: input.provider.practiceState || "",
        Credentialing_Status__c: "Pending",
      },
    ],
  );

  writeCsv(
    appFile,
    [
      "External_Id__c",
      "Provider__r.External_Id__c",
      "Application_Type__c",
      "Path__c",
      "Subject_Type__c",
      "Status__c",
      "Attempt_Count__c",
      "Due_Date__c",
    ],
    [
      {
        External_Id__c: appExt,
        "Provider__r.External_Id__c": providerExt,
        Application_Type__c: mapAppType(input.application.applicationType),
        Path__c: mapPath(input.application.path),
        Subject_Type__c: mapSubject(input.application.subjectType),
        Status__c: mapStatus(input.application.status),
        Attempt_Count__c: 0,
        Due_Date__c: input.application.dueDate,
      },
    ],
  );

  writeCsv(
    checklistFile,
    [
      "Name",
      "External_Id__c",
      "Credentialing_Application__r.External_Id__c",
      "Item_Key__c",
      "Required__c",
      "Complete__c",
      "Sort_Order__c",
    ],
    input.checklist.map((item) => ({
      Name: item.label.slice(0, 80),
      External_Id__c: sfExtId(item.externalId),
      "Credentialing_Application__r.External_Id__c": appExt,
      Item_Key__c: item.itemKey,
      Required__c: true,
      Complete__c: item.complete,
      Sort_Order__c: item.sortOrder,
    })),
  );

  const jobs: Array<{ file: string; sobject: string }> = [
    { file: providerFile, sobject: "Provider__c" },
    { file: appFile, sobject: "Credentialing_Application__c" },
    { file: checklistFile, sobject: "Checklist_Item__c" },
  ];

  if (input.addresses?.length) {
    const file = resolve(dir, "addresses.csv");
    writeCsv(
      file,
      [
        "External_Id__c",
        "Provider__r.External_Id__c",
        "Address_Type__c",
        "Line1__c",
        "Line2__c",
        "City__c",
        "State__c",
        "Postal_Code__c",
        "Country__c",
        "Is_Primary__c",
      ],
      input.addresses.map((a) => ({
        External_Id__c: sfExtId(a.externalId),
        "Provider__r.External_Id__c": providerExt,
        Address_Type__c: mapAddressType(a.addressType),
        Line1__c: a.line1,
        Line2__c: a.line2 || "",
        City__c: a.city,
        State__c: a.state || "",
        Postal_Code__c: a.postalCode || "",
        Country__c: a.country || "US",
        Is_Primary__c: a.isPrimary,
      })),
    );
    jobs.push({ file, sobject: "Provider_Address__c" });
  }

  if (input.education?.length) {
    const file = resolve(dir, "education.csv");
    writeCsv(
      file,
      [
        "External_Id__c",
        "Provider__r.External_Id__c",
        "Institution_Name__c",
        "Degree_Type__c",
        "Field_Of_Study__c",
        "Start_Date__c",
        "End_Date__c",
        "Graduation_Year__c",
        "Country__c",
      ],
      input.education.map((e) => ({
        External_Id__c: sfExtId(e.externalId),
        "Provider__r.External_Id__c": providerExt,
        Institution_Name__c: e.institutionName,
        Degree_Type__c: mapDegreeType(e.degreeType),
        Field_Of_Study__c: e.fieldOfStudy || "",
        Start_Date__c: e.startDate || "",
        End_Date__c: e.endDate || "",
        Graduation_Year__c: e.graduationYear ?? "",
        Country__c: e.country || "",
      })),
    );
    jobs.push({ file, sobject: "Education_History__c" });
  }

  if (input.workHistory?.length) {
    const file = resolve(dir, "work.csv");
    writeCsv(
      file,
      [
        "External_Id__c",
        "Provider__r.External_Id__c",
        "Employer_Name__c",
        "Title__c",
        "Department__c",
        "Start_Date__c",
        "End_Date__c",
        "Is_Current__c",
        "Location__c",
      ],
      input.workHistory.map((w) => ({
        External_Id__c: sfExtId(w.externalId),
        "Provider__r.External_Id__c": providerExt,
        Employer_Name__c: w.employerName,
        Title__c: w.title || "",
        Department__c: w.department || "",
        Start_Date__c: w.startDate || "",
        End_Date__c: w.endDate || "",
        Is_Current__c: w.isCurrent,
        Location__c: w.location || "",
      })),
    );
    jobs.push({ file, sobject: "Work_History__c" });
  }

  for (const job of jobs) {
    const result = runSf([
      "data",
      "upsert",
      "bulk",
      "--sobject",
      job.sobject,
      "--file",
      job.file,
      "--external-id",
      "External_Id__c",
      "--target-org",
      org,
      "--wait",
      "5",
      "--line-ending",
      "LF",
    ]);
    if (!result.ok) {
      return {
        ok: false,
        message: `Salesforce sync failed on ${job.sobject}: ${result.output.slice(0, 500)}`,
      };
    }
  }

  return { ok: true, message: `Synced to Salesforce org ${org}` };
}
