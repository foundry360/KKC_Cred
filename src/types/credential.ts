export type CredentialType =
  | "medical_license"
  | "dea"
  | "board_certification"
  | "malpractice_insurance"
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
  providerId: string;
  type: CredentialType;
  name: string;
  number?: string;
  issuingAuthority?: string;
  issuedAt?: string;
  expiresAt?: string;
  status: CredentialStatus;
  documentId?: string;
  createdAt: string;
  updatedAt: string;
};
