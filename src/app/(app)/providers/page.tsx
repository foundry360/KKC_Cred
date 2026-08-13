import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { listProviders } from "@/lib/providers";
import type { SubjectType } from "@/types";
import { cn } from "@/lib/utils";

type SearchParams = Promise<{ type?: string }>;

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const raw = params.type;
  const type: SubjectType | "all" =
    raw === "practitioner" || raw === "facility" ? raw : "all";

  const providers = await listProviders(type);

  const filters: Array<{ key: SubjectType | "all"; label: string }> = [
    { key: "all", label: "All" },
    { key: "practitioner", label: "Practitioners" },
    { key: "facility", label: "Facilities" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Providers</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {providers.length} record{providers.length === 1 ? "" : "s"} from
            Supabase
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={
                f.key === "all" ? "/providers" : `/providers?type=${f.key}`
              }
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                type === f.key
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--ink)]",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-black/[0.02] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">External Id</th>
              <th className="px-4 py-3 font-medium">NPI</th>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Recred due</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr
                key={p.id}
                className="border-b border-[var(--line)] last:border-0 hover:bg-black/[0.02]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/providers/${p.id}`}
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    {p.displayName}
                  </Link>
                  <div className="text-xs text-[var(--muted)]">
                    {p.specialty ?? p.facilityType ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge value={p.subjectType} />
                </td>
                <td className="px-4 py-3 font-mono text-xs">{p.externalId}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.npi ?? "—"}</td>
                <td className="px-4 py-3">{p.organizationName ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge value={p.status} />
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {p.recredDueDate ?? "—"}
                </td>
              </tr>
            ))}
            {providers.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  No providers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
