import type { FieldMatch, PSVRequest, PSVResult } from "@/types/psv";
import type { PSVProvider } from "@/lib/psv/types";

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
 * Florida license adapter — POC / simulated source.
 * Clearly labeled; does not scrape MQA and does not fabricate LIVE verification.
 *
 * Uses deterministic demo fixtures for known POC NPIs / licenses only.
 */
const DEMO_LICENSES: Record<
  string,
  {
    providerName: string;
    licenseNumber: string;
    profession: string;
    status: string;
    issueDate: string;
    expirationDate: string;
    discipline: string | null;
  }
> = {
  // Match demo: Jane Smith
  "1780347815": {
    providerName: "JANE SMITH",
    licenseNumber: "SZ10229",
    profession: "Speech-Language Pathologist",
    status: "Active",
    issueDate: "2021-10-15",
    expirationDate: "2027-12-31",
    discipline: null,
  },
  // Explicit mismatch fixture keyed by license number
  SZ99999: {
    providerName: "JANE A SMYTH",
    licenseNumber: "SZ99999",
    profession: "Medical Doctor",
    status: "Active",
    issueDate: "2020-01-01",
    expirationDate: "2026-12-31",
    discipline: null,
  },
};

export class FloridaLicenseProvider implements PSVProvider {
  readonly id = "florida_license";
  readonly sourceName = "Florida Licensing Source (POC)";
  readonly sourceMode = "poc" as const;

  async verify(input: PSVRequest): Promise<PSVResult> {
    const retrievedAt = new Date().toISOString();
    const npi = (input.npi ?? "").replace(/\D/g, "");
    const licenseKey = norm(input.licenseNumber);
    // Prefer explicit license fixture (e.g. SZ99999 mismatch demo) over NPI fixture
    const fixture =
      (licenseKey ? DEMO_LICENSES[licenseKey] : undefined) ??
      DEMO_LICENSES[npi];

    if (!fixture) {
      return {
        provider: this.id,
        verificationType: "state_license_verification",
        sourceName: this.sourceName,
        sourceUrl: "https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders",
        sourceMode: this.sourceMode,
        status: "human_review",
        resultSummary:
          "POC adapter: no fixture for this license. Human confirmation required against Florida MQA. Not a live primary-source call.",
        matchedFields: [],
        unmatchedFields: [
          {
            field: "license_number",
            submitted: input.licenseNumber,
            source: null,
            match: false,
          },
        ],
        normalizedResult: {
          source: "Florida Licensing Source",
          mode: "POC",
          note: "No live programmatic Florida license API used in this POC.",
        },
        retrievedAt,
        verifiedBy: "FloridaLicenseProvider (POC)",
      };
    }

    const submittedName = [input.firstName, input.middleName, input.lastName]
      .filter(Boolean)
      .join(" ");

    const matched: FieldMatch[] = [];
    const unmatched: FieldMatch[] = [];

    const nameField: FieldMatch = {
      field: "provider_name",
      submitted: submittedName,
      source: fixture.providerName,
      match: nameMatch(submittedName, fixture.providerName),
    };
    (nameField.match ? matched : unmatched).push(nameField);

    const licenseField: FieldMatch = {
      field: "license_number",
      submitted: input.licenseNumber,
      source: fixture.licenseNumber,
      match: norm(input.licenseNumber) === norm(fixture.licenseNumber),
    };
    (licenseField.match ? matched : unmatched).push(licenseField);

    const stateField: FieldMatch = {
      field: "license_state",
      submitted: input.licenseState ?? "FL",
      source: "FL",
      match: norm(input.licenseState ?? "FL") === "FL",
    };
    (stateField.match ? matched : unmatched).push(stateField);

    const status =
      !nameField.match || !licenseField.match
        ? "human_review"
        : fixture.status.toLowerCase() === "active"
          ? "verified"
          : "exception";

    return {
      provider: this.id,
      verificationType: "state_license_verification",
      sourceName: this.sourceName,
      sourceUrl: "https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders",
      sourceMode: this.sourceMode,
      status,
      resultSummary: nameField.match
        ? `POC VERIFICATION: Florida license ${fixture.licenseNumber} marked ${fixture.status} for ${fixture.providerName}.`
        : `POC VERIFICATION: identity discrepancy — submitted "${submittedName}" vs source "${fixture.providerName}". Human review required.`,
      matchedFields: matched,
      unmatchedFields: unmatched,
      normalizedResult: {
        source: "Florida Licensing Source",
        mode: "POC",
        verification_type: "STATE_LICENSE",
        license_number: fixture.licenseNumber,
        provider_name: fixture.providerName,
        profession: fixture.profession,
        status: fixture.status,
        issue_date: fixture.issueDate,
        expiration_date: fixture.expirationDate,
        discipline: fixture.discipline,
        retrieved_at: retrievedAt,
        label: "POC / SIMULATED SOURCE",
      },
      rawResponse: { fixture, note: "POC fixture — not a live MQA response" },
      retrievedAt,
      verifiedBy: "FloridaLicenseProvider (POC)",
    };
  }
}
