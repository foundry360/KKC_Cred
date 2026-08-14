import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-800",
  valid: "bg-emerald-50 text-emerald-800",
  complete: "bg-emerald-50 text-emerald-800",
  approved: "bg-emerald-50 text-emerald-800",
  synced: "bg-emerald-50 text-emerald-800",
  pending: "bg-amber-50 text-amber-900",
  pending_verification: "bg-amber-50 text-amber-900",
  draft: "bg-zinc-100 text-zinc-700",
  incomplete: "bg-amber-50 text-amber-900",
  in_review: "bg-sky-50 text-sky-900",
  pending_committee: "bg-orange-50 text-orange-900",
  expiring_soon: "bg-orange-50 text-orange-900",
  expired: "bg-rose-50 text-rose-900",
  inactive: "bg-zinc-100 text-zinc-700",
  suspended: "bg-rose-50 text-rose-900",
  rejected: "bg-rose-50 text-rose-900",
  denied: "bg-rose-50 text-rose-900",
  withdrawn: "bg-zinc-100 text-zinc-700",
  practitioner: "bg-sky-50 text-sky-900",
  facility: "bg-violet-50 text-violet-900",
  new: "bg-sky-50 text-sky-900",
  recred: "bg-violet-50 text-violet-900",
};

export function StatusBadge({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const key = value.toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        styles[key] ?? "bg-zinc-100 text-zinc-700",
        className,
      )}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
