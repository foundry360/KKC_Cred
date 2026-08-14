import { salesforceFetch, isSalesforceConfigured } from "@/lib/salesforce/client";

export type SalesforceLookupRow = {
  id: string;
  externalId: string;
  displayName: string;
  subjectType: string;
  npi: string | null;
  organizationName: string | null;
  specialty: string | null;
  facilityType: string | null;
  email: string | null;
  phone: string | null;
};

export type SalesforceIntakeResult = {
  providerId: string;
  providerExternalId: string;
  applicationId: string;
  applicationExternalId: string;
  status: string;
  providerName: string;
  checklistItems: Array<{
    id: string;
    itemKey: string;
    externalId: string;
    complete: boolean;
  }>;
};

export type SalesforceIntakePayload = {
  subjectType: string;
  applicationType: string;
  path: string;
  providerExternalId?: string;
  provider: {
    displayName: string;
    npi?: string;
    organizationName?: string;
    specialty?: string;
    facilityType?: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  };
  checklistComplete: Record<string, boolean>;
};

export { isSalesforceConfigured };

/** Salesforce External_Id__c is Text(40). */
export function sfExtId(value: string): string {
  if (value.length <= 40) return value;
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  const hash = h.toString(16).padStart(8, "0").slice(0, 8);
  return `${value.slice(0, 31)}-${hash}`;
}

export async function salesforceLookupProviders(
  query: string,
): Promise<SalesforceLookupRow[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await salesforceFetch(
    `/services/apexrest/cred/portal/lookup?q=${encodeURIComponent(q)}`,
    { method: "GET" },
  );
  const json = (await res.json()) as {
    data?: SalesforceLookupRow[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error || `Salesforce lookup failed (${res.status})`);
  }
  return json.data ?? [];
}

export async function salesforceCreatePortalIntake(
  input: SalesforceIntakePayload,
): Promise<SalesforceIntakeResult> {
  const payload = {
    subjectType: input.subjectType,
    applicationType: input.applicationType,
    path: input.path,
    providerExternalId: input.providerExternalId
      ? sfExtId(input.providerExternalId)
      : undefined,
    provider: {
      displayName: input.provider.displayName,
      npi: input.provider.npi || undefined,
      organizationName: input.provider.organizationName || undefined,
      specialty: input.provider.specialty || undefined,
      facilityType: input.provider.facilityType || undefined,
      email: input.provider.email || undefined,
      phone: input.provider.phone || undefined,
      firstName: input.provider.firstName || undefined,
      lastName: input.provider.lastName || undefined,
      externalId: input.providerExternalId
        ? sfExtId(input.providerExternalId)
        : undefined,
    },
    checklistComplete: input.checklistComplete,
  };

  const res = await salesforceFetch("/services/apexrest/cred/portal/intake", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const json = (await res.json()) as SalesforceIntakeResult & { error?: string };
  if (!res.ok) {
    throw new Error(json.error || `Salesforce intake failed (${res.status})`);
  }
  if (!json.applicationExternalId || !json.providerExternalId) {
    throw new Error("Salesforce intake returned an incomplete response");
  }
  return json;
}
