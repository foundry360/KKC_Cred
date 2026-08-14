import type { Gender } from "./address";

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
  middleName?: string | null;
  lastName?: string | null;
  nameSuffix?: string | null;
  displayName: string;
  specialty?: string | null;
  facilityType?: string | null;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  ssnLast4?: string | null;
  birthCountry?: string | null;
  preferredLanguages?: string | null;
  caqhId?: string | null;
  practiceState?: string | null;
  status: ProviderStatus;
  credStartDate?: string | null;
  credEndDate?: string | null;
  recredDueDate?: string | null;
  createdAt: string;
  updatedAt: string;
};
