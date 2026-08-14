import Image from "next/image";
import Link from "next/link";

export default function PortalHomePage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="overflow-hidden rounded-2xl">
        <Image
          src="/portal-banner.png"
          alt="Meridian Health Partners care team"
          width={1024}
          height={537}
          className="h-40 w-full object-cover object-center sm:h-48 md:h-56"
          sizes="(max-width: 1024px) 100vw, 1024px"
          priority
        />
      </section>

      <section className="portal-hero relative overflow-hidden rounded-2xl px-6 py-12 sm:px-10 sm:py-16">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex rounded-lg bg-white px-3 py-2 shadow-sm">
            <Image
              src="/meridian-logo.png"
              alt="Meridian Health Partners"
              width={200}
              height={44}
              className="h-8 w-auto object-contain object-left sm:h-9"
              priority
            />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Provider Credentialing Portal
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">
            Submit new or recredentialing requests, confirm required documents,
            and track application status for practitioners and facilities.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/portal/apply"
              className="rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-white/95"
            >
              Start credentialing request
            </Link>
            <Link
              href="/portal/apply?mode=existing"
              className="rounded-md border border-white/35 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10"
            >
              Continue as existing provider
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Identify",
            body: "Choose practitioner or facility and look up your network record.",
          },
          {
            title: "Complete checklist",
            body: "Confirm licenses, attestations, and supporting documentation.",
          },
          {
            title: "Submit for review",
            body: "Your request routes to credentialing specialists for chase and decisioning.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5"
          >
            <h2 className="text-sm font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {item.body}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
