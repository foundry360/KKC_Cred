import { createClient } from "@/lib/supabase/server";
import { checklistForSubject } from "@/lib/portal/checklist";
import { sfExtId } from "@/lib/salesforce/portalIntake";
import type { PortalSfSyncInput } from "@/lib/salesforce/cliSync";
import type { DegreeType } from "@/types/education";
import type { AddressType, Gender } from "@/types/address";

export type PortalSubjectType = "practitioner" | "facility";
export type PortalApplicationType = "new" | "recred";
export type PortalPath = "caqh" | "in_house" | "facility" | "delegated";

export type PortalEducationInput = {
  institutionName: string;
  degreeType: DegreeType;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  graduationYear?: number | null;
  country?: string;
};

export type PortalWorkHistoryInput = {
  employerName: string;
  title?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  location?: string;
};

export type PortalAddressInput = {
  addressType: AddressType;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isPrimary?: boolean;
};

export type PortalIntakeInput = {
  subjectType: PortalSubjectType;
  applicationType: PortalApplicationType;
  path: PortalPath;
  providerId?: string;
  providerExternalId?: string;
  provider: {
    displayName: string;
    npi?: string;
    organizationName?: string;
    specialty?: string;
    facilityType?: string;
    email?: string;
    phone?: string;
    mobilePhone?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    nameSuffix?: string;
    dateOfBirth?: string;
    gender?: Gender | "";
    ssnLast4?: string;
    birthCountry?: string;
    preferredLanguages?: string;
    caqhId?: string;
    practiceState?: string;
  };
  addresses?: PortalAddressInput[];
  education?: PortalEducationInput[];
  workHistory?: PortalWorkHistoryInput[];
  checklistComplete: Record<string, boolean>;
};

function stamp() {
  return Date.now().toString(36).toUpperCase();
}

function isSupabaseUuid(id: string | undefined): boolean {
  return Boolean(id && id.includes("-") && id.length > 20);
}

function blank(v: string | undefined | null): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

function providerPatch(input: PortalIntakeInput) {
  const p = input.provider;
  return {
    display_name: p.displayName,
    npi: blank(p.npi),
    organization_name: blank(p.organizationName),
    specialty: blank(p.specialty),
    facility_type: blank(p.facilityType),
    email: blank(p.email),
    phone: blank(p.phone),
    mobile_phone: blank(p.mobilePhone),
    first_name: blank(p.firstName),
    middle_name: blank(p.middleName),
    last_name: blank(p.lastName),
    name_suffix: blank(p.nameSuffix),
    date_of_birth: blank(p.dateOfBirth),
    gender: blank(p.gender) as Gender | null,
    ssn_last4: blank(p.ssnLast4),
    birth_country: blank(p.birthCountry),
    preferred_languages: blank(p.preferredLanguages),
    caqh_id: blank(p.caqhId),
    practice_state: blank(p.practiceState),
  };
}

