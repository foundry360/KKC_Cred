export type ProviderStatus = "active" | "inactive" | "pending" | "suspended";
export type SubjectType = "practitioner" | "facility";

export type Provider = {
  id: string;
  externalId: string;
  subjectType: SubjectType;
  organizationId?: string | null;
  organizationName?: string | null;
  npi?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName: string;
  specialty?: string | null;
  facilityType?: string | null;
  email?: string | null;
  phone?: string | null;
  status: ProviderStatus;
  credStartDate?: string | null;
  credEndDate?: string | null;
  recredDueDate?: string | null;
  createdAt: string;
  updatedAt: string;
};
