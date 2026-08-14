import { createServiceClient } from "@/lib/supabase/admin";
import { buildRequirements } from "@/lib/psv/requirements";
import { providerForRequirement } from "@/lib/psv/registry";
import { getDocumentExtractionService } from "@/lib/psv/extraction";
import {
  computeReadiness,
  reconcileCase,
  type SubmittedProfile,
} from "@/lib/psv/reconciliation";
import type {
  PSVRequest,
  PSVResult,
  RequirementStatus,
  RequirementType,
} from "@/types/psv";

function extId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

function mapResultToRequirementStatus(
  result: PSVResult,
): RequirementStatus {
  switch (result.status) {
    case "verified":
      return "verified";
    case "clear":
      return "clear";
    case "human_review":
      return "human_review";
    case "exception":
    case "failed":
    case "not_verified":
      return "exception";
    default:
      return "pending_verification";
  }
}

export async function ensureRequirements(applicationId: string) {
  const supabase = createServiceClient();
  const { data: app, error } = await supabase
    .from("applications")
    .select(
      "id, subject_type, credentialing_action, profession, license_state, provider_id, providers(specialty)",
    )
    .eq("id", applicationId)
    .single();

  if (error || !app) throw new Error(error?.message ?? "Application not found");

  const { data: existing } = await supabase
    .from("credential_requirements")
    .select("id")
    .eq("application_id", applicationId);

  if (existing && existing.length > 0) return existing;

  const { data: docs } = await supabase
    .from("documents")
    .select("document_type, file_name")
    .eq("application_id", applicationId);

  const hasDea = (docs ?? []).some(
    (d: { document_type?: string | null; file_name?: string | null }) =>
      (d.document_type ?? "").toLowerCase().includes("dea") ||
      (d.file_name ?? "").toLowerCase().includes("dea"),
  );

  const provider = Array.isArray(app.providers) ? app.providers[0] : app.providers;
  const templates = buildRequirements({
    subjectType: app.subject_type as "practitioner" | "facility",
    credentialingAction: app.credentialing_action,
    profession: app.profession,
    licenseState: app.license_state,
    specialty: provider?.specialty,
    hasDeaDocument: hasDea,
  });

  const rows = templates.map((t) => ({
    external_id: extId("REQ"),
    application_id: applicationId,
    requirement_type: t.requirementType,
    label: t.label,
    required: t.required,
    status: "required" as const,
    verification_method: t.verificationMethod,
    psv_provider: t.psvProvider,
    sort_order: t.sortOrder,
  }));

  const { data, error: insertError } = await supabase
    .from("credential_requirements")
    .insert(rows)
    .select("*");

  if (insertError) throw new Error(insertError.message);

  await supabase.from("audit_events").insert({
    external_id: extId("AUD"),
    application_id: applicationId,
    event_type: "requirements_generated",
    actor: "system",
    detail: { count: rows.length },
  });

  return data ?? [];
}

export async function extractDocumentsForApplication(applicationId: string) {
  const supabase = createServiceClient();
  const extractor = getDocumentExtractionService();

  const { data: docs, error } = await supabase
    .from("documents")
    .select("*")
    .eq("application_id", applicationId);

  if (error) throw new Error(error.message);

  await supabase
    .from("extracted_credential_data")
    .delete()
    .eq("application_id", applicationId);

  const extractedFlat: Record<string, string | null> = {};

  for (const doc of docs ?? []) {
    await supabase
      .from("documents")
      .update({ status: "processing" })
      .eq("id", doc.id);

    const fields = await extractor.extract({
      fileName: doc.file_name ?? "document",
      documentType: doc.document_type,
      mimeType: doc.content_type,
    });

    if (fields.length) {
      await supabase.from("extracted_credential_data").insert(
        fields.map((f) => ({
          external_id: extId("EXT"),
          application_id: applicationId,
          document_id: doc.id,
          field_name: f.field,
          field_value: f.value,
          confidence: f.confidence,
          source_document: f.sourceDocument,
          extractor: "HeuristicDocumentExtractionService",
        })),
      );
      for (const f of fields) {
        if (f.value) extractedFlat[f.field] = f.value;
      }
    }

    await supabase
      .from("documents")
      .update({ status: "extracted" })
      .eq("id", doc.id);
  }

  await supabase.from("audit_events").insert({
    external_id: extId("AUD"),
    application_id: applicationId,
    event_type: "documents_extracted",
    actor: "system",
    detail: {
      documentCount: docs?.length ?? 0,
      note: "AI/heuristic extraction is NOT verification",
    },
  });

  return extractedFlat;
}