export async function lookupProviders(query: string) {
  const sb = await createClient();
  const q = query.trim().replace(/[%(),]/g, "");
  if (q.length < 2) return [];

  const { data, error } = await sb
    .from("providers")
    .select(
      "id, external_id, display_name, subject_type, npi, organization_name, specialty, facility_type, email, phone, status",
    )
    .or(
      `npi.ilike.%${q}%,external_id.ilike.%${q}%,display_name.ilike.%${q}%,organization_name.ilike.%${q}%`,
    )
    .order("display_name")
    .limit(12);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPortalApplication(id: string) {
  const sb = await createClient();
  const { data: app, error } = await sb
    .from("applications")
    .select(
      "id, external_id, application_type, path, subject_type, status, due_date, submitted_at, attempt_count, provider_id, psv_status, readiness_score, psv_ran_at, license_state, providers(display_name, npi, external_id, organization_name, subject_type, first_name, last_name, date_of_birth, gender, caqh_id, practice_state, email, phone, mobile_phone)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!app) return null;

  const { data: checklist, error: cErr } = await sb
    .from("checklist_items")
    .select("id, item_key, label, required, complete, sort_order")
    .eq("application_id", id)
    .order("sort_order");
  if (cErr) throw new Error(cErr.message);

  const providerId = app.provider_id as string;
  const [{ data: education }, { data: workHistory }, { data: addresses }] =
    await Promise.all([
      sb
        .from("education_history")
        .select(
          "id, institution_name, degree_type, field_of_study, graduation_year, start_date, end_date",
        )
        .eq("provider_id", providerId)
        .order("graduation_year", { ascending: false }),
      sb
        .from("work_history")
        .select(
          "id, employer_name, title, department, start_date, end_date, is_current, location",
        )
        .eq("provider_id", providerId)
        .order("is_current", { ascending: false }),
      sb
        .from("provider_addresses")
        .select(
          "id, address_type, line1, line2, city, state, postal_code, country, is_primary",
        )
        .eq("provider_id", providerId)
        .order("address_type"),
    ]);

  return {
    application: app,
    checklist: checklist ?? [],
    education: education ?? [],
    workHistory: workHistory ?? [],
    addresses: addresses ?? [],
  };
}

async function resolveProvider(input: PortalIntakeInput) {
  const sb = await createClient();
  const patch = providerPatch(input);

  if (input.providerExternalId) {
    const ext = sfExtId(input.providerExternalId);
    const { data } = await sb
      .from("providers")
      .select("id, external_id, display_name")
      .eq("external_id", ext)
      .maybeSingle();
    if (data) {
      const { error } = await sb.from("providers").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return data;
    }
  }

  if (isSupabaseUuid(input.providerId)) {
    const { data } = await sb
      .from("providers")
      .select("id, external_id, display_name")
      .eq("id", input.providerId!)
      .maybeSingle();
    if (data) {
      const { error } = await sb.from("providers").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return data;
    }
  }

  const prefix = input.subjectType === "facility" ? "FAC" : "PRV";
  const externalId = sfExtId(
    input.providerExternalId || `${prefix}-PORTAL-${stamp()}`,
  );

  const { data: provider, error } = await sb
    .from("providers")
    .insert({
      external_id: externalId,
      subject_type: input.subjectType,
      status: "pending",
      ...patch,
    })
    .select("id, external_id, display_name")
    .single();
  if (error) throw new Error(error.message);
  return provider;
}

async function saveRelatedRecords(
  providerId: string,
  providerExternalId: string,
  input: PortalIntakeInput,
) {
  const sb = await createClient();
  const sync: Pick<
    PortalSfSyncInput,
    "addresses" | "education" | "workHistory"
  > = {
    addresses: [],
    education: [],
    workHistory: [],
  };

  const addresses = (input.addresses ?? []).filter(
    (a) => a.line1.trim() && a.city.trim(),
  );
  // provider_addresses has unique (provider_id, address_type)
  const uniqueAddresses = Array.from(
    new Map(addresses.map((a) => [a.addressType, a])).values(),
  );
  for (const [idx, a] of uniqueAddresses.entries()) {
    const { data: existing } = await sb
      .from("provider_addresses")
      .select("id, external_id")
      .eq("provider_id", providerId)
      .eq("address_type", a.addressType)
      .maybeSingle();

    const externalId =
      existing?.external_id ||
      sfExtId(`${providerExternalId}-ADDR-${a.addressType}-${idx + 1}`);

    const row = {
      external_id: externalId,
      provider_id: providerId,
      address_type: a.addressType,
      line1: a.line1.trim(),
      line2: blank(a.line2),
      city: a.city.trim(),
      state: blank(a.state),
      postal_code: blank(a.postalCode),
      country: blank(a.country) || "US",
      is_primary: a.isPrimary === true || idx === 0,
    };

    sync.addresses!.push({
      externalId,
      addressType: a.addressType,
      line1: row.line1,
      line2: row.line2,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      country: row.country,
      isPrimary: row.is_primary,
    });

    if (existing) {
      const { error } = await sb
        .from("provider_addresses")
        .update(row)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("provider_addresses").insert(row);
      if (error) throw new Error(error.message);
    }
  }

  const education = (input.education ?? []).filter((e) =>
    e.institutionName.trim(),
  );
  if (education.length) {
    const rows = education.map((e, idx) => {
      const externalId = sfExtId(`${providerExternalId}-EDU-${idx + 1}`);
      sync.education!.push({
        externalId,
        institutionName: e.institutionName.trim(),
        degreeType: e.degreeType,
        fieldOfStudy: blank(e.fieldOfStudy),
        startDate: blank(e.startDate),
        endDate: blank(e.endDate),
        graduationYear: e.graduationYear ?? null,
        country: blank(e.country),
      });
      return {
        external_id: externalId,
        provider_id: providerId,
        institution_name: e.institutionName.trim(),
        degree_type: e.degreeType,
        field_of_study: blank(e.fieldOfStudy),
        start_date: blank(e.startDate),
        end_date: blank(e.endDate),
        graduation_year: e.graduationYear ?? null,
        country: blank(e.country),
      };
    });
    const { error } = await sb.from("education_history").upsert(rows, {
      onConflict: "external_id",
    });
    if (error) throw new Error(error.message);
  }

  const workHistory = (input.workHistory ?? []).filter((w) =>
    w.employerName.trim(),
  );
  if (workHistory.length) {
    const rows = workHistory.map((w, idx) => {
      const externalId = sfExtId(`${providerExternalId}-WRK-${idx + 1}`);
      sync.workHistory!.push({
        externalId,
        employerName: w.employerName.trim(),
        title: blank(w.title),
        department: blank(w.department),
        startDate: blank(w.startDate),
        endDate: blank(w.endDate),
        isCurrent: w.isCurrent === true,
        location: blank(w.location),
      });
      return {
        external_id: externalId,
        provider_id: providerId,
        employer_name: w.employerName.trim(),
        title: blank(w.title),
        department: blank(w.department),
        start_date: blank(w.startDate),
        end_date: blank(w.endDate),
        is_current: w.isCurrent === true,
        location: blank(w.location),
      };
    });
    const { error } = await sb.from("work_history").upsert(rows, {
      onConflict: "external_id",
    });
    if (error) throw new Error(error.message);
  }

  return sync;
}

export async function createPortalApplication(input: PortalIntakeInput) {
  const sb = await createClient();
  const template = checklistForSubject(input.subjectType);

  const allComplete = template.every(
    (item) => input.checklistComplete[item.key] === true,
  );
  const status = allComplete ? "in_review" : "incomplete";

  const providerRow = await resolveProvider(input);
  const related = await saveRelatedRecords(
    providerRow.id,
    providerRow.external_id,
    input,
  );

  const appExternalId = sfExtId(
    `${providerRow.external_id}-APP-${input.applicationType.toUpperCase()}-${stamp()}`,
  );

  const due = new Date();
  due.setUTCDate(due.getUTCDate() + 30);
  const dueDate = due.toISOString().slice(0, 10);

  const { data: app, error: aErr } = await sb
    .from("applications")
    .insert({
      external_id: appExternalId.slice(0, 80),
      provider_id: providerRow.id,
      application_type: input.applicationType,
      path: input.path,
      subject_type: input.subjectType,
      status,
      attempt_count: 0,
      due_date: dueDate,
      submitted_at: new Date().toISOString(),
      credentialing_action:
        input.applicationType === "recred" ? "recredentialing" : "initial",
      profession:
        input.subjectType === "practitioner" ? "Medical Doctor" : null,
      license_state: blank(input.provider.practiceState),
      requesting_organization: blank(input.provider.organizationName),
      psv_status: "not_started",
    })
    .select("id, external_id, status")
    .single();
  if (aErr) throw new Error(aErr.message);

  const checklistRows = template.map((item, idx) => ({
    external_id: sfExtId(`${app.external_id}-CHK-${item.key}`).slice(0, 80),
    application_id: app.id,
    item_key: item.key,
    label: item.label,
    required: true,
    complete: input.checklistComplete[item.key] === true,
    sort_order: idx + 1,
  }));

  const { error: cErr } = await sb.from("checklist_items").insert(checklistRows);
  if (cErr) throw new Error(cErr.message);

  const salesforceSyncPayload: PortalSfSyncInput = {
    provider: {
      externalId: providerRow.external_id,
      displayName: input.provider.displayName,
      subjectType: input.subjectType,
      npi: input.provider.npi,
      organizationName: input.provider.organizationName,
      specialty: input.provider.specialty,
      facilityType: input.provider.facilityType,
      email: input.provider.email,
      phone: input.provider.phone,
      mobilePhone: input.provider.mobilePhone,
      firstName: input.provider.firstName,
      middleName: input.provider.middleName,
      lastName: input.provider.lastName,
      nameSuffix: input.provider.nameSuffix,
      dateOfBirth: input.provider.dateOfBirth,
      gender: input.provider.gender || null,
      ssnLast4: input.provider.ssnLast4,
      birthCountry: input.provider.birthCountry,
      preferredLanguages: input.provider.preferredLanguages,
      caqhId: input.provider.caqhId,
      practiceState: input.provider.practiceState,
    },
    application: {
      externalId: app.external_id,
      applicationType: input.applicationType,
      path: input.path,
      subjectType: input.subjectType,
      status,
      dueDate,
    },
    checklist: checklistRows.map((row) => ({
      externalId: row.external_id,
      itemKey: row.item_key,
      label: row.label,
      complete: row.complete,
      sortOrder: row.sort_order,
    })),
    addresses: related.addresses,
    education: related.education,
    workHistory: related.workHistory,
  };

  return {
    applicationId: app.id,
    providerId: providerRow.id,
    externalId: app.external_id,
    providerExternalId: providerRow.external_id,
    status: app.status,
    providerName: providerRow.display_name,
    salesforceSyncPayload,
  };
}
