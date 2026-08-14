export type CredAssistMode = "blockers" | "chase_draft" | "packet_summary";

export type CredAssistInput = {
  mode?: CredAssistMode;
  application: {
    id?: string;
    name?: string;
    externalId?: string;
    status?: string;
    applicationType?: string;
    path?: string;
    subjectType?: string;
    attemptCount?: number;
    dueDate?: string | null;
  };
  provider: {
    id?: string;
    name?: string;
    externalId?: string;
    npi?: string | null;
    subjectType?: string;
    specialty?: string | null;
    facilityType?: string | null;
    recredDueDate?: string | null;
  };
  checklist: Array<{
    key?: string;
    label: string;
    required?: boolean;
    complete: boolean;
  }>;
  credentials?: Array<{
    type?: string;
    name?: string;
    status?: string;
    expirationDate?: string | null;
  }>;
};

export type CredAssistResult = {
  summary: string;
  missingItems: string[];
  draftNote: string;
  nextAction: string;
  source: "claude" | "local";
  intakeSummary?: string;
  reconciledNames?: string[];
  exceptions?: string[];
};

const STYLE_RULES = `Style rules for all string values:
- Never use em dashes or en dashes. Use commas, periods, or hyphens only.
- Spell out whole numbers from zero through nine in prose (one, two, three).
- Always keep dates fully numerical (for example 2026-08-05 or August 5, 2026). Never spell out day or month numbers in dates.
- Use numerals for 10 and above, IDs, NPIs, and phone numbers.
- Use plain text only. Do not use Markdown (no **, *, #, backticks, or bullet markers).`;

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
] as const;

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";

function missingFromChecklist(input: CredAssistInput) {
  return input.checklist
    .filter((item) => !item.complete && item.required !== false)
    .map((item) => item.label);
}

function spellSmallNumber(n: number) {
  if (n >= 0 && n <= 9) return NUMBER_WORDS[n];
  return String(n);
}

