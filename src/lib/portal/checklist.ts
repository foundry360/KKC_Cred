export const PRACTITIONER_CHECKLIST = [
  { key: "medical_license_copy", label: "Medical license copy" },
  { key: "dea_certificate", label: "DEA certificate" },
  { key: "board_certification", label: "Board certification" },
  { key: "malpractice_coi", label: "Malpractice certificate of insurance" },
  { key: "caqh_attestation", label: "CAQH attestation" },
] as const;

export const FACILITY_CHECKLIST = [
  { key: "facility_license", label: "Facility license" },
  { key: "accreditation", label: "Accreditation documentation" },
  { key: "malpractice_coi", label: "Malpractice certificate of insurance" },
  { key: "ownership_documentation", label: "Ownership documentation" },
] as const;

export type ChecklistTemplateItem = {
  key: string;
  label: string;
};

export function checklistForSubject(
  subjectType: "practitioner" | "facility",
): ChecklistTemplateItem[] {
  return subjectType === "facility"
    ? [...FACILITY_CHECKLIST]
    : [...PRACTITIONER_CHECKLIST];
}

export function defaultPathForSubject(
  subjectType: "practitioner" | "facility",
): "caqh" | "in_house" | "facility" {
  return subjectType === "facility" ? "facility" : "caqh";
}
