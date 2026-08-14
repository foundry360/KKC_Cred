import type {
  ExceptionSeverity,
  ExceptionType,
  FieldMatch,
  PSVResult,
} from "@/types/psv";

export type SubmittedProfile = {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  npi?: string | null;
  profession?: string | null;
  specialty?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
};

export type ExtractedSnapshot = Record<string, string | null | undefined>;

export type ReconciliationFinding = {
  type: ExceptionType;
  severity: ExceptionSeverity;
  description: string;
  source: string;
  field?: string;
};

function norm(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function softNameEqual(a?: string | null, b?: string | null): boolean {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return true; // missing comparison handled elsewhere
  if (left === right) return true;
  // Allow middle initial differences: JANE A SMITH vs JANE SMITH
  const leftParts = left.split(" ");
  const rightParts = right.split(" ");
  if (leftParts[0] === rightParts[0] && leftParts.at(-1) === rightParts.at(-1)) {
    return true;
  }
  return false;
}

/**
 * Deterministic reconciliation across submitted, extracted, and PSV results.
 * AI must not override authoritative source data.
 */
export function reconcileCase(input: {
  submitted: SubmittedProfile;
  extracted?: ExtractedSnapshot;
  psvResults: PSVResult[];
}): {
  identityPass: boolean;
  consistencyPass: boolean;
  findings: ReconciliationFinding[];
  fieldComparisons: FieldMatch[];
} {
  const findings: ReconciliationFinding[] = [];
  const fieldComparisons: FieldMatch[] = [];

  const submittedName = [input.submitted.firstName, input.submitted.lastName]
    .filter(Boolean)
    .join(" ");

  for (const result of input.psvResults) {
    for (const m of result.matchedFields) fieldComparisons.push(m);
    for (const u of result.unmatchedFields) {
      fieldComparisons.push(u);
      if (u.field === "first_name" || u.field === "last_name" || u.field === "provider_name") {
        findings.push({
          type: "mismatch",
          severity: "critical",
          description: `Potential identity discrepancy on ${result.sourceName}: submitted "${u.submitted ?? submittedName}" vs source "${u.source ?? "—"}". Human review required.`,
          source: result.sourceName,
          field: u.field,
        });
      } else if (!u.match) {
        findings.push({
          type: "mismatch",
          severity: "warning",
          description: `${u.field} mismatch on ${result.sourceName}: submitted "${u.submitted ?? "—"}" vs source "${u.source ?? "—"}".`,
          source: result.sourceName,
          field: u.field,
        });
      }
    }

    if (result.status === "failed" || result.status === "not_verified") {
      findings.push({
        type: "verification_failure",
        severity: "critical",
        description: result.resultSummary,
        source: result.sourceName,
      });
    } else if (result.status === "human_review") {
      findings.push({
        type: "human_review",
        severity: "warning",
        description: result.resultSummary,
        source: result.sourceName,
      });
    } else if (result.status === "exception") {
      findings.push({
        type: "verification_failure",
        severity: "critical",
        description: result.resultSummary,
        source: result.sourceName,
      });
    }
  }

  const extractedName = input.extracted?.provider_name;
  if (extractedName && submittedName && !softNameEqual(submittedName, extractedName)) {
    findings.push({
      type: "mismatch",
      severity: "critical",
      description: `Potential identity discrepancy: application "${submittedName}" vs extracted document "${extractedName}". Human review required.`,
      source: "Document extraction",
      field: "provider_name",
    });
    fieldComparisons.push({
      field: "provider_name",
      submitted: submittedName,
      source: extractedName,
      match: false,
    });
  }

  if (input.extracted?.license_number && input.submitted.licenseNumber) {
    const match =
      norm(input.extracted.license_number) === norm(input.submitted.licenseNumber);
    fieldComparisons.push({
      field: "license_number",
      submitted: input.submitted.licenseNumber,
      source: input.extracted.license_number,
      match,
    });
    if (!match) {
      findings.push({
        type: "mismatch",
        severity: "warning",
        description: `License number differs between application and extracted document.`,
        source: "Document extraction",
        field: "license_number",
      });
    }
  }

  const identityPass = !findings.some(
    (f) => f.type === "mismatch" && f.severity === "critical",
  );
  const consistencyPass = !findings.some((f) => f.type === "mismatch");

  return { identityPass, consistencyPass, findings, fieldComparisons };
}

export function computeReadiness(input: {
  requirements: { required: boolean; status: string }[];
  exceptionCount: number;
  humanReviewCount: number;
}): {
  score: number;
  verified: number;
  pending: number;
  exceptions: number;
  humanReview: number;
  totalRequired: number;
  overallStatus:
    | "not_started"
    | "in_progress"
    | "verified"
    | "exception"
    | "human_review"
    | "credentialing_ready";
} {
  const required = input.requirements.filter((r) => r.required);
  const totalRequired = required.length || 1;
  const verified = required.filter((r) =>
    ["verified", "clear", "received"].includes(r.status),
  ).length;
  const pending = required.filter((r) =>
    ["required", "pending_verification", "received"].includes(r.status),
  ).length;
  // pending_verification / required count as not done; received without verify still pending for PSV types
  const done = required.filter((r) =>
    ["verified", "clear", "not_applicable", "received"].includes(r.status),
  ).length;
  const score = Math.round((done / totalRequired) * 100);

  let overallStatus:
    | "not_started"
    | "in_progress"
    | "verified"
    | "exception"
    | "human_review"
    | "credentialing_ready" = "in_progress";

  if (input.exceptionCount > 0 && input.humanReviewCount === 0) {
    overallStatus = "exception";
  } else if (input.humanReviewCount > 0) {
    overallStatus = "human_review";
  } else if (score === 100) {
    overallStatus = "credentialing_ready";
  } else if (done === 0) {
    overallStatus = "not_started";
  }

  return {
    score,
    verified: done,
    pending: totalRequired - done,
    exceptions: input.exceptionCount,
    humanReview: input.humanReviewCount,
    totalRequired,
    overallStatus,
  };
}
