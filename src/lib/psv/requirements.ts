import type { RequirementType } from "@/types/psv";

export type RequirementTemplate = {
  requirementType: RequirementType;
  label: string;
  required: boolean;
  verificationMethod: "live" | "poc" | "document" | "manual" | "none";
  psvProvider: string | null;
  sortOrder: number;
};

/**
 * Credential requirements engine.
 * POC path: Practitioner + Initial + Medical Doctor + Florida
 * Also covers the live NPPES Jane Smith FL demo profession.
 */
export function buildRequirements(input: {
  subjectType: "practitioner" | "facility";
  credentialingAction?: string | null;
  profession?: string | null;
  licenseState?: string | null;
  specialty?: string | null;
  hasDeaDocument?: boolean;
}): RequirementTemplate[] {
  if (input.subjectType !== "practitioner") {
    return [
      {
        requirementType: "other",
        label: "Facility credentialing package",
        required: true,
        verificationMethod: "manual",
        psvProvider: null,
        sortOrder: 1,
      },
    ];
  }

  const state = (input.licenseState ?? "FL").toUpperCase();
  const profession = (input.profession ?? "Medical Doctor").toLowerCase();
  const isFl = state === "FL";
  const isMdLike =
    profession.includes("medical") ||
    profession.includes("doctor") ||
    profession === "md" ||
    profession.includes("physician");
  const isFlPractitioner = isFl; // FL PSV path for any FL practitioner in POC

  const rows: RequirementTemplate[] = [
    {
      requirementType: "npi_verification",
      label: "NPI verification (NPPES)",
      required: true,
      verificationMethod: "live",
      psvProvider: "nppes",
      sortOrder: 1,
    },
  ];

  if (isFlPractitioner) {
    rows.push({
      requirementType: "state_license_verification",
      label: "Florida license verification",
      required: true,
      verificationMethod: "poc",
      psvProvider: "florida_license",
      sortOrder: 2,
    });
  } else {
    rows.push({
      requirementType: "state_license_verification",
      label: `${state} license verification`,
      required: true,
      verificationMethod: "manual",
      psvProvider: null,
      sortOrder: 2,
    });
  }

  rows.push({
    requirementType: "oig_exclusion",
    label: "OIG exclusion check (LEIE)",
    required: true,
    verificationMethod: "live",
    psvProvider: "oig_leie",
    sortOrder: 3,
  });

  rows.push({
    requirementType: "sam_exclusion",
    label: "SAM.gov federal exclusions",
    required: true,
    verificationMethod: "live",
    psvProvider: "sam_exclusions",
    sortOrder: 4,
  });

  rows.push({
    requirementType: "medicare_enrollment",
    label: "Medicare enrollment (PECOS)",
    required: true,
    verificationMethod: "live",
    psvProvider: "pecos",
    sortOrder: 5,
  });

  rows.push({
    requirementType: "board_certification",
    label: "Board certification verification",
    required: isMdLike && Boolean(input.specialty),
    verificationMethod: "poc",
    psvProvider: "board_certification",
    sortOrder: 6,
  });

  rows.push(
    {
      requirementType: "dea_verification",
      label: "DEA verification",
      required: Boolean(input.hasDeaDocument),
      verificationMethod: input.hasDeaDocument ? "poc" : "none",
      psvProvider: input.hasDeaDocument ? "dea" : null,
      sortOrder: 7,
    },
    {
      requirementType: "malpractice_documentation",
      label: "Malpractice documentation",
      required: isMdLike,
      verificationMethod: "document",
      psvProvider: null,
      sortOrder: 8,
    },
    {
      requirementType: "cv",
      label: "CV / resume",
      required: true,
      verificationMethod: "document",
      psvProvider: null,
      sortOrder: 9,
    },
  );

  return rows;
}
