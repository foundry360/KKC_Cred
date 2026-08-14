import type { PSVRequest, PSVResult } from "@/types/psv";
import type { PSVProvider } from "@/lib/psv/types";

const SAM_EXCLUSIONS_URL =
  "https://api.sam.gov/entity-information/v4/exclusions";

type SamExclusion = {
  exclusionName?: string;
  exclusionType?: string;
  classificationType?: string;
  excludingAgencyCode?: string;
  npi?: string;
  ueiSAM?: string;
  activationDate?: string;
};

/**
 * LIVE: GSA SAM.gov Exclusions API (federal debarment / suspension).
 * Requires free SAM.gov API key: https://sam.gov → Account → API Key.
 */
export class SAMExclusionsProvider implements PSVProvider {
  readonly id = "sam_exclusions";
  readonly sourceName = "SAM.gov Exclusions";
  readonly sourceMode = "live" as const;

  async verify(input: PSVRequest): Promise<PSVResult> {
    const retrievedAt = new Date().toISOString();
    const apiKey = process.env.SAM_API_KEY?.trim();
    const npi = (input.npi ?? "").replace(/\D/g, "");
    const name = [input.firstName, input.lastName].filter(Boolean).join(" ");

    if (!apiKey) {
      return {
        provider: this.id,
        verificationType: "sam_exclusion",
        sourceName: this.sourceName,
        sourceUrl: "https://sam.gov/content/exclusions",
        sourceMode: this.sourceMode,
        status: "human_review",
        resultSummary:
          "SAM.gov Exclusions API key not configured (set SAM_API_KEY). Create a free key at sam.gov to enable live federal debarment screening.",
        matchedFields: [],
        unmatchedFields: [],
        normalizedResult: {
          source: "SAM.gov",
          mode: "live",
          status: "NOT_CONFIGURED",
        },
        retrievedAt,
        verifiedBy: "SAMExclusionsProvider",
      };
    }

    try {
      const params = new URLSearchParams({
        api_key: apiKey,
        page: "0",
        size: "10",
      });
      if (npi.length === 10) {
        params.set("npi", npi);
      } else if (name) {
        params.set("exclusionName", name);
      } else {
        return {
          provider: this.id,
          verificationType: "sam_exclusion",
          sourceName: this.sourceName,
          sourceUrl: "https://sam.gov/content/exclusions",
          sourceMode: this.sourceMode,
          status: "human_review",
          resultSummary:
            "SAM.gov check needs an NPI or provider name to search exclusions.",
          matchedFields: [],
          unmatchedFields: [],
          normalizedResult: { source: "SAM.gov", status: "MISSING_INPUT" },
          retrievedAt,
          verifiedBy: "SAMExclusionsProvider",
        };
      }

      const res = await fetch(`${SAM_EXCLUSIONS_URL}?${params.toString()}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`SAM API ${res.status}: ${text.slice(0, 200)}`);
      }

      const json = (await res.json()) as {
        totalRecords?: number;
        embedded?: { exclusionList?: SamExclusion[] };
        _embedded?: { exclusionList?: SamExclusion[] };
        exclusionList?: SamExclusion[];
      };

      const hits =
        json.embedded?.exclusionList ??
        json._embedded?.exclusionList ??
        json.exclusionList ??
        [];
      const total = json.totalRecords ?? hits.length;

      if (total > 0 && hits.length > 0) {
        const hit = hits[0];
        return {
          provider: this.id,
          verificationType: "sam_exclusion",
          sourceName: this.sourceName,
          sourceUrl: "https://sam.gov/content/exclusions",
          sourceMode: this.sourceMode,
          status: "exception",
          resultSummary: `SAM.gov exclusion HIT: ${hit.exclusionName || name || npi} (${hit.exclusionType || hit.classificationType || "exclusion"}). Confirm identity before proceeding.`,
          matchedFields: [],
          unmatchedFields: [
            {
              field: "exclusion_status",
              submitted: "none",
              source: "excluded",
              match: false,
            },
          ],
          normalizedResult: {
            source: "SAM.gov",
            mode: "live",
            status: "HIT",
            totalRecords: total,
            hit,
          },
          rawResponse: json,
          retrievedAt,
          verifiedBy: "SAMExclusionsProvider",
        };
      }

      return {
        provider: this.id,
        verificationType: "sam_exclusion",
        sourceName: this.sourceName,
        sourceUrl: "https://sam.gov/content/exclusions",
        sourceMode: this.sourceMode,
        status: "clear",
        resultSummary: `No active SAM.gov exclusion found for ${npi || name || "provider"}.`,
        matchedFields: [
          {
            field: "exclusion_status",
            submitted: "none",
            source: "clear",
            match: true,
          },
        ],
        unmatchedFields: [],
        normalizedResult: {
          source: "SAM.gov",
          mode: "live",
          status: "CLEAR",
          totalRecords: total,
          npi: npi || null,
        },
        rawResponse: json,
        retrievedAt,
        verifiedBy: "SAMExclusionsProvider",
      };
    } catch (e) {
      return {
        provider: this.id,
        verificationType: "sam_exclusion",
        sourceName: this.sourceName,
        sourceUrl: "https://open.gsa.gov/api/exclusions-api/",
        sourceMode: this.sourceMode,
        status: "failed",
        resultSummary: `SAM.gov live check failed: ${e instanceof Error ? e.message : String(e)}`,
        matchedFields: [],
        unmatchedFields: [],
        normalizedResult: { source: "SAM.gov", mode: "live", error: true },
        retrievedAt,
        verifiedBy: "SAMExclusionsProvider",
      };
    }
  }
}
