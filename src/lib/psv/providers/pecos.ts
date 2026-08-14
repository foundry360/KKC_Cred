import type { FieldMatch, PSVRequest, PSVResult } from "@/types/psv";
import type { PSVProvider } from "@/lib/psv/types";

/** CMS Medicare Fee-For-Service Public Provider Enrollment (PECOS extract). */
const PECOS_DATASET =
  "2457ea29-fc82-48b0-86ec-3b0755de7515";
const PECOS_URL = `https://data.cms.gov/data-api/v1/dataset/${PECOS_DATASET}/data`;

type PecosRow = {
  NPI?: string;
  FIRST_NAME?: string;
  MDL_NAME?: string;
  LAST_NAME?: string;
  ORG_NAME?: string;
  PROVIDER_TYPE_DESC?: string;
  STATE_CD?: string;
  ENRLMT_ID?: string;
  PECOS_ASCT_CNTL_ID?: string;
};

function softEqual(a?: string | null, b?: string | null): boolean {
  const left = (a ?? "").trim().toUpperCase();
  const right = (b ?? "").trim().toUpperCase();
  if (!left || !right) return true;
  return left === right || left.includes(right) || right.includes(left);
}

/**
 * LIVE: CMS public PECOS enrollment extract via data.cms.gov API.
 * Confirms Medicare FFS enrollment — not state licensure or board certification.
 */
export class PECOSProvider implements PSVProvider {
  readonly id = "pecos";
  readonly sourceName = "CMS PECOS Public Enrollment";
  readonly sourceMode = "live" as const;

  async verify(input: PSVRequest): Promise<PSVResult> {
    const retrievedAt = new Date().toISOString();
    const npi = (input.npi ?? "").replace(/\D/g, "");

    if (!/^\d{10}$/.test(npi)) {
      return {
        provider: this.id,
        verificationType: "medicare_enrollment",
        sourceName: this.sourceName,
        sourceUrl:
          "https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/medicare-fee-for-service-public-provider-enrollment",
        sourceMode: this.sourceMode,
        status: "not_verified",
        resultSummary:
          "Medicare enrollment check needs a valid 10-digit NPI.",
        matchedFields: [],
        unmatchedFields: [
          { field: "npi", submitted: input.npi, source: null, match: false },
        ],
        normalizedResult: { source: "PECOS", error: "invalid_npi" },
        retrievedAt,
        verifiedBy: "PECOSProvider",
      };
    }

    try {
      const params = new URLSearchParams({
        "filter[NPI]": npi,
        size: "25",
      });
      const res = await fetch(`${PECOS_URL}?${params.toString()}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        throw new Error(`CMS data API ${res.status}`);
      }

      const rows = (await res.json()) as PecosRow[];
      if (!Array.isArray(rows) || rows.length === 0) {
        return {
          provider: this.id,
          verificationType: "medicare_enrollment",
          sourceName: this.sourceName,
          sourceUrl:
            "https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/medicare-fee-for-service-public-provider-enrollment",
          sourceMode: this.sourceMode,
          status: "not_verified",
          resultSummary: `NPI ${npi} was not found in the CMS Medicare FFS public enrollment file. Provider may not be Medicare-enrolled, or enrollment is not in this public extract.`,
          matchedFields: [],
          unmatchedFields: [
            { field: "npi", submitted: npi, source: null, match: false },
          ],
          normalizedResult: {
            source: "PECOS",
            mode: "live",
            status: "NOT_FOUND",
            npi,
          },
          rawResponse: { rows: [] },
          retrievedAt,
          verifiedBy: "PECOSProvider",
        };
      }

      const primary = rows[0];
      const sourceName =
        primary.ORG_NAME ||
        [primary.FIRST_NAME, primary.MDL_NAME, primary.LAST_NAME]
          .filter(Boolean)
          .join(" ");

      const matched: FieldMatch[] = [];
      const unmatched: FieldMatch[] = [];
      const npiField: FieldMatch = {
        field: "npi",
        submitted: npi,
        source: primary.NPI ?? npi,
        match: (primary.NPI ?? npi) === npi,
      };
      (npiField.match ? matched : unmatched).push(npiField);

      if (input.firstName || input.lastName) {
        const first: FieldMatch = {
          field: "first_name",
          submitted: input.firstName,
          source: primary.FIRST_NAME,
          match: softEqual(input.firstName, primary.FIRST_NAME),
        };
        const last: FieldMatch = {
          field: "last_name",
          submitted: input.lastName,
          source: primary.LAST_NAME,
          match: softEqual(input.lastName, primary.LAST_NAME),
        };
        (first.match ? matched : unmatched).push(first);
        (last.match ? matched : unmatched).push(last);
      }

      const identityOk = unmatched.every(
        (u) => u.field !== "first_name" && u.field !== "last_name",
      );

      const types = [
        ...new Set(rows.map((r) => r.PROVIDER_TYPE_DESC).filter(Boolean)),
      ];
      const states = [...new Set(rows.map((r) => r.STATE_CD).filter(Boolean))];

      return {
        provider: this.id,
        verificationType: "medicare_enrollment",
        sourceName: this.sourceName,
        sourceUrl:
          "https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/medicare-fee-for-service-public-provider-enrollment",
        sourceMode: this.sourceMode,
        status: identityOk ? "verified" : "human_review",
        resultSummary: identityOk
          ? `Medicare FFS enrollment found for NPI ${npi} (${sourceName || "provider"}). Type: ${types.join("; ") || "—"}. State(s): ${states.join(", ") || "—"}.`
          : `Medicare FFS enrollment found for NPI ${npi}, but submitted name does not fully match PECOS (${sourceName}). Human review required.`,
        matchedFields: matched,
        unmatchedFields: unmatched,
        normalizedResult: {
          source: "PECOS",
          mode: "live",
          status: identityOk ? "ENROLLED" : "NAME_MISMATCH",
          npi,
          enrollments: rows.slice(0, 10).map((r) => ({
            enrollmentId: r.ENRLMT_ID,
            pacId: r.PECOS_ASCT_CNTL_ID,
            providerType: r.PROVIDER_TYPE_DESC,
            state: r.STATE_CD,
            name: r.ORG_NAME || [r.FIRST_NAME, r.LAST_NAME].filter(Boolean).join(" "),
          })),
        },
        rawResponse: { rows: rows.slice(0, 10) },
        retrievedAt,
        verifiedBy: "PECOSProvider",
      };
    } catch (e) {
      return {
        provider: this.id,
        verificationType: "medicare_enrollment",
        sourceName: this.sourceName,
        sourceUrl: PECOS_URL,
        sourceMode: this.sourceMode,
        status: "failed",
        resultSummary: `PECOS live check failed: ${e instanceof Error ? e.message : String(e)}`,
        matchedFields: [],
        unmatchedFields: [],
        normalizedResult: { source: "PECOS", mode: "live", error: true },
        retrievedAt,
        verifiedBy: "PECOSProvider",
      };
    }
  }
}
