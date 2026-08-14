import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getDashboardSummary } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

function MicroCard({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  href: string;
  tone?: "default" | "warn" | "danger" | "accent";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:border-[var(--accent)]",
        tone === "warn" && "border-orange-200",
        tone === "danger" && "border-rose-200",
        tone === "accent" && "border-[var(--accent)]/30",
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums leading-none",
          tone === "warn" && "text-orange-800",
          tone === "danger" && "text-rose-800",
          tone === "accent" && "text-[var(--accent)]",
        )}
      >
        {value}
      </div>
    </Link>
  );
}

function QueueCard({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link
          href={href}
          className="text-xs font-medium text-[var(--accent)] hover:underline"
        >
          View all
        </Link>
      </div>
      <div className="min-h-[8rem]">{children}</div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
      {message}
    </div>
  );
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const { counts } = summary;

  const micros: Array<{
    label: string;
    value: number;
    href: string;
    tone?: "default" | "warn" | "danger" | "accent";
  }> = [
    { label: "Providers", value: counts.providers, href: "/providers" },
    {
      label: "Practitioners",
      value: counts.practitioners,
      href: "/providers?type=practitioner",
    },
    {
      label: "Facilities",
      value: counts.facilities,
      href: "/providers?type=facility",
    },
    {
      label: "Intake",
      value: counts.incomplete,
      href: "/applications",
      tone: "warn",
    },
    {
      label: "In review",
      value: counts.inReview,
      href: "/applications",
      tone: "accent",
    },
    {
      label: "Committee",
      value: counts.pendingCommittee,
      href: "/applications",
      tone: "warn",
    },
    {
      label: "Cred expired",
      value: counts.credentialsExpired,
      href: "/expirations",
      tone: "danger",
    },
    {
      label: "Expiring ≤90d",
      value: counts.credentialsExpiringSoon,
      href: "/expirations",
      tone: "warn",
    },
    {
      label: "Recred ≤120d",
      value: counts.recredDue,
      href: "/expirations",
      tone: "accent",
    },
    {
      label: "Recred overdue",
      value: counts.recredOverdue,
      href: "/expirations",
      tone: "danger",
    },
    {
      label: "Sanctions flag",
      value: counts.sanctionsFlagged,
      href: "/providers",
      tone: counts.sanctionsFlagged > 0 ? "danger" : "default",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Credentialing ops overview — queues, expirations, and recred clock.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {micros.map((card) => (
          <MicroCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <QueueCard title="Chase queue" href="/applications">
          {summary.chaseQueue.length === 0 ? (
            <EmptyState message="No applications in intake." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-black/[0.02] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2 font-medium">Provider</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Attempts</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {summary.chaseQueue.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/providers/${row.providerId}`}
                        className="font-medium text-[var(--accent)] hover:underline"
                      >
                        {row.providerName}
                      </Link>
                      <div className="text-xs text-[var(--muted)]">
                        {row.externalId}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge value={row.applicationType} />
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {row.attemptCount}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {row.dueDate ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </QueueCard>

        <QueueCard title="Committee packet" href="/applications">
          {summary.committeeQueue.length === 0 ? (
            <EmptyState message="Nothing pending committee." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-black/[0.02] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2 font-medium">Provider</th>
                  <th className="px-4 py-2 font-medium">Path</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {summary.committeeQueue.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/providers/${row.providerId}`}
                        className="font-medium text-[var(--accent)] hover:underline"
                      >
                        {row.providerName}
                      </Link>
                      <div className="text-xs text-[var(--muted)]">
                        {row.externalId}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 capitalize">
                      {row.path.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge value={row.status} />
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {row.dueDate ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </QueueCard>

        <QueueCard title="Credential expirations" href="/expirations">
          {summary.expiringCredentials.length === 0 ? (
            <EmptyState message="No credentials in the expiration window." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-black/[0.02] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2 font-medium">Provider</th>
                  <th className="px-4 py-2 font-medium">Credential</th>
                  <th className="px-4 py-2 font-medium">Expires</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.expiringCredentials.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/providers/${row.providerId}`}
                        className="font-medium text-[var(--accent)] hover:underline"
                      >
                        {row.providerName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 capitalize">
                      {(row.name ?? row.credentialType).replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {row.expiresAt ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge value={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </QueueCard>

        <QueueCard title="Recred clock" href="/expirations">
          {summary.recredQueue.length === 0 ? (
            <EmptyState message="No providers in the recred window." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-black/[0.02] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2 font-medium">Provider</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Recred due</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.recredQueue.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/providers/${row.id}`}
                        className="font-medium text-[var(--accent)] hover:underline"
                      >
                        {row.displayName}
                      </Link>
                      <div className="text-xs text-[var(--muted)]">
                        {row.externalId}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge value={row.subjectType} />
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {row.recredDueDate ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge value={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </QueueCard>
      </div>
    </div>
  );
}