/** Protect date-like spans so day numbers stay numeric. */
function protectDates(text: string): { text: string; dates: string[] } {
  const dates: string[] = [];
  const stash = (match: string) => {
    const idx = dates.length;
    dates.push(match);
    return `__DATE${idx}__`;
  };

  let out = text;
  out = out.replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, stash);
  out = out.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, stash);
  out = out.replace(
    new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, "gi"),
    stash,
  );
  out = out.replace(
    new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\s+\\d{4}\\b`, "gi"),
    stash,
  );
  return { text: out, dates };
}

function restoreDates(text: string, dates: string[]) {
  return text.replace(/__DATE(\d+)__/g, (_, i: string) => dates[Number(i)] ?? "");
}

/** Strip dashes and spell out standalone digits 0-9 in prose (never inside dates). */
export function sanitizeAssistProse(text: string): string {
  if (!text) return text;
  let out = text
    .replace(/\u2014/g, ",") // em dash
    .replace(/\u2013/g, "-") // en dash
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, "$1")
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\s*,\s*,+/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/,\s*/g, ", ")
    .replace(/[ \t]+\./g, ".")
    .replace(/ +/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

  const protectedDates = protectDates(out);
  out = protectedDates.text;

  // Spell out standalone digits 0-9 (not part of longer numbers/IDs)
  out = out.replace(/(?<![\dA-Za-z])([0-9])(?![\dA-Za-z])/g, (_, d: string) =>
    NUMBER_WORDS[Number(d)],
  );

  return restoreDates(out, protectedDates.dates);
}

function sanitizeResult(result: CredAssistResult): CredAssistResult {
  return {
    ...result,
    summary: sanitizeAssistProse(result.summary),
    draftNote: sanitizeAssistProse(result.draftNote),
    nextAction: sanitizeAssistProse(result.nextAction),
    intakeSummary: result.intakeSummary
      ? sanitizeAssistProse(result.intakeSummary)
      : result.intakeSummary,
    reconciledNames: (result.reconciledNames ?? []).map((item) =>
      sanitizeAssistProse(item),
    ),
    exceptions: (result.exceptions ?? []).map((item) =>
      sanitizeAssistProse(item),
    ),
    missingItems: result.missingItems.map((item) =>
      item.replace(/\u2014/g, ",").replace(/\u2013/g, "-"),
    ),
  };
}

export function buildLocalAssist(input: CredAssistInput): CredAssistResult {
  const missing = missingFromChecklist(input);
  const attempts = input.application.attemptCount ?? 0;
  const nextAttempt = Math.min(attempts + 1, 3);
  const providerName = input.provider.name ?? "Provider";
  const status = input.application.status ?? "Unknown";

  const summary =
    missing.length === 0
      ? `${providerName} application looks checklist-complete (status ${status}). Ready for Spec review before advancing.`
      : `${providerName} is blocked on ${spellSmallNumber(missing.length)} checklist item${missing.length === 1 ? "" : "s"} (status ${status}, attempt ${spellSmallNumber(attempts)}).`;

  const draftNote =
    missing.length === 0
      ? `Hi. Following up on the credentialing application for ${providerName}. Checklist appears complete on our side. Please confirm any outstanding attestations so we can move this to review.`
      : `Hi. This is outreach attempt ${spellSmallNumber(nextAttempt)} regarding the credentialing application for ${providerName}. We still need:\n${missing
          .map((m) => `- ${m}`)
          .join("\n")}\n\nPlease send the outstanding items by the due date so we can continue processing.`;

  const nextAction =
    missing.length === 0
      ? "Confirm completeness with Spec, then advance toward In Review."
      : attempts >= 2
        ? "Log Task for Spec; prepare TL escalation if attempt three fails."
        : `Create Spec Task for chase attempt ${spellSmallNumber(nextAttempt)} and attach this draft.`;

  return sanitizeResult({
    summary,
    missingItems: missing,
    draftNote,
    nextAction,
    source: "local",
  });
}

export async function runCredAssist(
  input: CredAssistInput,
): Promise<CredAssistResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return buildLocalAssist(input);
  }

  const mode = input.mode ?? "chase_draft";
  const local = buildLocalAssist(input);

  const system = `You are a credentialing intake and operations assistant for a healthcare payer POC.
Return ONLY valid JSON with keys: summary (string), missingItems (string[]), draftNote (string), nextAction (string), intakeSummary (string), reconciledNames (string[]), exceptions (string[]).
Do not approve, deny, change status, or send mail. Specs remain human-in-the-loop.
Intake rules:
- Name variants like "John A. Smith", "John Smith MD", and "John Andrew Smith" usually represent the SAME person. Put reconciled notes in reconciledNames; do not treat them as identity mismatches.
- Specialty conflicts across practice families (e.g. Cardiology vs Internal Medicine vs Cardiothoracic Surgery) belong in exceptions and require human review.
Be concise and operational. Draft note should be ready to paste into a Task or email.
${STYLE_RULES}`;

  const user = JSON.stringify(
    {
      mode,
      application: input.application,
      provider: input.provider,
      checklist: input.checklist,
      credentials: input.credentials ?? [],
      localHints: local,
    },
    null,
    2,
  );

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.CRED_ASSIST_MODEL || "claude-sonnet-4-5",
        max_tokens: 800,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Claude assist failed", res.status, text);
      return local;
    }

    const body = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = body.content?.find((c) => c.type === "text")?.text ?? "";
    const parsed = extractJson(text);
    if (!parsed) return local;

    return sanitizeResult({
      summary: String(parsed.summary ?? local.summary),
      missingItems: Array.isArray(parsed.missingItems)
        ? parsed.missingItems.map(String)
        : local.missingItems,
      draftNote: String(parsed.draftNote ?? local.draftNote),
      nextAction: String(parsed.nextAction ?? local.nextAction),
      intakeSummary: String(parsed.intakeSummary ?? local.intakeSummary ?? ""),
      reconciledNames: Array.isArray(parsed.reconciledNames)
        ? parsed.reconciledNames.map(String)
        : local.reconciledNames ?? [],
      exceptions: Array.isArray(parsed.exceptions)
        ? parsed.exceptions.map(String)
        : local.exceptions ?? [],
      source: "claude",
    });
  } catch (err) {
    console.error("Claude assist error", err);
    return local;
  }
}

function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<
          string,
          unknown
        >;
      } catch {
        return null;
      }
    }
    return null;
  }
}
