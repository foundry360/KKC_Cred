import type {
  AddressType,
  Credential,
  DegreeType,
  EducationHistory,
  Gender,
  Provider,
  ProviderAddress,
  SanctionsCheck,
  SubjectType,
  WorkHistory,
} from "@/types";

type ProviderRow = {
  id: string;
  external_id: string;
  subject_type: SubjectType;
  organization_id: string | null;
  organization_name: string | null;
  npi: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  name_suffix: string | null;
  display_name: string;
  specialty: string | null;
  facility_type: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  ssn_last4: string | null;
  birth_country: string | null;
  preferred_languages: string | null;
  caqh_id: string | null;
  practice_state: string | null;
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

type EducationRow = {
  id: string;
  external_id: string;
  provider_id: string;
  institution_name: string;
  degree_type: DegreeType;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  graduation_year: number | null;
  country: string | null;
  created_at: string;
  updated_at: string;
};

type WorkHistoryRow = {
  id: string;
  external_id: string;
  provider_id: string;
  employer_name: string;
  title: string | null;
  department: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  location: string | null;
  created_at: string;
  updated_at: string;
};

type AddressRow = {
  id: string;
  external_id: string;
  provider_id: string;
  address_type: AddressType;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  is_primary: boolean;
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
    middleName: row.middle_name,
    lastName: row.last_name,
    nameSuffix: row.name_suffix,
    displayName: row.display_name,
    specialty: row.specialty,
    facilityType: row.facility_type,
    email: row.email,
    phone: row.phone,
    mobilePhone: row.mobile_phone,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    ssnLast4: row.ssn_last4,
    birthCountry: row.birth_country,
    preferredLanguages: row.preferred_languages,
    caqhId: row.caqh_id,
    practiceState: row.practice_state,
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

export function mapEducation(row: EducationRow): EducationHistory {
  return {
    id: row.id,
    externalId: row.external_id,
    providerId: row.provider_id,
    institutionName: row.institution_name,
    degreeType: row.degree_type,
    fieldOfStudy: row.field_of_study,
    startDate: row.start_date,
    endDate: row.end_date,
    graduationYear: row.graduation_year,
    country: row.country,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWorkHistory(row: WorkHistoryRow): WorkHistory {
  return {
    id: row.id,
    externalId: row.external_id,
    providerId: row.provider_id,
    employerName: row.employer_name,
    title: row.title,
    department: row.department,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: row.is_current,
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAddress(row: AddressRow): ProviderAddress {
  return {
    id: row.id,
    externalId: row.external_id,
    providerId: row.provider_id,
    addressType: row.address_type,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type {
  ProviderRow,
  CredentialRow,
  SanctionsRow,
  EducationRow,
  WorkHistoryRow,
  AddressRow,
};
