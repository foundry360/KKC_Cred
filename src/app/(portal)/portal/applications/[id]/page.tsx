import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getPortalApplication } from "@/lib/portal/applications";
import { listDocumentsForApplication } from "@/lib/portal/documents";

type Params = Promise<{ id: string }>;

export default async function PortalApplicationPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const result = await getPortalApplication(id);
  if (!result) notFound();

  const { application, checklist, education, workHistory, addresses } = result;
  let documents: Awaited<ReturnType<typeof listDocumentsForApplication>> = [];
  try {
    documents = await listDocumentsForApplication(id);
  } catch {
    documents = [];
  }
  const providerRaw = application.providers as
    | {
        display_name?: string;
        npi?: string | null;
        external_id?: string;
        organization_name?: string | null;
        date_of_birth?: string | null;
        gender?: string | null;
        caqh_id?: string | null;
        practice_state?: string | null;
        email?: string | null;
        phone?: string | null;
        mobile_phone?: string | null;
      }
    | {
        display_name?: string;
        npi?: string | null;
        external_id?: string;
        organization_name?: string | null;
        date_of_birth?: string | null;
        gender?: string | null;
        caqh_id?: string | null;
        practice_state?: string | null;
        email?: string | null;
        phone?: string | null;
        mobile_phone?: string | null;
      }[]
    | null;
  const provider = Array.isArray(providerRaw) ? providerRaw[0] : providerRaw;
  const completeCount = checklist.filter((c) => c.complete).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/portal"
          className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
        >
          ← Portal home
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Application submitted
            </h1>
            <p className="mt-1 font-mono text-sm text-[var(--muted)]">
              {application.external_id}
            </p>
          </div>
          <StatusBadge value={application.status} />
        </div>
      </div>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Verification status
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          After you submit, the system automatically runs primary-source checks
          (including live NPI lookup against CMS NPPES) and flags anything that
          needs credentialing staff review.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Info
            label="PSV status"
            value={(application.psv_status ?? "not_started").replaceAll(
              "_",
              " ",
            )}
          />
          <Info
            label="Credentialing readiness"
            value={
              application.readiness_score != null
                ? `${application.readiness_score}%`
                : application.psv_ran_at
                  ? "—"
                  : "Running…"
            }
          />
          <Info
            label="Last verification run"
            value={
              application.psv_ran_at
                ? new Date(application.psv_ran_at).toLocaleString()
                : "Queued after submit"
            }
          />
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:grid-cols-2">
        <Info
          label="Provider"
          value={provider?.display_name ?? "Provider"}
        />
        <Info label="External id" value={provider?.external_id ?? "-"} />
        <Info label="NPI" value={provider?.npi ?? "-"} />
        <Info
          label="Organization"
          value={provider?.organization_name ?? "-"}
        />
        <Info label="Email" value={provider?.email ?? "-"} />
        <Info
          label="Phone"
          value={provider?.mobile_phone || provider?.phone || "-"}
        />
        <Info label="Date of birth" value={provider?.date_of_birth ?? "-"} />
        <Info
          label="Gender"
          value={provider?.gender?.replaceAll("_", " ") ?? "-"}
        />
        <Info label="CAQH ID" value={provider?.caqh_id ?? "-"} />
        <Info label="Practice state" value={provider?.practice_state ?? "-"} />
        <Info
          label="Type"
          value={`${formatApplicationType(application.application_type)} · ${formatPath(application.path)}`}
        />
        <Info label="Due" value={application.due_date ?? "-"} />
      </section>

      {addresses.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Addresses</h2>
          <ul className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            {addresses.map((a) => (
              <li
                key={a.id}
                className="border-b border-[var(--line)] px-4 py-3 text-sm last:border-0"
              >
                <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {a.address_type}
                </div>
                <div className="mt-1">
                  {[a.line1, a.line2].filter(Boolean).join(", ")}
                </div>
                <div className="text-[var(--muted)]">
                  {[a.city, a.state, a.postal_code].filter(Boolean).join(", ")}
                  {a.country ? ` · ${a.country}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {education.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Education</h2>
          <ul className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            {education.map((e) => (
              <li
                key={e.id}
                className="border-b border-[var(--line)] px-4 py-3 text-sm last:border-0"
              >
                <div className="font-medium">{e.institution_name}</div>
                <div className="text-[var(--muted)]">
                  {e.degree_type.toUpperCase()}
                  {e.field_of_study ? ` · ${e.field_of_study}` : ""}
                  {e.graduation_year ? ` · ${e.graduation_year}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {workHistory.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Work history</h2>
          <ul className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            {workHistory.map((w) => (
              <li
                key={w.id}
                className="border-b border-[var(--line)] px-4 py-3 text-sm last:border-0"
              >
                <div className="font-medium">{w.employer_name}</div>
                <div className="text-[var(--muted)]">
                  {[w.title, w.department, w.location]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {w.start_date || "—"} →{" "}
                  {w.is_current ? "Present" : w.end_date || "—"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {documents.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Uploaded documents</h2>
          <ul className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3 text-sm last:border-0"
              >
                <div>
                  <div className="font-medium">{d.file_name || "File"}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {d.checklist_item_key
                      ? d.checklist_item_key.replaceAll("_", " ")
                      : "Attachment"}
                  </div>
                </div>
                <StatusBadge
                  value={
                    d.salesforce_content_document_id ? "synced" : "pending"
                  }
                />
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--muted)]">
            Files are stored in Supabase and synced to Salesforce Files on the
            credentialing application (may take a minute after submit).
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Checklist ({completeCount}/{checklist.length})
        </h2>
        <ul className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          {checklist.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3 text-sm last:border-0"
            >
              <span>{item.label}</span>
              <StatusBadge value={item.complete ? "complete" : "incomplete"} />
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-[var(--muted)]">
        Credentialing specialists will review this request. Incomplete
        checklist items may trigger outreach.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/portal/apply"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Start another request
        </Link>
      </div>
    </div>
  );
}

function formatPath(path: string): string {
  if (path === "caqh") return "CAQH";
  if (path === "in_house") return "In-house";
  if (path === "facility") return "Facility";
  if (path === "delegated") return "Delegated";
  return path.replaceAll("_", " ");
}

function formatApplicationType(type: string): string {
  if (type === "new") return "New";
  if (type === "recred") return "Recred";
  return type;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
