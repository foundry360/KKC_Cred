/**
 * Primary Source Verification (PSV) types.
 * AI extraction is never treated as verification.
 */

export type SourceMode = "live" | "poc";

export type VerificationStatus =
  | "verified"
  | "clear"
  | "pending"
  | "exception"
  | "human_review"
  | "not_verified"
  | "failed";

export type RequirementStatus =
  | "required"
  | "received"
  | "pending_verification"
  | "verified"
  | "exception"
  | "human_review"
  | "not_applicable"
  | "clear";

export type RequirementType =
  | "npi_verification"
  | "state_license_verification"
  | "oig_exclusion"
  | "board_certification"
  | "dea_verification"
  | "malpractice_documentation"
  | "cv"
  | "other";

export type ExceptionType =
  | "missing"
  | "expired"
  | "mismatch"
  | "verification_failure"
  | "human_review"
  | "other";

export type ExceptionSeverity = "informational" | "warning" | "critical";

export type PsvCaseStatus =
  | "not_started"
  | "in_progress"
  | "verified"
  | "exception"
  | "human_review"
  | "credentialing_ready";

export type FieldMatch = {
  field: string;
  submitted?: string | null;
  source?: string | null;
  match: boolean;
};

export type PSVRequest = {
  applicationId: string;
  requirementType: RequirementType;
  npi?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  profession?: string | null;
  specialty?: string | null;
};

export type PSVResult = {
  provider: string;
  verificationType: RequirementType | string;
  sourceName: string;
  sourceUrl?: string;
  sourceMode: SourceMode;
  status: VerificationStatus;
  resultSummary: string;
  matchedFields: FieldMatch[];
  unmatchedFields: FieldMatch[];
  normalizedResult: Record<string, unknown>;
  rawResponse?: unknown;
  retrievedAt: string;
  verifiedBy: string;
};

export type ExtractedField = {
  field: string;
  value: string | null;
  confidence: number;
  sourceDocument: string;
};

export type CredentialRequirementRow = {
  id: string;
  external_id: string;
  application_id: string;
  requirement_type: RequirementType | string;
  label: string;
  required: boolean;
  status: RequirementStatus;
  verification_method: "live" | "poc" | "document" | "manual" | "none" | null;
  psv_provider: string | null;
  due_date: string | null;
  sort_order: number;
};

export type ReadinessSnapshot = {
  score: number;
  verified: number;
  pending: number;
  exceptions: number;
  humanReview: number;
  totalRequired: number;
  overallStatus: PsvCaseStatus;
  label: "Credentialing Readiness";
  disclaimer: string;
};
