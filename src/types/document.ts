export type Document = {
  id: string;
  providerId: string;
  credentialId?: string;
  applicationId?: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  uploadedAt: string;
};
