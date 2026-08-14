import { createClient } from "@/lib/supabase/server";
import {
  mapAddress,
  mapCredential,
  mapEducation,
  mapProvider,
  mapSanctions,
  mapWorkHistory,
  type AddressRow,
  type CredentialRow,
  type EducationRow,
  type ProviderRow,
  type SanctionsRow,
  type WorkHistoryRow,
} from "@/lib/mappers";
import type { SubjectType } from "@/types";

export async function listProviders(subjectType?: SubjectType | "all") {
  const sb = await createClient();
  let query = sb
    .from("providers")
    .select("*")
    .order("display_name", { ascending: true });

  if (subjectType && subjectType !== "all") {
    query = query.eq("subject_type", subjectType);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as ProviderRow[]).map(mapProvider);
}

export async function getProvider(id: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("providers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapProvider(data as ProviderRow);
}

export async function listCredentialsForProvider(providerId: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("credentials")
    .select("*")
    .eq("provider_id", providerId)
    .order("expires_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as CredentialRow[]).map(mapCredential);
}

export async function listSanctionsForProvider(providerId: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("sanctions_checks")
    .select("*")
    .eq("provider_id", providerId)
    .order("checked_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SanctionsRow[]).map(mapSanctions);
}

export async function listEducationForProvider(providerId: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("education_history")
    .select("*")
    .eq("provider_id", providerId)
    .order("end_date", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data as EducationRow[]).map(mapEducation);
}

export async function listWorkHistoryForProvider(providerId: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("work_history")
    .select("*")
    .eq("provider_id", providerId)
    .order("is_current", { ascending: false })
    .order("end_date", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data as WorkHistoryRow[]).map(mapWorkHistory);
}

export async function listAddressesForProvider(providerId: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("provider_addresses")
    .select("*")
    .eq("provider_id", providerId)
    .order("address_type", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as AddressRow[]).map(mapAddress);
}

export async function getProviderCounts() {
  const sb = await createClient();
  const [all, practitioners, facilities] = await Promise.all([
    sb.from("providers").select("*", { count: "exact", head: true }),
    sb
      .from("providers")
      .select("*", { count: "exact", head: true })
      .eq("subject_type", "practitioner"),
    sb
      .from("providers")
      .select("*", { count: "exact", head: true })
      .eq("subject_type", "facility"),
  ]);
  if (all.error) throw new Error(all.error.message);
  if (practitioners.error) throw new Error(practitioners.error.message);
  if (facilities.error) throw new Error(facilities.error.message);
  return {
    all: all.count ?? 0,
    practitioners: practitioners.count ?? 0,
    facilities: facilities.count ?? 0,
  };
}
