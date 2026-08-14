import {
  isSalesforceConfigured,
  salesforceFetch,
  getSalesforceApiVersion,
} from "@/lib/salesforce/client";
import { sfExtId } from "@/lib/salesforce/portalIntake";
import type {
  PortalSfSyncInput,
  PortalSfSyncResult,
} from "@/lib/salesforce/cliSync";

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

const STATE_NAME_TO_CODE: Record<string, string> = {
  florida: "FL",
  california: "CA",
  texas: "TX",
  "new york": "NY",
  georgia: "GA",
  arizona: "AZ",
  ohio: "OH",
  pennsylvania: "PA",
  illinois: "IL",
  "north carolina": "NC",
};

function mapState(s: string | null | undefined): string | null {
  const raw = (s ?? "").trim();
  if (!raw) return null;
  if (raw.length === 2) return raw.toUpperCase();
  return STATE_NAME_TO_CODE[raw.toLowerCase()] ?? raw.slice(0, 2).toUpperCase();
}

async function upsertByExternalId(
  sobject: string,
  externalId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const version = getSalesforceApiVersion();
  const path = `/services/data/v${version}/sobjects/${sobject}/External_Id__c/${encodeURIComponent(externalId)}`;
  const res = await salesforceFetch(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 201) {
    const text = await res.text();
    throw new Error(`${sobject} upsert failed (${res.status}): ${text.slice(0, 400)}`);
  }
}

/**
 * Cloud-safe portal → Salesforce sync via REST upserts (OAuth).
 * Works on Vercel when SF_CLIENT_ID / SF_CLIENT_SECRET (+ auth) are set.
 */
export async function syncPortalApplicationViaHttp(
  input: PortalSfSyncInput,
): Promise<PortalSfSyncResult> {
  if (!isSalesforceConfigured()) {
    return {
      ok: false,
      message:
        "Salesforce OAuth not configured (set SF_CLIENT_ID, SF_CLIENT_SECRET, SF_LOGIN_URL)",
    };
  }

  try {
    const providerExt = sfExtId(input.provider.externalId);
    const appExt = sfExtId(input.application.externalId);

    await upsertByExternalId("Provider__c", providerExt, {
      Name: input.provider.displayName,
      Subject_Type__c: mapSubject(input.provider.subjectType),
      NPI__c: input.provider.npi || null,
      First_Name__c: input.provider.firstName || null,
      Middle_Name__c: input.provider.middleName || null,
      Last_Name__c: input.provider.lastName || null,
      Name_Suffix__c: input.provider.nameSuffix || null,
      Organization_Name__c: input.provider.organizationName || null,
      Specialty__c: input.provider.specialty || null,
      Facility_Type__c: input.provider.facilityType || null,
      Email__c: input.provider.email || null,
      Phone__c: input.provider.phone || null,
      Mobile_Phone__c: input.provider.mobilePhone || null,
      Date_Of_Birth__c: input.provider.dateOfBirth || null,
      Gender__c: mapGender(input.provider.gender) || null,
      SSN_Last_4__c: input.provider.ssnLast4 || null,
      Birth_Country__c: input.provider.birthCountry || null,
      Preferred_Languages__c: input.provider.preferredLanguages || null,
      CAQH_ID__c: input.provider.caqhId || null,
      Practice_State__c: mapState(input.provider.practiceState),
      Federal_Tax_ID__c: input.provider.federalTaxId || null,
      Medicaid_Number__c: input.provider.medicaidNumber || null,
      Medicare_Number__c: input.provider.medicareNumber || null,
      Credentialing_Status__c: "Pending",
    });

    await upsertByExternalId("Credentialing_Application__c", appExt, {
      Provider__r: { External_Id__c: providerExt },
      Application_Type__c: mapAppType(input.application.applicationType),
      Path__c: mapPath(input.application.path),
      Subject_Type__c: mapSubject(input.application.subjectType),
      Status__c: mapStatus(input.application.status),
      Attempt_Count__c: 0,
      Due_Date__c: input.application.dueDate,
    });

    for (const item of input.checklist) {
      await upsertByExternalId("Checklist_Item__c", sfExtId(item.externalId), {
        Name: item.label.slice(0, 80),
        Credentialing_Application__r: { External_Id__c: appExt },
        Item_Key__c: item.itemKey,
        Required__c: true,
        Complete__c: item.complete,
        Sort_Order__c: item.sortOrder,
      });
    }

    for (const a of input.addresses ?? []) {
      await upsertByExternalId("Provider_Address__c", sfExtId(a.externalId), {
        Provider__r: { External_Id__c: providerExt },
        Address_Type__c: mapAddressType(a.addressType),
        Line1__c: a.line1,
        Line2__c: a.line2 || null,
        City__c: a.city,
        State__c: mapState(a.state),
        Postal_Code__c: a.postalCode || null,
        Country__c: a.country || "US",
        Is_Primary__c: a.isPrimary,
      });
    }

    for (const e of input.education ?? []) {
      await upsertByExternalId("Education_History__c", sfExtId(e.externalId), {
        Provider__r: { External_Id__c: providerExt },
        Institution_Name__c: e.institutionName,
        Degree_Type__c: mapDegreeType(e.degreeType),
        Field_Of_Study__c: e.fieldOfStudy || null,
        Start_Date__c: e.startDate || null,
        End_Date__c: e.endDate || null,
        Graduation_Year__c: e.graduationYear ?? null,
        Country__c: e.country || null,
      });
    }

    for (const w of input.workHistory ?? []) {
      await upsertByExternalId("Work_History__c", sfExtId(w.externalId), {
        Provider__r: { External_Id__c: providerExt },
        Employer_Name__c: w.employerName,
        Title__c: w.title || null,
        Department__c: w.department || null,
        Start_Date__c: w.startDate || null,
        End_Date__c: w.endDate || null,
        Is_Current__c: w.isCurrent,
        Location__c: w.location || null,
      });
    }

    return { ok: true, message: "Synced to Salesforce via REST API" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Salesforce HTTP sync failed",
    };
  }
}
