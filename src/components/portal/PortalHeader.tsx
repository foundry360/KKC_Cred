import Image from "next/image";
import Link from "next/link";

export function PortalHeader() {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/portal" className="flex min-w-0 items-center gap-3.5">
          <Image
            src="/meridian-logo.png"
            alt="Meridian Health Partners"
            width={280}
            height={64}
            className="h-12 w-auto max-w-[min(100%,16rem)] object-contain object-left sm:h-14 sm:max-w-[18rem]"
            priority
          />
          <span className="hidden min-w-0 border-l border-[var(--line)] pl-3.5 sm:block">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Network access
            </span>
            <span className="block truncate text-sm font-semibold tracking-tight text-[var(--ink)]">
              Provider Credentialing Portal
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/portal/apply"
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 font-medium text-white hover:opacity-95"
          >
            Start application
          </Link>
        </nav>
      </div>
    </header>
  );
}