async function loadSubmittedProfile(applicationId: string): Promise<{
  submitted: SubmittedProfile;
  app: Record<string, unknown>;
}> {
  const supabase = createServiceClient();
  const { data: app, error } = await supabase
    .from("applications")
    .select(
      "*, providers(id, npi, first_name, middle_name, last_name, specialty, practice_state, display_name)",
    )
    .eq("id", applicationId)
    .single();

  if (error || !app) throw new Error(error?.message ?? "Application not found");

  const provider = Array.isArray(app.providers) ? app.providers[0] : app.providers;

  return {
    app,
    submitted: {
      firstName: provider?.first_name,
      middleName: provider?.middle_name,
      lastName: provider?.last_name,
      npi: provider?.npi,
      profession: app.profession,
      specialty: provider?.specialty,
      licenseNumber: app.license_number,
      licenseState: app.license_state ?? provider?.practice_state ?? "FL",
    },
  };
}

export async function runPsvForApplication(applicationId: string) {
  const supabase = createServiceClient();
  const requirements = await ensureRequirements(applicationId);
  const extracted = await extractDocumentsForApplication(applicationId);
  const { submitted } = await loadSubmittedProfile(applicationId);

  await supabase
    .from("applications")
    .update({ psv_status: "in_progress" })
    .eq("id", applicationId);

  // Clear prior run artifacts for idempotent demo re-runs
  await supabase
    .from("verifications")
    .delete()
    .eq("application_id", applicationId);
  await supabase
    .from("verification_evidence")
    .delete()
    .eq("application_id", applicationId);
  await supabase
    .from("credentialing_exceptions")
    .delete()
    .eq("application_id", applicationId)
    .eq("status", "open");

  const { data: reqRows } = await supabase
    .from("credential_requirements")
    .select("*")
    .eq("application_id", applicationId)
    .order("sort_order");

  const psvResults: PSVResult[] = [];

  for (const req of reqRows ?? []) {
    if (!req.required) {
      await supabase
        .from("credential_requirements")
        .update({ status: "not_applicable" })
        .eq("id", req.id);
      continue;
    }

    if (req.verification_method === "document") {
      const { data: docs } = await supabase
        .from("documents")
        .select("id, file_name, document_type")
        .eq("application_id", applicationId);

      const type = req.requirement_type as string;
      const found = (docs ?? []).some(
        (d: {
          file_name?: string | null;
          document_type?: string | null;
        }) => {
          const blob = `${d.file_name ?? ""} ${d.document_type ?? ""}`.toLowerCase();
          if (type === "cv") return blob.includes("cv") || blob.includes("resume");
          if (type === "malpractice_documentation") {
            return (
              blob.includes("malpractice") ||
              blob.includes("coi") ||
              blob.includes("insurance")
            );
          }
          return false;
        },
      );

      await supabase
        .from("credential_requirements")
        .update({ status: found ? "received" : "required" })
        .eq("id", req.id);

      if (!found) {
        await supabase.from("credentialing_exceptions").insert({
          external_id: extId("EXC"),
          application_id: applicationId,
          requirement_id: req.id,
          exception_type: "missing",
          severity: "warning",
          description: `Missing ${req.label}`,
          source: "Requirements engine",
          status: "open",
        });
      }
      continue;
    }

    const provider = providerForRequirement(req.requirement_type as RequirementType);
    if (!provider) {
      await supabase
        .from("credential_requirements")
        .update({ status: "human_review" })
        .eq("id", req.id);
      await supabase.from("credentialing_exceptions").insert({
        external_id: extId("EXC"),
        application_id: applicationId,
        requirement_id: req.id,
        exception_type: "human_review",
        severity: "warning",
        description: `${req.label}: no automated provider configured.`,
        source: "PSV registry",
        status: "open",
      });
      continue;
    }

    await supabase
      .from("credential_requirements")
      .update({ status: "pending_verification" })
      .eq("id", req.id);

    const request: PSVRequest = {
      applicationId,
      requirementType: req.requirement_type as RequirementType,
      ...submitted,
    };

    const result = await provider.verify(request);
    psvResults.push(result);

    const { data: verification, error: vErr } = await supabase
      .from("verifications")
      .insert({
        external_id: extId("VER"),
        application_id: applicationId,
        requirement_id: req.id,
        verification_type: result.verificationType,
        provider: result.provider,
        source_name: result.sourceName,
        source_url: result.sourceUrl ?? null,
        source_mode: result.sourceMode,
        status: result.status,
        result_summary: result.resultSummary,
        matched_fields: result.matchedFields,
        unmatched_fields: result.unmatchedFields,
        normalized_result: result.normalizedResult,
        retrieved_at: result.retrievedAt,
        verified_by: result.verifiedBy,
      })
      .select("id")
      .single();

    if (vErr) throw new Error(vErr.message);

    await supabase.from("verification_evidence").insert({
      external_id: extId("EVD"),
      application_id: applicationId,
      requirement_id: req.id,
      verification_id: verification.id,
      provider: result.provider,
      verification_type: String(result.verificationType),
      source_name: result.sourceName,
      source_url: result.sourceUrl ?? null,
      request_timestamp: result.retrievedAt,
      response_timestamp: result.retrievedAt,
      result: result.resultSummary,
      matched_fields: result.matchedFields,
      unmatched_fields: result.unmatchedFields,
      raw_response: result.rawResponse ?? null,
      raw_response_reference:
        result.sourceMode === "live" ? result.sourceUrl ?? null : "poc-fixture",
      verified_by: result.verifiedBy,
      verification_method: result.sourceMode,
    });

    await supabase
      .from("credential_requirements")
      .update({ status: mapResultToRequirementStatus(result) })
      .eq("id", req.id);
  }

  const reconciliation = reconcileCase({
    submitted,
    extracted,
    psvResults,
  });

  for (const finding of reconciliation.findings) {
    await supabase.from("credentialing_exceptions").insert({
      external_id: extId("EXC"),
      application_id: applicationId,
      exception_type: finding.type,
      severity: finding.severity,
      description: finding.description,
      source: finding.source,
      status: "open",
    });
  }

  const { data: finalReqs } = await supabase
    .from("credential_requirements")
    .select("required, status")
    .eq("application_id", applicationId);

  const { count: exceptionCount } = await supabase
    .from("credentialing_exceptions")
    .select("*", { count: "exact", head: true })
    .eq("application_id", applicationId)
    .eq("status", "open")
    .in("exception_type", ["mismatch", "verification_failure", "expired", "missing"]);

  const { count: humanReviewCount } = await supabase
    .from("credentialing_exceptions")
    .select("*", { count: "exact", head: true })
    .eq("application_id", applicationId)
    .eq("status", "open")
    .eq("exception_type", "human_review");

  // Also count requirement human_review statuses
  const humanFromReqs = (finalReqs ?? []).filter(
    (r) => r.status === "human_review",
  ).length;

  const readiness = computeReadiness({
    requirements: finalReqs ?? [],
    exceptionCount: exceptionCount ?? 0,
    humanReviewCount: (humanReviewCount ?? 0) + humanFromReqs,
  });

  // Identity mismatch forces human review overall
  if (!reconciliation.identityPass) {
    readiness.overallStatus = "human_review";
  }

  await supabase
    .from("applications")
    .update({
      readiness_score: readiness.score,
      psv_status: readiness.overallStatus,
      psv_ran_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  await supabase.from("audit_events").insert({
    external_id: extId("AUD"),
    application_id: applicationId,
    event_type: "psv_run_completed",
    actor: "system",
    detail: {
      readiness,
      identityPass: reconciliation.identityPass,
      consistencyPass: reconciliation.consistencyPass,
      psvCount: psvResults.length,
    },
  });

  return {
    requirements: reqRows ?? requirements,
    psvResults,
    reconciliation,
    readiness: {
      ...readiness,
      label: "Credentialing Readiness" as const,
      disclaimer:
        "Credentialing Readiness is a POC workflow indicator — not a regulatory or compliance determination.",
    },
  };
}

export async function getPsvDashboard(applicationId: string) {
  const supabase = createServiceClient();

  const { data: app, error } = await supabase
    .from("applications")
    .select(
      "*, providers(id, npi, first_name, middle_name, last_name, display_name, specialty, practice_state)",
    )
    .eq("id", applicationId)
    .single();

  if (error || !app) throw new Error(error?.message ?? "Application not found");

  const [
    { data: requirements },
    { data: verifications },
    { data: evidence },
    { data: exceptions },
    { data: extracted },
    { data: audits },
  ] = await Promise.all([
    supabase
      .from("credential_requirements")
      .select("*")
      .eq("application_id", applicationId)
      .order("sort_order"),
    supabase
      .from("verifications")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at"),
    supabase
      .from("verification_evidence")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("credentialing_exceptions")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("extracted_credential_data")
      .select("*")
      .eq("application_id", applicationId),
    supabase
      .from("audit_events")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const readiness = computeReadiness({
    requirements: requirements ?? [],
    exceptionCount: (exceptions ?? []).filter(
      (e) =>
        e.status === "open" &&
        ["mismatch", "verification_failure", "expired", "missing"].includes(
          e.exception_type,
        ),
    ).length,
    humanReviewCount: (exceptions ?? []).filter(
      (e) => e.status === "open" && e.exception_type === "human_review",
    ).length,
  });

  return {
    application: app,
    requirements: requirements ?? [],
    verifications: verifications ?? [],
    evidence: evidence ?? [],
    exceptions: exceptions ?? [],
    extracted: extracted ?? [],
    audits: audits ?? [],
    readiness: {
      score: app.readiness_score ?? readiness.score,
      verified: readiness.verified,
      pending: readiness.pending,
      exceptions: readiness.exceptions,
      humanReview: readiness.humanReview,
      totalRequired: readiness.totalRequired,
      overallStatus: (app.psv_status as typeof readiness.overallStatus) ?? readiness.overallStatus,
      label: "Credentialing Readiness" as const,
      disclaimer:
        "Credentialing Readiness is a POC workflow indicator — not a regulatory or compliance determination.",
    },
  };
}
