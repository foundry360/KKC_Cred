import type { FieldMatch, PSVRequest, PSVResult } from "@/types/psv";
import type { PSVProvider } from "@/lib/psv/types";
import { parseCsv, rowToObject } from "@/lib/psv/csv";
import { readCachedFile, writeCachedFile } from "@/lib/psv/cache";

const LEIE_URL = "https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv";
const CACHE_NAME = "oig-leie-updated.csv";
/** LEIE updates monthly; refresh cache at least weekly. */
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type LeieRecord = {
  lastName: string;
  firstName: string;
  midName: string;
  busName: string;
  npi: string;
  general: string;
  specialty: string;
  exclType: string;
  exclDate: string;
  city: string;
  state: string;
};

type LeieIndex = {
  loadedAt: number;
  byNpi: Map<string, LeieRecord[]>;
  byName: Map<string, LeieRecord[]>;
  recordCount: number;
};

let memoryIndex: LeieIndex | null = null;

function norm(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function nameKey(last?: string | null, first?: string | null): string {
  return `${norm(last)}|${norm(first)}`;
}

function toRecord(row: Record<string, string>): LeieRecord {
  return {
    lastName: row.LASTNAME ?? "",
    firstName: row.FIRSTNAME ?? "",
    midName: row.MIDNAME ?? "",
    busName: row.BUSNAME ?? "",
    npi: (row.NPI ?? "").replace(/\D/g, ""),
    general: row.GENERAL ?? "",
    specialty: row.SPECIALTY ?? "",
    exclType: row.EXCLTYPE ?? "",
    exclDate: row.EXCLDATE ?? "",
    city: row.CITY ?? "",
    state: row.STATE ?? "",
  };
}

async function loadLeieText(): Promise<string> {
  const override = process.env.PSV_LEIE_PATH;
  if (override) {
    const { readFile } = await import("node:fs/promises");
    return readFile(override, "utf8");
  }

  const cached = await readCachedFile(CACHE_NAME, CACHE_MAX_AGE_MS);
  if (cached) return cached.toString("utf8");

  const res = await fetch(LEIE_URL, {
    headers: { Accept: "text/csv" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`OIG LEIE download failed (${res.status})`);
  }
  const text = await res.text();
  await writeCachedFile(CACHE_NAME, text);
  return text;
}

async function getIndex(): Promise<LeieIndex> {
  if (memoryIndex && Date.now() - memoryIndex.loadedAt < CACHE_MAX_AGE_MS) {
    return memoryIndex;
  }

  const text = await loadLeieText();
  const { headers, rows } = parseCsv(text);
  const byNpi = new Map<string, LeieRecord[]>();
  const byName = new Map<string, LeieRecord[]>();

  for (const row of rows) {
    const rec = toRecord(rowToObject(headers, row));
    if (rec.npi && rec.npi !== "0000000000") {
      const list = byNpi.get(rec.npi) ?? [];
      list.push(rec);
      byNpi.set(rec.npi, list);
    }
    if (rec.lastName && rec.firstName) {
      const key = nameKey(rec.lastName, rec.firstName);
      const list = byName.get(key) ?? [];
      list.push(rec);
      byName.set(key, list);
    }
  }

  memoryIndex = {
    loadedAt: Date.now(),
    byNpi,
    byName,
    recordCount: rows.length,
  };
  return memoryIndex;
}

function formatHit(rec: LeieRecord): string {
  const who =
    rec.busName ||
    [rec.firstName, rec.midName, rec.lastName].filter(Boolean).join(" ");
  return `${who} — ${rec.exclType || "exclusion"} (${rec.exclDate || "n/a"}) ${rec.city || ""} ${rec.state || ""}`.trim();
}

/**
 * LIVE primary source: HHS OIG LEIE downloadable database.
 * Name matches require SSN confirmation on OIG's site (Privacy Act).
 */
export class OIGProvider implements PSVProvider {
  readonly id = "oig_leie";
  readonly sourceName = "HHS OIG LEIE";
  readonly sourceMode = "live" as const;

  async verify(input: PSVRequest): Promise<PSVResult> {
    const retrievedAt = new Date().toISOString();
    const npi = (input.npi ?? "").replace(/\D/g, "");
    const first = input.firstName;
    const last = input.lastName;

    try {
      const index = await getIndex();
      const npiHits = npi && npi.length === 10 ? index.byNpi.get(npi) ?? [] : [];
      const nameHits =
        first && last ? index.byName.get(nameKey(last, first)) ?? [] : [];

      if (npiHits.length > 0) {
        const matched: FieldMatch[] = [
          {
            field: "npi",
            submitted: npi,
            source: npiHits[0].npi,
            match: true,
          },
          {
            field: "exclusion_status",
            submitted: "none",
            source: "excluded",
            match: false,
          },
        ];
        return {
          provider: this.id,
          verificationType: "oig_exclusion",
          sourceName: this.sourceName,
          sourceUrl: "https://oig.hhs.gov/exclusions/exclusions_list.asp",
          sourceMode: this.sourceMode,
          status: "exception",
          resultSummary: `OIG LEIE HIT by NPI: ${formatHit(npiHits[0])}. Do not bill federal programs; confirm identity.`,
          matchedFields: matched.filter((m) => m.match),
          unmatchedFields: matched.filter((m) => !m.match),
          normalizedResult: {
            source: "OIG LEIE",
            mode: "live",
            status: "HIT",
            match_method: "npi",
            hits: npiHits.slice(0, 5),
            leie_records: index.recordCount,
          },
          rawResponse: { hits: npiHits.slice(0, 5) },
          retrievedAt,
          verifiedBy: "OIGProvider (LEIE CSV)",
        };
      }

      if (nameHits.length > 0) {
        return {
          provider: this.id,
          verificationType: "oig_exclusion",
          sourceName: this.sourceName,
          sourceUrl: "https://oig.hhs.gov/exclusions/exclusions_list.asp",
          sourceMode: this.sourceMode,
          status: "human_review",
          resultSummary: `Possible OIG LEIE name match (${nameHits.length}): ${formatHit(nameHits[0])}. Confirm identity with SSN on OIG Online Search (Privacy Act — CSV has no SSN).`,
          matchedFields: [],
          unmatchedFields: [
            {
              field: "exclusion_status",
              submitted: "none",
              source: "possible_hit",
              match: false,
            },
          ],
          normalizedResult: {
            source: "OIG LEIE",
            mode: "live",
            status: "POSSIBLE_HIT",
            match_method: "name",
            hits: nameHits.slice(0, 5),
            leie_records: index.recordCount,
            note: "Name match is not identity confirmation without SSN verification on OIG site.",
          },
          rawResponse: { hits: nameHits.slice(0, 5) },
          retrievedAt,
          verifiedBy: "OIGProvider (LEIE CSV)",
        };
      }

      return {
        provider: this.id,
        verificationType: "oig_exclusion",
        sourceName: this.sourceName,
        sourceUrl: "https://oig.hhs.gov/exclusions/exclusions_list.asp",
        sourceMode: this.sourceMode,
        status: "clear",
        resultSummary: `No OIG LEIE match for NPI ${npi || "—"} / ${[first, last].filter(Boolean).join(" ") || "name"}. Screened against ${index.recordCount.toLocaleString()} active exclusions.`,
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
          source: "OIG LEIE",
          mode: "live",
          status: "CLEAR",
          leie_records: index.recordCount,
          npi: npi || null,
        },
        rawResponse: { clear: true, recordCount: index.recordCount },
        retrievedAt,
        verifiedBy: "OIGProvider (LEIE CSV)",
      };
    } catch (e) {
      return {
        provider: this.id,
        verificationType: "oig_exclusion",
        sourceName: this.sourceName,
        sourceUrl: LEIE_URL,
        sourceMode: this.sourceMode,
        status: "failed",
        resultSummary: `OIG LEIE live check failed: ${e instanceof Error ? e.message : String(e)}`,
        matchedFields: [],
        unmatchedFields: [],
        normalizedResult: { source: "OIG LEIE", mode: "live", error: true },
        retrievedAt,
        verifiedBy: "OIGProvider (LEIE CSV)",
      };
    }
  }
}
