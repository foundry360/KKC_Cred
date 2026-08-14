/**
 * Push a Supabase portal application into Salesforce (CLI or OAuth REST).
 * Usage: npx tsx scripts/sync-portal-app-to-sf.ts [applicationId|externalId]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createServiceClient } from "../src/lib/supabase/admin";
import { syncPortalApplication } from "../src/lib/salesforce/sync";
import type { PortalSfSyncInput } from "../src/lib/salesforce/cliSync";

async function main() {
  const arg = process.argv[2];
  const sb = createServiceClient();

  let query = sb
    .from("applications")
    .select(
      "id, external_id, application_type, path, subject_type, status, due_date, provider_id, providers(*)",
    )
    .order("created_at", { ascending: false })
    .limit(1);

  if (arg) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        arg,
      );
    if (isUuid) {
      query = sb
        .from("applications")
        .select(
          "id, external_id, application_type, path, subject_type, status, due_date, provider_id, providers(*)",
        )
        .eq("id", arg)
        .limit(1);
    } else {
      query = sb
        .from("applications")
        .select(
          "id, external_id, application_type, path, subject_type, status, due_date, provider_id, providers(*)",
        )
        .eq("external_id", arg)
        .limit(1);
    }
  }

  const { data: apps, error } = await query;
  if (error) throw error;
  const app = apps?.[0];
  if (!app) throw new Error("Application not found");

  const provider = Array.isArray(app.providers)
    ? app.providers[0]
    : app.providers;
  if (!provider) throw new Error("Provider missing");

  const [{ data: checklist }, { data: addresses }, { data: education }, { data: workHistory }] =
    await Promise.all([
      sb
        .from("checklist_items")
        .select("*")
        .eq("application_id", app.id)
        .order("sort_order"),
      sb.from("provider_addresses").select("*").eq("provider_id", provider.id),
      sb.from("education_history").select("*").eq("provider_id", provider.id),
      sb.from("work_history").select("*").eq("provider_id", provider.id),
    ]);

  const payload: PortalSfSyncInput = {
    provider: {
      externalId: provider.external_id,
      displayName: provider.display_name,
      subjectType: provider.subject_type,
      npi: provider.npi,
      organizationName: provider.organization_name,
      specialty: provider.specialty,
      facilityType: provider.facility_type,
      email: provider.email,
      phone: provider.phone,
      mobilePhone: provider.mobile_phone,
      firstName: provider.first_name,
      middleName: provider.middle_name,
      lastName: provider.last_name,
      nameSuffix: provider.name_suffix,
      dateOfBirth: provider.date_of_birth,
      gender: provider.gender,
      ssnLast4: provider.ssn_last4,
      birthCountry: provider.birth_country,
      preferredLanguages: provider.preferred_languages,
      caqhId: provider.caqh_id,
      practiceState: provider.practice_state,
    },
    application: {
      externalId: app.external_id,
      applicationType: app.application_type,
      path: app.path,
      subjectType: app.subject_type,
      status: app.status,
      dueDate: app.due_date || new Date().toISOString().slice(0, 10),
    },
    checklist: (checklist ?? []).map((c) => ({
      externalId: c.external_id,
      itemKey: c.item_key,
      label: c.label,
      complete: c.complete,
      sortOrder: c.sort_order,
    })),
    addresses: (addresses ?? []).map((a) => ({
      externalId: a.external_id,
      addressType: a.address_type,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      postalCode: a.postal_code,
      country: a.country,
      isPrimary: a.is_primary,
    })),
    education: (education ?? []).map((e) => ({
      externalId: e.external_id,
      institutionName: e.institution_name,
      degreeType: e.degree_type,
      fieldOfStudy: e.field_of_study,
      startDate: e.start_date,
      endDate: e.end_date,
      graduationYear: e.graduation_year,
      country: e.country,
    })),
    workHistory: (workHistory ?? []).map((w) => ({
      externalId: w.external_id,
      employerName: w.employer_name,
      title: w.title,
      department: w.department,
      startDate: w.start_date,
      endDate: w.end_date,
      isCurrent: w.is_current,
      location: w.location,
    })),
  };

  console.log("Syncing", app.external_id, provider.display_name, "…");
  const result = await syncPortalApplication(payload);
  console.log(result);
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
