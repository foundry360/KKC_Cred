import type { FieldMatch, PSVRequest, PSVResult } from "@/types/psv";
import type { PSVProvider } from "@/lib/psv/types";

const NPPES_URL = "https://npiregistry.cms.hhs.gov/api/";

type NppesBasic = {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  organization_name?: string;
  credential?: string;
  status?: string;
  enumeration_date?: string;
  sex?: string;
};

type NppesTaxonomy = {
  code?: string;
  desc?: string;
  primary?: boolean;
  state?: string;
  license?: string;
};

type NppesAddress = {
  address_1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  address_purpose?: string;
};

type NppesResult = {
  number?: string;
  enumeration_type?: string;
  basic?: NppesBasic;
  taxonomies?: NppesTaxonomy[];
  addresses?: NppesAddress[];
};

type NppesResponse = {
  result_count?: number;
  results?: NppesResult[];
};

function norm(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function nameMatch(a?: string | null, b?: string | null): boolean {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

/**
 * LIVE primary source: CMS NPPES NPI Registry API (public, no key).
 * NPI verification is NOT professional licensure verification.
 */
export class NPIProvider implements PSVProvider {
  readonly id = "nppes";
  readonly sourceName = "CMS NPPES NPI Registry";
  readonly sourceMode = "live" as const;

  async verify(input: PSVRequest): Promise<PSVResult> {
    const retrievedAt = new Date().toISOString();
    const npi = (input.npi ?? "").replace(/\D/g, "");

    if (!/^\d{10}$/.test(npi)) {
      return {
        provider: this.id,
        verificationType: "npi_verification",
        sourceName: this.sourceName,
        sourceUrl: NPPES_URL,
        sourceMode: this.sourceMode,
        status: "failed",
        resultSummary: "NPI must be a 10-digit number to query NPPES.",
        matchedFields: [],
        unmatchedFields: [
          {
            field: "npi",
            submitted: input.npi,
            source: null,
            match: false,
          },
        ],
        normalizedResult: { npi: input.npi, error: "invalid_npi" },
        retrievedAt,
        verifiedBy: "NPIProvider",
      };
    }

    const url = `${NPPES_URL}?version=2.1&number=${encodeURIComponent(npi)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        provider: this.id,
        verificationType: "npi_verification",
        sourceName: this.sourceName,
        sourceUrl: url,
        sourceMode: this.sourceMode,
        status: "failed",
        resultSummary: `NPPES request failed (${response.status}).`,
        matchedFields: [],
        unmatchedFields: [],
        normalizedResult: { npi, httpStatus: response.status },
        retrievedAt,
        verifiedBy: "NPIProvider",
      };
    }

    const raw = (await response.json()) as NppesResponse;
    const record = raw.results?.[0];

    if (!record) {
      return {
        provider: this.id,
        verificationType: "npi_verification",
        sourceName: this.sourceName,
        sourceUrl: url,
        sourceMode: this.sourceMode,
        status: "not_verified",
        resultSummary: `NPI ${npi} was not found in NPPES.`,
        matchedFields: [],
        unmatchedFields: [
          { field: "npi", submitted: npi, source: null, match: false },
        ],
        normalizedResult: { npi, found: false },
        rawResponse: raw,
        retrievedAt,
        verifiedBy: "NPIProvider",
      };
    }

    const basic = record.basic ?? {};
    const primaryTaxonomy =
      (record.taxonomies ?? []).find((t) => t.primary) ??
      (record.taxonomies ?? [])[0];
    const location =
      (record.addresses ?? []).find((a) => a.address_purpose === "LOCATION") ??
      (record.addresses ?? [])[0];

    const providerName = [basic.first_name, basic.middle_name, basic.last_name]
      .filter(Boolean)
      .join(" ");

    const matched: FieldMatch[] = [];
    const unmatched: FieldMatch[] = [];

    const npiField: FieldMatch = {
      field: "npi",
      submitted: npi,
      source: record.number ?? npi,
      match: record.number === npi,
    };
    (npiField.match ? matched : unmatched).push(npiField);

    const first: FieldMatch = {
      field: "first_name",
      submitted: input.firstName,
      source: basic.first_name ?? null,
      match: nameMatch(input.firstName, basic.first_name),
    };
    (first.match ? matched : unmatched).push(first);

    const last: FieldMatch = {
      field: "last_name",
      submitted: input.lastName,
      source: basic.last_name ?? null,
      match: nameMatch(input.lastName, basic.last_name),
    };
    (last.match ? matched : unmatched).push(last);

    if (input.licenseState && (primaryTaxonomy?.state || location?.state)) {
      const stateSource = primaryTaxonomy?.state || location?.state || null;
      const stateField: FieldMatch = {
        field: "license_state",
        submitted: input.licenseState,
        source: stateSource,
        match: norm(input.licenseState) === norm(stateSource),
      };
      (stateField.match ? matched : unmatched).push(stateField);
    }

    const identityOk = first.match && last.match && npiField.match;
    const status = identityOk
      ? unmatched.some((f) => f.field === "license_state")
        ? "human_review"
        : "verified"
      : unmatched.some((f) => f.field === "first_name" || f.field === "last_name")
        ? "human_review"
        : "not_verified";

    return {
      provider: this.id,
      verificationType: "npi_verification",
      sourceName: this.sourceName,
      sourceUrl: url,
      sourceMode: this.sourceMode,
      status,
      resultSummary: identityOk
        ? `NPI ${npi} found in NPPES for ${providerName || "provider"}. Identity match.`
        : `NPI ${npi} found in NPPES, but submitted identity does not fully match source.`,
      matchedFields: matched,
      unmatchedFields: unmatched,
      normalizedResult: {
        source: "NPPES",
        verification_type: "NPI",
        status: status === "verified" ? "VERIFIED" : status.toUpperCase(),
        provider_name: providerName,
        npi: record.number,
        provider_type: record.enumeration_type,
        taxonomy: primaryTaxonomy?.desc?.trim() ?? null,
        taxonomy_license: primaryTaxonomy?.license ?? null,
        taxonomy_state: primaryTaxonomy?.state ?? null,
        practice_location: location
          ? {
              line1: location.address_1,
              city: location.city,
              state: location.state,
              postal_code: location.postal_code,
            }
          : null,
        nppes_status: basic.status,
        enumeration_date: basic.enumeration_date,
        retrieved_at: retrievedAt,
        source_reference: url,
        note: "NPI verification does not confirm professional licensure.",
      },
      rawResponse: raw,
      retrievedAt,
      verifiedBy: "NPIProvider",
    };
  }
}
