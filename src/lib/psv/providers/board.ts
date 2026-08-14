import type { PSVRequest, PSVResult } from "@/types/psv";
import type { PSVProvider } from "@/lib/psv/types";

/**
 * Board certification — POC adapter only.
 * Always requires human confirmation; never claims live primary-source verified.
 */
export class BoardCertificationProvider implements PSVProvider {
  readonly id = "board_certification";
  readonly sourceName = "Board Certification (POC)";
  readonly sourceMode = "poc" as const;

  async verify(input: PSVRequest): Promise<PSVResult> {
    const retrievedAt = new Date().toISOString();
    return {
      provider: this.id,
      verificationType: "board_certification",
      sourceName: this.sourceName,
      sourceMode: this.sourceMode,
      status: "human_review",
      resultSummary:
        "BOARD CERTIFICATION — POC VERIFICATION. Human confirmation required. Not primary-source verified.",
      matchedFields: [],
      unmatchedFields: [
        {
          field: "board_certification",
          submitted: input.specialty,
          source: null,
          match: false,
        },
      ],
      normalizedResult: {
        source: "Board Certification",
        mode: "POC",
        status: "HUMAN_REVIEW",
        specialty: input.specialty,
        retrieved_at: retrievedAt,
        label: "POC / SIMULATED SOURCE",
      },
      rawResponse: { mode: "poc" },
      retrievedAt,
      verifiedBy: "BoardCertificationProvider (POC)",
    };
  }
}
