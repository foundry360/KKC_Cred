export type ProviderStatus = "active" | "inactive" | "pending" | "suspended";

export type Provider = {
  id: string;
  firstName: string;
  lastName: string;
  npi?: string;
  email?: string;
  specialty?: string;
  status: ProviderStatus;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
};
