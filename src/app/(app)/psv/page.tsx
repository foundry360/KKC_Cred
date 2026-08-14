"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type AppRow = {
  id: string;
  external_id: string;
  status: string;
  psv_status: string | null;
  readiness_score: number | null;
  psv_ran_at: string | null;
  profession: string | null;
  license_state: string | null;
  providers:
    | { display_name: string; npi: string | null }
    | { display_name: string; npi: string | null }[]
    | null;
};

function providerLabel(row: AppRow): string {
  const p = Array.isArray(row.providers) ? row.providers[0] : row.providers;
  return p?.display_name ?? "Unknown provider";
}

export default function PsvIndexPage() {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/psv", { method: "PUT" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setRows(json.applications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Primary Source Verification
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Collect once. Verify automatically where possible. Reconcile
          intelligently. Escalate exceptions. Keep humans in control.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          LIVE = authorized public/official source · POC = simulated adapter ·
          HUMAN REVIEW = staff confirmation required
        </p>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-black/[0.02] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">PSV status</th>
              <th className="px-4 py-3">Readiness</th>
              <th className="px-4 py-3">Last run</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--line)] last:border-0"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/psv/${row.id}`}
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    {row.external_id}
                  </Link>
                </td>
                <td className="px-4 py-3">{providerLabel(row)}</td>
                <td className="px-4 py-3">
                  {row.psv_status ?? "not_started"}
                </td>
                <td className="px-4 py-3">
                  {row.readiness_score != null
                    ? `${row.readiness_score}%`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {row.psv_ran_at
                    ? new Date(row.psv_ran_at).toLocaleString()
                    : "—"}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[var(--muted)]"
                >
                  No applications yet. Run{" "}
                  <code className="text-xs">npm run seed:psv-demo</code> or
                  submit portal intake.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
