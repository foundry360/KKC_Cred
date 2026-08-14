import type { PSVRequest, PSVResult } from "@/types/psv";
import type { PSVProvider } from "@/lib/psv/types";

/**
 * OIG LEIE exclusion check — POC adapter (clearly labeled).
 * Live LEIE downloadable dataset integration can replace this later.
 */
export class OIGProvider implements PSVProvider {
  readonly id = "oig_leie";
  readonly sourceName = "OIG LEIE (POC)";
  readonly sourceMode = "poc" as const;

  async verify(input: PSVRequest): Promise<PSVResult> {
    const retrievedAt = new Date().toISOString();
    const name = [input.firstName, input.lastName].filter(Boolean).join(" ");

    // Deterministic: names containing "EXCLUDED" fail; otherwise CLEAR for POC.
    const forcedHit = /excluded/i.test(name);

    return {
      provider: this.id,
      verificationType: "oig_exclusion",
      sourceName: this.sourceName,
      sourceUrl: "https://oig.hhs.gov/exclusions/exclusions_list.asp",
      sourceMode: this.sourceMode,
      status: forcedHit ? "exception" : "clear",
      resultSummary: forcedHit
        ? `POC VERIFICATION: potential OIG exclusion hit for ${name}. Human review required.`
        : `POC VERIFICATION: OIG exclusion check CLEAR for ${name || "practitioner"}.`,
      matchedFields: forcedHit
        ? []
        : [
            {
              field: "exclusion_status",
              submitted: "none",
              source: "clear",
              match: true,
            },
          ],
      unmatchedFields: forcedHit
        ? [
            {
              field: "exclusion_status",
              submitted: "none",
              source: "excluded",
              match: false,
            },
          ]
        : [],
      normalizedResult: {
        source: "OIG LEIE",
        mode: "POC",
        status: forcedHit ? "HIT" : "CLEAR",
        retrieved_at: retrievedAt,
        label: "POC / SIMULATED SOURCE",
        npi: input.npi,
      },
      rawResponse: { mode: "poc", forcedHit },
      retrievedAt,
      verifiedBy: "OIGProvider (POC)",
    };
  }
}
