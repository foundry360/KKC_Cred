export type DegreeType =
  | "md"
  | "do"
  | "mbbs"
  | "phd"
  | "masters"
  | "bachelors"
  | "residency"
  | "fellowship"
  | "internship"
  | "other";

export type EducationHistory = {
  id: string;
  externalId: string;
  providerId: string;
  institutionName: string;
  degreeType: DegreeType;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  graduationYear: number | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
};
