import Link from "next/link";
import { getProviderCounts } from "@/lib/providers";

export default async function DashboardPage() {
  const counts = await getProviderCounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Supabase-backed credentialing POC overview.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Providers", value: counts.all, href: "/providers" },
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
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm transition hover:border-[var(--accent)]"
          >
            <div className="text-sm text-[var(--muted)]">{card.label}</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">
              {card.value}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
