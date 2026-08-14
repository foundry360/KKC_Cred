import { PortalHeader } from "@/components/portal/PortalHeader";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="portal-shell min-h-full text-[var(--ink)]">
      <PortalHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">{children}</main>
      <footer className="border-t border-[var(--line)] py-6 text-center text-xs text-[var(--muted)]">
        Credentialing intake for practitioners and facilities. Demo portal -
        does not replace CAQH or payer production systems.
      </footer>
    </div>
  );
}
