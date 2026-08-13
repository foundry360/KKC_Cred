export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "additional_info_required"
  | "approved"
  | "denied"
  | "withdrawn";

export type Application = {
  id: string;
  providerId: string;
  organizationId: string;
  status: ApplicationStatus;
  submittedAt?: string;
  reviewedAt?: string;
  reviewerNotes?: string;
  createdAt: string;
  updatedAt: string;
};
