export type WorkHistory = {
  id: string;
  externalId: string;
  providerId: string;
  employerName: string;
  title: string | null;
  department: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  location: string | null;
  createdAt: string;
  updatedAt: string;
};
