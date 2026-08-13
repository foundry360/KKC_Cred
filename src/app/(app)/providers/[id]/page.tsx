import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  getProvider,
  listCredentialsForProvider,
  listSanctionsForProvider,
} from "@/lib/providers";

type Params = Promise<{ id: string }>;

export default async function ProviderDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const provider = await getProvider(id);
  if (!provider) notFound();

  const [credentials, sanctions] = await Promise.all([
    listCredentialsForProvider(provider.id),
    listSanctionsForProvider(provider.id),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/providers"
          className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
        >
          ← Providers
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {provider.displayName}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {provider.externalId}
              {provider.npi ? ` · NPI ${provider.npi}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <StatusBadge value={provider.subjectType} />
            <StatusBadge value={provider.status} />
          </div>
        </div>
      </div>

      <section className="grid gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field
          label="Organization"
          value={provider.organizationName ?? "—"}
        />
        <Field
          label={provider.subjectType === "facility" ? "Facility type" : "Specialty"}
          value={
            provider.subjectType === "facility"
              ? (provider.facilityType ?? "—")
              : (provider.specialty ?? "—")
          }
        />
        <Field label="Recred due" value={provider.recredDueDate ?? "—"} />
        <Field label="Cred start" value={provider.credStartDate ?? "—"} />
        <Field label="Cred end" value={provider.credEndDate ?? "—"} />
        <Field label="Email" value={provider.email ?? "—"} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Credentials</h2>
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-black/[0.02] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Issuer</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[var(--line)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium capitalize">
                      {(c.name ?? c.type).replaceAll("_", " ")}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {c.type.replaceAll("_", " ")}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {c.number ?? "—"}
                  </td>
                  <td className="px-4 py-3">{c.issuingAuthority ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.expiresAt ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={c.status} />
                  </td>
                </tr>
              ))}
              {credentials.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[var(--muted)]"
                  >
                    No credentials.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sanctions monitoring</h2>
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-black/[0.02] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Checked</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {sanctions.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[var(--line)] last:border-0"
                >
                  <td className="px-4 py-3">{s.source ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {s.checkedAt ?? "—"}
                  </td>
                  <td className="px-4 py-3">{s.result ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {s.notes ?? "—"}
                  </td>
                </tr>
              ))}
              {sanctions.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-[var(--muted)]"
                  >
                    No sanctions checks.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
