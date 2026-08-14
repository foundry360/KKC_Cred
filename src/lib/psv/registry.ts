import type { PSVProvider } from "@/lib/psv/types";
import type { RequirementType } from "@/types/psv";
import { NPIProvider } from "@/lib/psv/providers/nppes";
import { FloridaLicenseProvider } from "@/lib/psv/providers/florida-license";
import { OIGProvider } from "@/lib/psv/providers/oig";
import { BoardCertificationProvider } from "@/lib/psv/providers/board";
import { DEAProvider } from "@/lib/psv/providers/dea";

const providers: PSVProvider[] = [
  new NPIProvider(),
  new FloridaLicenseProvider(),
  new OIGProvider(),
  new BoardCertificationProvider(),
  new DEAProvider(),
];

const byId = new Map(providers.map((p) => [p.id, p]));

const requirementProviderMap: Partial<Record<RequirementType, string>> = {
  npi_verification: "nppes",
  state_license_verification: "florida_license",
  oig_exclusion: "oig_leie",
  board_certification: "board_certification",
  dea_verification: "dea",
};

export function getPSVProvider(id: string): PSVProvider | undefined {
  return byId.get(id);
}

export function providerForRequirement(
  requirementType: RequirementType | string,
): PSVProvider | undefined {
  const id = requirementProviderMap[requirementType as RequirementType];
  return id ? byId.get(id) : undefined;
}

export function listPSVProviders(): PSVProvider[] {
  return [...providers];
}
