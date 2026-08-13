export type CredentialType =
  | "medical_license"
  | "dea"
  | "board_certification"
  | "malpractice_insurance"
  | "facility_license"
  | "accreditation"
  | "clia"
  | "cme"
  | "other";

export type CredentialStatus =
  | "valid"
  | "expiring_soon"
  | "expired"
  | "pending_verification"
  | "rejected";

export type Credential = {
  id: string;
  externalId: string;
  providerId: string;
  type: CredentialType;
  name?: string | null;
  number?: string | null;
  issuingAuthority?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  status: CredentialStatus;
  createdAt: string;
  updatedAt: string;
};
