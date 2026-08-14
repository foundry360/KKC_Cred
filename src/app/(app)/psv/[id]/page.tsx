"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Dashboard = {
  application: {
    id: string;
    external_id: string;
    status: string;
    profession: string | null;
    license_number: string | null;
    license_state: string | null;
    psv_status: string | null;
    readiness_score: number | null;
    providers:
      | {
          display_name: string;
          npi: string | null;
          first_name: string | null;
          last_name: string | null;
          specialty: string | null;
        }
      | {
          display_name: string;
          npi: string | null;
          first_name: string | null;
          last_name: string | null;
          specialty: string | null;
        }[]
      | null;
  };
  requirements: Array<{
    id: string;
    label: string;
    requirement_type: string;
    status: string;
    verification_method: string | null;
    required: boolean;
  }>;
  verifications: Array<{
    id: string;
    source_name: string;
    source_mode: "live" | "poc";
    status: string;
    result_summary: string;
    retrieved_at: string | null;
    verification_type: string;
  }>;
  exceptions: Array<{
    id: string;
    exception_type: string;
    severity: string;
    description: string;
    source: string | null;
    status: string;
  }>;
  evidence: Array<{
    id: string;
    source_name: string;
    verification_method: string;
    result: string | null;
    request_timestamp: string;
    raw_response_reference: string | null;
  }>;
  readiness: {
    score: number;
    verified: number;
    pending: number;
    exceptions: number;
    humanReview: number;
    overallStatus: string;
    label: string;
    disclaimer: string;
  };
};

function providerOf(dash: Dashboard) {
  const p = dash.application.providers;
  return Array.isArray(p) ? p[0] : p;
}

function StatusPill({
  status,
  mode,
}: {
  status: string;
  mode?: "live" | "poc";
}) {
  const s = status.toLowerCase();
  let cls = "bg-slate-100 text-slate-800";
  if (["verified", "clear"].includes(s)) cls = "bg-emerald-100 text-emerald-900";
  else if (["human_review", "pending", "pending_verification"].includes(s))
    cls = "bg-amber-100 text-amber-950";
  else if (["exception", "failed", "not_verified"].includes(s))
    cls = "bg-red-100 text-red-900";

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${cls}`}
      >
        {status.replaceAll("_", " ")}
      </span>
      {mode && (
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            mode === "live"
              ? "bg-sky-100 text-sky-900"
              : "bg-violet-100 text-violet-900"
          }`}
        >
          {mode === "live" ? "LIVE PRIMARY SOURCE" : "POC / SIMULATED SOURCE"}
        </span>
      )}
    </span>
  );
}

export default function PsvCasePage() {
  const params = useParams<{ id: string }>();
  const applicationId = params.id;
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/psv?applicationId=${applicationId}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load");
    setDash(json);
  }, [applicationId]);

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load"),
    );
  }, [load]);

  async function runPsv() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/psv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, action: "run_psv" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "PSV run failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "PSV run failed");
    } finally {
      setRunning(false);
    }
  }

  if (!dash && !error) {
    return <p className="text-sm text-[var(--muted)]">Loading PSV case…</p>;
  }

  if (error && !dash) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {error}
      </p>
    );
  }

  if (!dash) return null;

  const provider = providerOf(dash);
  const score = dash.readiness.score;
  const barWidth = Math.max(0, Math.min(100, score));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/psv"
            className="text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
          >
            ← PSV cases
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Primary Source Verification
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {provider?.display_name}
            {provider?.specialty ? `, ${provider.specialty}` : ""} · Case{" "}
            {dash.application.external_id}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runPsv()}
          disabled={running}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {running ? "Running PSV…" : "Run PSV pipeline"}
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {dash.readiness.label}
          </h2>
          <p className="mt-3 text-5xl font-semibold tabular-nums tracking-tight">
            {score}%
          </p>
          <div className="mt-4 h-3 overflow-hidden rounded bg-black/5">
            <div
              className="h-full rounded bg-[var(--accent)] transition-all"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-[var(--muted)]">Verified</div>
              <div className="text-lg font-semibold">{dash.readiness.verified}</div>
            </div>
            <div>
              <div className="text-[var(--muted)]">Pending</div>
              <div className="text-lg font-semibold">{dash.readiness.pending}</div>
            </div>
            <div>
              <div className="text-[var(--muted)]">Exceptions</div>
              <div className="text-lg font-semibold">
                {dash.readiness.exceptions}
              </div>
            </div>
            <div>
              <div className="text-[var(--muted)]">Human review</div>
              <div className="text-lg font-semibold">
                {dash.readiness.humanReview}
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-[var(--muted)]">
            {dash.readiness.disclaimer}
          </p>
          <div className="mt-3">
            <StatusPill status={dash.readiness.overallStatus} />
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Applicant submission
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">NPI</dt>
              <dd className="font-medium">{provider?.npi ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Name</dt>
              <dd className="font-medium">
                {[provider?.first_name, provider?.last_name]
                  .filter(Boolean)
                  .join(" ") || provider?.display_name}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Profession</dt>
              <dd className="font-medium">
                {dash.application.profession ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">License</dt>
              <dd className="font-medium">
                {dash.application.license_number ?? "—"} /{" "}
                {dash.application.license_state ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Verification results
        </h2>
        <div className="mt-4 space-y-4">
          {dash.verifications.length === 0 && (
            <p className="text-sm text-[var(--muted)]">
              No verifications yet. Run the PSV pipeline.
            </p>
          )}
          {dash.verifications.map((v) => (
            <div
              key={v.id}
              className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{v.source_name}</div>
                <StatusPill status={v.status} mode={v.source_mode} />
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {v.result_summary}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Retrieved{" "}
                {v.retrieved_at
                  ? new Date(v.retrieved_at).toLocaleString()
                  : "—"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Requirements
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {dash.requirements.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] py-2 last:border-0"
              >
                <span>
                  {r.label}
                  {!r.required && (
                    <span className="ml-2 text-xs text-[var(--muted)]">
                      optional
                    </span>
                  )}
                </span>
                <StatusPill
                  status={r.status}
                  mode={
                    r.verification_method === "live"
                      ? "live"
                      : r.verification_method === "poc"
                        ? "poc"
                        : undefined
                  }
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Exceptions
          </h2>
          <ul className="mt-3 space-y-3 text-sm">
            {dash.exceptions.length === 0 && (
              <li className="text-[var(--muted)]">No open exceptions.</li>
            )}
            {dash.exceptions.map((e) => (
              <li key={e.id} className="rounded border border-[var(--line)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={e.severity} />
                  <span className="text-xs uppercase text-[var(--muted)]">
                    {e.exception_type.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2">{e.description}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Source: {e.source ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Audit / evidence trail
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          What we checked · where · when · what the source returned · what we
          compared · system determination
        </p>
        <ul className="mt-4 space-y-3 text-sm">
          {dash.evidence.length === 0 && (
            <li className="text-[var(--muted)]">No evidence records yet.</li>
          )}
          {dash.evidence.map((e) => (
            <li
              key={e.id}
              className="border-b border-[var(--line)] pb-3 last:border-0"
            >
              <div className="font-medium">{e.source_name}</div>
              <p className="mt-1 text-[var(--muted)]">{e.result}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {new Date(e.request_timestamp).toLocaleString()} · method{" "}
                {e.verification_method.toUpperCase()}
                {e.raw_response_reference
                  ? ` · ref ${e.raw_response_reference}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
