import type { PSVRequest, PSVResult } from "@/types/psv";
import type { PSVProvider } from "@/lib/psv/types";

/**
 * DEA verification — POC adapter (applicable when DEA doc/number present).
 */
export class DEAProvider implements PSVProvider {
  readonly id = "dea";
  readonly sourceName = "DEA (POC)";
  readonly sourceMode = "poc" as const;

  async verify(input: PSVRequest): Promise<PSVResult> {
    const retrievedAt = new Date().toISOString();
    return {
      provider: this.id,
      verificationType: "dea_verification",
      sourceName: this.sourceName,
      sourceMode: this.sourceMode,
      status: "human_review",
      resultSummary:
        "DEA — POC VERIFICATION. Human confirmation required. Not primary-source verified.",
      matchedFields: [],
      unmatchedFields: [
        {
          field: "dea",
          submitted: input.npi,
          source: null,
          match: false,
        },
      ],
      normalizedResult: {
        source: "DEA",
        mode: "POC",
        status: "HUMAN_REVIEW",
        retrieved_at: retrievedAt,
        label: "POC / SIMULATED SOURCE",
      },
      rawResponse: { mode: "poc" },
      retrievedAt,
      verifiedBy: "DEAProvider (POC)",
    };
  }
}
