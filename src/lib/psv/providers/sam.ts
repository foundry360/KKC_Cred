import type { PSVRequest, PSVResult } from "@/types/psv";
import type { PSVProvider } from "@/lib/psv/types";

const SAM_EXCLUSIONS_URL =
  "https://api.sam.gov/entity-information/v4/exclusions";

type SamExcludedEntity = {
  exclusionDetails?: {
    classificationType?: string;
    exclusionType?: string;
    exclusionProgram?: string;
    excludingAgencyCode?: string;
    excludingAgencyName?: string;
  };
  exclusionIdentification?: {
    ueiSAM?: string | null;
    cageCode?: string | null;
    npi?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    entityName?: string | null;
  };
  exclusionActions?: {
    listOfActions?: Array<{
      activateDate?: string;
      terminationDate?: string;
      recordStatus?: string;
    }>;
  };
};

function stripApiKeyFromJson(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/([?&]api_key=)[^&"'\s]+/gi, "$1REDACTED");
  }
  if (Array.isArray(value)) {
    return value.map(stripApiKeyFromJson);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripApiKeyFromJson(v);
    }
    return out;
  }
  return value;
}

function namesMatch(
  inputFirst: string | undefined,
  inputLast: string | undefined,
  hit: SamExcludedEntity,
): boolean {
  const id = hit.exclusionIdentification ?? {};
  const last = (id.lastName ?? "").trim().toLowerCase();
  const first = (id.firstName ?? "").trim().toLowerCase();
  const wantLast = (inputLast ?? "").trim().toLowerCase();
  const wantFirst = (inputFirst ?? "").trim().toLowerCase();
  if (!wantLast || !last || last !== wantLast) return false;
  if (!wantFirst) return true;
  return first === wantFirst || first.startsWith(wantFirst) || wantFirst.startsWith(first);
}

/**
 * LIVE: GSA SAM.gov Exclusions API (federal debarment / suspension).
 * Requires free SAM.gov API key: https://sam.gov → Account → API Key.
 *
 * Note: SAM masks NPI in public data, so individual screening uses exclusionName.
 * Accept must be application/hal+json (application/json returns HTTP 406).
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

    if (!name) {
      return {
        provider: this.id,
        verificationType: "sam_exclusion",
        sourceName: this.sourceName,
        sourceUrl: "https://sam.gov/content/exclusions",
        sourceMode: this.sourceMode,
        status: "human_review",
        resultSummary:
          "SAM.gov check needs a provider name (NPI alone is masked in public SAM data).",
        matchedFields: [],
        unmatchedFields: [],
        normalizedResult: { source: "SAM.gov", status: "MISSING_INPUT" },
        retrievedAt,
        verifiedBy: "SAMExclusionsProvider",
      };
    }

    try {
      const params = new URLSearchParams({
        api_key: apiKey,
        exclusionName: name,
        page: "0",
        size: "10",
        includeSections:
          "exclusionDetails,exclusionIdentification,exclusionActions",
      });

      const res = await fetch(`${SAM_EXCLUSIONS_URL}?${params.toString()}`, {
        headers: { Accept: "application/hal+json" },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 429) {
          throw new Error(
            `SAM API daily quota exceeded (personal keys are limited). Retry after UTC midnight. Details: ${text.slice(0, 160)}`,
          );
        }
        throw new Error(`SAM API ${res.status}: ${text.slice(0, 200)}`);
      }

      const json = (await res.json()) as {
        totalRecords?: number;
        excludedEntity?: SamExcludedEntity[];
      };

      const safeJson = stripApiKeyFromJson(json);
      const allHits = json.excludedEntity ?? [];
      const hits = allHits.filter((h) =>
        namesMatch(input.firstName, input.lastName, h),
      );
      const total = hits.length;

      if (total > 0) {
        const hit = hits[0];
        const id = hit.exclusionIdentification ?? {};
        const details = hit.exclusionDetails ?? {};
        const displayName =
          id.entityName ||
          [id.firstName, id.lastName].filter(Boolean).join(" ") ||
          name;
        return {
          provider: this.id,
          verificationType: "sam_exclusion",
          sourceName: this.sourceName,
          sourceUrl: "https://sam.gov/content/exclusions",
          sourceMode: this.sourceMode,
          status: "exception",
          resultSummary: `SAM.gov exclusion HIT: ${displayName} (${details.exclusionType || details.classificationType || "exclusion"}). Confirm identity before proceeding.`,
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
            hit: {
              entityName: displayName,
              classificationType: details.classificationType,
              exclusionType: details.exclusionType,
              excludingAgencyCode: details.excludingAgencyCode,
              npi: id.npi,
            },
          },
          rawResponse: safeJson,
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
        resultSummary: `No active SAM.gov exclusion found for ${name}${npi ? ` (NPI ${npi})` : ""}.`,
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
          candidateMatches: allHits.length,
          npi: npi || null,
        },
        rawResponse: safeJson,
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
