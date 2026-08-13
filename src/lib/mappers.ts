import type { Credential, Provider, SanctionsCheck, SubjectType } from "@/types";

type ProviderRow = {
  id: string;
  external_id: string;
  subject_type: SubjectType;
  organization_id: string | null;
  organization_name: string | null;
  npi: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  specialty: string | null;
  facility_type: string | null;
  email: string | null;
  phone: string | null;
  status: Provider["status"];
  cred_start_date: string | null;
  cred_end_date: string | null;
  recred_due_date: string | null;
  created_at: string;
  updated_at: string;
};

type CredentialRow = {
  id: string;
  external_id: string;
  provider_id: string;
  credential_type: Credential["type"];
  name: string | null;
  credential_number: string | null;
  issuing_authority: string | null;
  issued_at: string | null;
  expires_at: string | null;
  status: Credential["status"];
  created_at: string;
  updated_at: string;
};

type SanctionsRow = {
  id: string;
  external_id: string;
  provider_id: string;
  source: string | null;
  checked_at: string | null;
  result: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function mapProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    externalId: row.external_id,
    subjectType: row.subject_type,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    npi: row.npi,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    specialty: row.specialty,
    facilityType: row.facility_type,
    email: row.email,
    phone: row.phone,
    status: row.status,
    credStartDate: row.cred_start_date,
    credEndDate: row.cred_end_date,
    recredDueDate: row.recred_due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCredential(row: CredentialRow): Credential {
  return {
    id: row.id,
    externalId: row.external_id,
    providerId: row.provider_id,
    type: row.credential_type,
    name: row.name,
    number: row.credential_number,
    issuingAuthority: row.issuing_authority,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSanctions(row: SanctionsRow): SanctionsCheck {
  return {
    id: row.id,
    externalId: row.external_id,
    providerId: row.provider_id,
    source: row.source,
    checkedAt: row.checked_at,
    result: row.result,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type { ProviderRow, CredentialRow, SanctionsRow };
