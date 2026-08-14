import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  getProvider,
  listAddressesForProvider,
  listCredentialsForProvider,
  listEducationForProvider,
  listSanctionsForProvider,
  listWorkHistoryForProvider,
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

  const [credentials, sanctions, education, workHistory, addresses] =
    await Promise.all([
      listCredentialsForProvider(provider.id),
      listSanctionsForProvider(provider.id),
      listEducationForProvider(provider.id),
      listWorkHistoryForProvider(provider.id),
      listAddressesForProvider(provider.id),
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
          label={
            provider.subjectType === "facility" ? "Facility type" : "Specialty"
          }
          value={
            provider.subjectType === "facility"
              ? (provider.facilityType ?? "—")
              : (provider.specialty ?? "—")
          }
        />
        <Field label="Practice state" value={provider.practiceState ?? "—"} />
        <Field label="Date of birth" value={provider.dateOfBirth ?? "—"} />
        <Field
          label="Gender"
          value={provider.gender?.replaceAll("_", " ") ?? "—"}
        />
        <Field
          label="SSN"
          value={
            provider.ssnLast4
              ? `***-**-${provider.ssnLast4.replace(/\D/g, "").slice(-4)}`
              : "—"
          }
        />
        <Field label="CAQH ID" value={provider.caqhId ?? "—"} />
        <Field
          label="Languages"
          value={provider.preferredLanguages ?? "—"}
        />
        <Field label="Birth country" value={provider.birthCountry ?? "—"} />
        <Field label="Recred due" value={provider.recredDueDate ?? "—"} />
        <Field label="Cred start" value={provider.credStartDate ?? "—"} />
        <Field label="Cred end" value={provider.credEndDate ?? "—"} />
        <Field label="Email" value={provider.email ?? "—"} />
        <Field label="Phone" value={formatPhone(provider.phone)} />
        <Field label="Mobile" value={formatPhone(provider.mobilePhone)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Addresses</h2>
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-black/[0.02] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Street</th>
                <th className="px-4 py-3 font-medium">City / State</th>
                <th className="px-4 py-3 font-medium">Postal</th>
                <th className="px-4 py-3 font-medium">Country</th>
              </tr>
            </thead>
            <tbody>
              {addresses.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-[var(--line)] last:border-0"
                >
                  <td className="px-4 py-3 capitalize">
                    {a.addressType}
                    {a.isPrimary ? (
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        Primary
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div>{a.line1}</div>
                    {a.line2 ? (
                      <div className="text-xs text-[var(--muted)]">{a.line2}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {[a.city, a.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {a.postalCode ?? "—"}
                  </td>
                  <td className="px-4 py-3">{a.country ?? "—"}</td>
                </tr>
              ))}
              {addresses.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[var(--muted)]"
                  >
                    No addresses.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
        <h2 className="text-lg font-semibold">Education</h2>
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-black/[0.02] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Institution</th>
                <th className="px-4 py-3 font-medium">Degree</th>
                <th className="px-4 py-3 font-medium">Field</th>
                <th className="px-4 py-3 font-medium">Years</th>
                <th className="px-4 py-3 font-medium">Country</th>
              </tr>
            </thead>
            <tbody>
              {education.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-[var(--line)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium">{e.institutionName}</td>
                  <td className="px-4 py-3 uppercase">{e.degreeType}</td>
                  <td className="px-4 py-3">{e.fieldOfStudy ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {e.graduationYear ??
                      ([e.startDate, e.endDate].filter(Boolean).join(" – ") ||
                        "—")}
                  </td>
                  <td className="px-4 py-3">{e.country ?? "—"}</td>
                </tr>
              ))}
              {education.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[var(--muted)]"
                  >
                    No education history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Work history</h2>
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-black/[0.02] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Employer</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Location</th>
              </tr>
            </thead>
            <tbody>
              {workHistory.map((w) => (
                <tr
                  key={w.id}
                  className="border-b border-[var(--line)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{w.employerName}</div>
                    {w.department ? (
                      <div className="text-xs text-[var(--muted)]">
                        {w.department}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {w.title ?? "—"}
                    {w.isCurrent ? (
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        Current
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {[w.startDate, w.isCurrent ? "Present" : w.endDate]
                      .filter(Boolean)
                      .join(" – ") || "—"}
                  </td>
                  <td className="px-4 py-3">{w.location ?? "—"}</td>
                </tr>
              ))}
              {workHistory.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-[var(--muted)]"
                  >
                    No work history.
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

function formatPhone(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  const ten =
    digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : digits.slice(-10);
  if (ten.length !== 10) return value;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}
