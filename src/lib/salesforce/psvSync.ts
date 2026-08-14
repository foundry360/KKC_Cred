import {
  getSalesforceApiVersion,
  isSalesforceConfigured,
  salesforceFetch,
} from "@/lib/salesforce/client";
import { sfExtId } from "@/lib/salesforce/portalIntake";
import { createServiceClient } from "@/lib/supabase/admin";

export type PsvSfSyncResult = {
  ok: boolean;
  message: string;
  verificationCount?: number;
  exceptionCount?: number;
};

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

async function deleteChildrenForApp(
  sobject: string,
  appExternalId: string,
): Promise<void> {
  const version = getSalesforceApiVersion();
  const safe = appExternalId.replace(/'/g, "\\'");
  const soql = `SELECT Id FROM ${sobject} WHERE Credentialing_Application__r.External_Id__c = '${safe}'`;
  const q = await salesforceFetch(
    `/services/data/v${version}/query?q=${encodeURIComponent(soql)}`,
  );
  if (!q.ok) return;
  const json = (await q.json()) as { records?: Array<{ Id: string }> };
  for (const row of json.records ?? []) {
    await salesforceFetch(`/services/data/v${version}/sobjects/${sobject}/${row.Id}`, {
      method: "DELETE",
    });
  }
}

function truncate(value: string | null | undefined, max: number): string {
  const s = (value ?? "").trim();
  if (!s) return "—";
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

/**
 * Push Supabase PSV results onto the matching Salesforce Application
 * (matched by External_Id__c) so Specs see Verification in Salesforce.
 */
export async function syncPsvResultsToSalesforce(
  applicationId: string,
): Promise<PsvSfSyncResult> {
  if (!isSalesforceConfigured()) {
    return {
      ok: false,
      message:
        "Salesforce not configured (OAuth or SF_TARGET_ORG CLI session required)",
    };
  }

  const supabase = createServiceClient();
  const { data: app, error } = await supabase
    .from("applications")
    .select(
      "id, external_id, psv_status, readiness_score, psv_ran_at",
    )
    .eq("id", applicationId)
    .single();

  if (error || !app) {
    return { ok: false, message: error?.message ?? "Application not found" };
  }

  const appExt = sfExtId(app.external_id);

  try {
    await upsertByExternalId("Credentialing_Application__c", appExt, {
      PSV_Status__c: app.psv_status || "not_started",
      Readiness_Score__c: app.readiness_score ?? null,
      PSV_Ran_At__c: app.psv_ran_at || null,
    });

    await deleteChildrenForApp("PSV_Verification__c", appExt);
    await deleteChildrenForApp("PSV_Exception__c", appExt);

    const { data: verifications } = await supabase
      .from("verifications")
      .select(
        "external_id, source_name, source_mode, verification_type, status, result_summary, source_url, retrieved_at, verified_by",
      )
      .eq("application_id", applicationId)
      .order("retrieved_at", { ascending: false });

    const { data: exceptions } = await supabase
      .from("credentialing_exceptions")
      .select(
        "external_id, exception_type, severity, description, source, status",
      )
      .eq("application_id", applicationId)
      .eq("status", "open")
      .order("created_at", { ascending: false });

    for (const v of verifications ?? []) {
      await upsertByExternalId(
        "PSV_Verification__c",
        sfExtId(v.external_id),
        {
          Name: truncate(v.source_name || v.verification_type, 80),
          Credentialing_Application__r: { External_Id__c: appExt },
          Source_Name__c: truncate(v.source_name, 255),
          Source_Mode__c: v.source_mode || "poc",
          Verification_Type__c: truncate(v.verification_type, 80),
          Status__c: v.status || "pending",
          Result_Summary__c: v.result_summary || null,
          Source_URL__c: v.source_url || null,
          Retrieved_At__c: v.retrieved_at || null,
          Verified_By__c: truncate(v.verified_by, 80),
        },
      );
    }

    for (const e of exceptions ?? []) {
      await upsertByExternalId("PSV_Exception__c", sfExtId(e.external_id), {
        Name: truncate(e.exception_type || "Exception", 80),
        Credentialing_Application__r: { External_Id__c: appExt },
        Exception_Type__c: e.exception_type || "other",
        Severity__c: e.severity || "warning",
        Description__c: e.description || null,
        Source__c: truncate(e.source, 255),
        Status__c: e.status || "open",
      });
    }

    return {
      ok: true,
      message: `PSV synced to Salesforce Application ${appExt}`,
      verificationCount: verifications?.length ?? 0,
      exceptionCount: exceptions?.length ?? 0,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "PSV Salesforce sync failed",
    };
  }
}
