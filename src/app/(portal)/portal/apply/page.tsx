import { Suspense } from "react";
import { IntakeWizard } from "@/components/portal/IntakeWizard";

export default function PortalApplyPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-8 text-sm text-[var(--muted)]">
          Loading intake…
        </div>
      }
    >
      <IntakeWizard />
    </Suspense>
  );
}
