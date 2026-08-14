export type ChecklistItemKind = "document" | "data";

export type ChecklistTemplateItem = {
  key: string;
  label: string;
  kind: ChecklistItemKind;
};

/**
 * Practitioner credentialing checklist (expanded intake packet).
 * Federal Tax ID appears once (source list had a duplicate).
 */
export const PRACTITIONER_CHECKLIST: ChecklistTemplateItem[] = [
  {
    key: "npi_copy",
    label: "Copy of National Provider Identifier (NPI)",
    kind: "document",
  },
  {
    key: "state_license_copy",
    label: "Copy of State Practitioner License",
    kind: "document",
  },
  {
    key: "personal_information",
    label:
      "Personal Information such as Phone number, Email address, Home address, etc.",
    kind: "data",
  },
  {
    key: "federal_tax_id",
    label: "Federal Tax ID number",
    kind: "data",
  },
  {
    key: "medicaid_number",
    label: "Medicaid Number",
    kind: "data",
  },
  {
    key: "medicare_number",
    label: "Medicare Number",
    kind: "data",
  },
  {
    key: "dea_cds_certificates",
    label: "Copy of DEA (federal) certificate and CDS (state) certificate",
    kind: "document",
  },
  {
    key: "social_security_card",
    label: "Copy of Social Security Card",
    kind: "document",
  },
  {
    key: "medical_degrees_training",
    label:
      "Copy of all Medical Degrees, Internships, Training Certificates, etc.",
    kind: "document",
  },
  {
    key: "work_background",
    label:
      "Work Background with the names of the Healthcare Practices and Affiliated Letters",
    kind: "document",
  },
  {
    key: "board_certificate",
    label: "Copy of Current Board Certificate",
    kind: "document",
  },
  {
    key: "malpractice_insurance",
    label: "Copy of Malpractice Insurance Certificate",
    kind: "document",
  },
  {
    key: "curriculum_vitae",
    label: "Curriculum Vitae",
    kind: "document",
  },
  {
    key: "drivers_license",
    label: "Copy of Driver's License",
    kind: "document",
  },
];

export const FACILITY_CHECKLIST: ChecklistTemplateItem[] = [
  {
    key: "facility_license",
    label: "Facility license",
    kind: "document",
  },
  {
    key: "accreditation",
    label: "Accreditation documentation",
    kind: "document",
  },
  {
    key: "malpractice_coi",
    label: "Malpractice certificate of insurance",
    kind: "document",
  },
  {
    key: "ownership_documentation",
    label: "Ownership documentation",
    kind: "document",
  },
];

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
