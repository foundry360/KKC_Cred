export type SanctionsCheck = {
  id: string;
  externalId: string;
  providerId: string;
  source?: string | null;
  checkedAt?: string | null;
  result?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};
