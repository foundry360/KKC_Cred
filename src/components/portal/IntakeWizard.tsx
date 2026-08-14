"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffectEvent, useTransition } from "react";
import {
  checklistForSubject,
  defaultPathForSubject,
} from "@/lib/portal/checklist";
import { cn } from "@/lib/utils";
import type { DegreeType } from "@/types/education";
import type { AddressType, Gender } from "@/types/address";

type SubjectType = "practitioner" | "facility";
type ApplicationType = "new" | "recred";
type PathType = "caqh" | "in_house" | "facility";

type ProviderHit = {
  id: string;
  external_id: string;
  display_name: string;
  subject_type: string;
  npi: string | null;
  organization_name: string | null;
  specialty: string | null;
  facility_type: string | null;
  email: string | null;
  phone: string | null;
};

type EducationRow = {
  institutionName: string;
  degreeType: DegreeType;
  fieldOfStudy: string;
  graduationYear: string;
  country: string;
};

type WorkRow = {
  employerName: string;
  title: string;
  department: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  location: string;
};

type AddressRow = {
  addressType: AddressType;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

const DEGREE_OPTIONS: { value: DegreeType; label: string }[] = [
  { value: "md", label: "MD" },
  { value: "do", label: "DO" },
  { value: "mbbs", label: "MBBS" },
  { value: "phd", label: "PhD" },
  { value: "masters", label: "Masters" },
  { value: "bachelors", label: "Bachelors" },
  { value: "residency", label: "Residency" },
  { value: "fellowship", label: "Fellowship" },
  { value: "internship", label: "Internship" },
  { value: "other", label: "Other" },
];

const GENDER_OPTIONS: { value: Gender | ""; label: string }[] = [
  { value: "", label: "Select…" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "unknown", label: "Unknown" },
];

function emptyEducation(): EducationRow {
  return {
    institutionName: "",
    degreeType: "md",
    fieldOfStudy: "",
    graduationYear: "",
    country: "US",
  };
}

function emptyWork(): WorkRow {
  return {
    employerName: "",
    title: "",
    department: "",
    startDate: "",
    endDate: "",
    isCurrent: true,
    location: "",
  };
}

function emptyAddress(type: AddressType = "work"): AddressRow {
  return {
    addressType: type,
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  };
}

export function IntakeWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferExisting = searchParams.get("mode") === "existing";

  const [step, setStep] = useState(0);
  const [subjectType, setSubjectType] = useState<SubjectType>("practitioner");
  const [identityMode, setIdentityMode] = useState<"existing" | "new">(
    preferExisting ? "existing" : "new",
  );
  const [lookupQ, setLookupQ] = useState("");
  const [hits, setHits] = useState<ProviderHit[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderHit | null>(
    null,
  );
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameSuffix, setNameSuffix] = useState("");
  const [npi, setNpi] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [ssnLast4, setSsnLast4] = useState("");
  const [birthCountry, setBirthCountry] = useState("");
  const [preferredLanguages, setPreferredLanguages] = useState("");
  const [caqhId, setCaqhId] = useState("");
  const [practiceState, setPracticeState] = useState("");
  const [addresses, setAddresses] = useState<AddressRow[]>([emptyAddress("work")]);
  const [education, setEducation] = useState<EducationRow[]>([emptyEducation()]);
  const [workHistory, setWorkHistory] = useState<WorkRow[]>([emptyWork()]);
  const [applicationType, setApplicationType] =
    useState<ApplicationType>("new");
  const [path, setPath] = useState<PathType>("caqh");
  const [checklistComplete, setChecklistComplete] = useState<
    Record<string, boolean>
  >({});
  const [checklistFiles, setChecklistFiles] = useState<Record<string, File | null>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const steps = useMemo(() => {
    if (subjectType === "facility") {
      return [
        "Subject",
        "Identity",
        "Demographics",
        "Address",
        "Request",
        "Checklist",
        "Review",
      ] as const;
    }
    return [
      "Subject",
      "Identity",
      "Demographics",
      "Address",
      "Education",
      "Work history",
      "Request",
      "Checklist",
      "Review",
    ] as const;
  }, [subjectType]);

  const template = useMemo(
    () => checklistForSubject(subjectType),
    [subjectType],
  );

  const onSubjectChange = useEffectEvent((next: SubjectType) => {
    setSubjectType(next);
    setPath(defaultPathForSubject(next));
    setSelectedProvider(null);
    setChecklistComplete({});
    setChecklistFiles({});
    setStep(0);
  });

  const applySubjectType = useEffectEvent((next: SubjectType) => {
    setSubjectType(next);
    setPath(defaultPathForSubject(next));
  });

  async function runLookup() {
    setLookingUp(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/portal/providers/lookup?q=${encodeURIComponent(lookupQ)}`,
      );
      const json = (await res.json()) as {
        data?: ProviderHit[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Lookup failed");
      setHits(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLookingUp(false);
    }
  }

  function selectProvider(p: ProviderHit) {
    setSelectedProvider(p);
    setDisplayName(p.display_name);
    setNpi(p.npi ?? "");
    setOrganizationName(p.organization_name ?? "");
    setSpecialty(p.specialty ?? "");
    setFacilityType(p.facility_type ?? "");
    setEmail(p.email ?? "");
    setPhone(p.phone ?? "");
    if (p.subject_type === "facility" || p.subject_type === "practitioner") {
      applySubjectType(p.subject_type);
    }
  }

  function resolvedDisplayName() {
    if (displayName.trim()) return displayName.trim();
    if (subjectType === "practitioner") {
      return [firstName, lastName].filter(Boolean).join(" ").trim();
    }
    return organizationName.trim();
  }

  function stepKey(idx: number): string {
    return steps[idx] ?? "";
  }

  function canContinue() {
    const key = stepKey(step);
    if (key === "Subject") return true;
    if (key === "Identity") {
      if (identityMode === "existing") return !!selectedProvider;
      return resolvedDisplayName().length > 1;
    }
    if (key === "Demographics") return true;
    if (key === "Address") {
      return addresses.some((a) => a.line1.trim() && a.city.trim());
    }
    if (key === "Education") {
      return education.some((e) => e.institutionName.trim());
    }
    if (key === "Work history") {
      return workHistory.some((w) => w.employerName.trim());
    }
    if (key === "Request") return !!applicationType && !!path;
    return true;
  }

  function submit() {
    setError(null);
    const name = resolvedDisplayName();
    startTransition(async () => {
      try {
        const res = await fetch("/api/portal/applications", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            subjectType,
            applicationType,
            path,
            providerId: selectedProvider?.id,
            providerExternalId: selectedProvider?.external_id,
            provider: {
              displayName: name,
              npi: npi.trim() || undefined,
              organizationName: organizationName.trim() || undefined,
              specialty: specialty.trim() || undefined,
              facilityType: facilityType.trim() || undefined,
              email: email.trim() || undefined,
              phone: phone.trim() || undefined,
              mobilePhone: mobilePhone.trim() || undefined,
              firstName: firstName.trim() || undefined,
              middleName: middleName.trim() || undefined,
              lastName: lastName.trim() || undefined,
              nameSuffix: nameSuffix.trim() || undefined,
              dateOfBirth: dateOfBirth || undefined,
              gender: gender || undefined,
              ssnLast4: ssnLast4.trim() || undefined,
              birthCountry: birthCountry.trim() || undefined,
              preferredLanguages: preferredLanguages.trim() || undefined,
              caqhId: caqhId.trim() || undefined,
              practiceState: practiceState.trim() || undefined,
            },
            addresses: addresses
              .filter((a) => a.line1.trim() && a.city.trim())
              .map((a) => ({
                addressType: a.addressType,
                line1: a.line1.trim(),
                line2: a.line2.trim() || undefined,
                city: a.city.trim(),
                state: a.state.trim() || undefined,
                postalCode: a.postalCode.trim() || undefined,
                country: a.country.trim() || "US",
                isPrimary: true,
              })),
            education:
              subjectType === "practitioner"
                ? education
                    .filter((e) => e.institutionName.trim())
                    .map((e) => ({
                      institutionName: e.institutionName.trim(),
                      degreeType: e.degreeType,
                      fieldOfStudy: e.fieldOfStudy.trim() || undefined,
                      graduationYear: e.graduationYear
                        ? Number(e.graduationYear)
                        : null,
                      country: e.country.trim() || undefined,
                    }))
                : [],
            workHistory:
              subjectType === "practitioner"
                ? workHistory
                    .filter((w) => w.employerName.trim())
                    .map((w) => ({
                      employerName: w.employerName.trim(),
                      title: w.title.trim() || undefined,
                      department: w.department.trim() || undefined,
                      startDate: w.startDate || undefined,
                      endDate: w.isCurrent ? undefined : w.endDate || undefined,
                      isCurrent: w.isCurrent,
                      location: w.location.trim() || undefined,
                    }))
                : [],
            checklistComplete,
          }),
        });
        const json = (await res.json()) as {
          data?: {
            applicationId: string;
            providerId: string;
            externalId: string;
            providerExternalId: string;
          };
          error?: string;
        };
        if (!res.ok || !json.data) {
          throw new Error(json.error || "Submit failed");
        }

        const uploads = Object.entries(checklistFiles).filter(
          ([, file]) => !!file,
        );
        for (const [itemKey, file] of uploads) {
          if (!file) continue;
          const form = new FormData();
          form.set("file", file);
          form.set("applicationId", json.data.applicationId);
          form.set("providerId", json.data.providerId);
          form.set("applicationExternalId", json.data.externalId);
          form.set("providerExternalId", json.data.providerExternalId);
          form.set("checklistItemKey", itemKey);
          form.set("syncToSalesforce", "queued");
          const up = await fetch("/api/portal/documents", {
            method: "POST",
            body: form,
          });
          const upJson = (await up.json()) as { error?: string };
          if (!up.ok) {
            throw new Error(upJson.error || `Failed to upload ${file.name}`);
          }
        }

        router.push(`/portal/applications/${json.data.applicationId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Submit failed");
      }
    });
  }

  const currentKey = stepKey(step);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/portal"
          className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
        >
          ← Portal home
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Credentialing request
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Complete each step to submit your practitioner or facility application.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {steps.map((label, idx) => (
          <li
            key={label}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              idx === step
                ? "bg-[var(--accent)] text-white"
                : idx < step
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "bg-[var(--panel)] text-[var(--muted)] border border-[var(--line)]",
            )}
          >
            {idx + 1}. {label}
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
        {currentKey === "Subject" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Who is being credentialed?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    key: "practitioner" as const,
                    title: "Practitioner",
                    body: "Physicians, APPs, and other licensed clinicians.",
                  },
                  {
                    key: "facility" as const,
                    title: "Facility",
                    body: "Hospitals, clinics, labs, and other site-based entities.",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onSubjectChange(opt.key)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition",
                    subjectType === opt.key
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--line)] hover:border-[var(--accent)]/50",
                  )}
                >
                  <div className="font-semibold">{opt.title}</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {opt.body}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentKey === "Identity" && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold">Provider identity</h2>
            <div className="flex gap-2">
              {(
                [
                  ["existing", "Find existing record"],
                  ["new", "Create new profile"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setIdentityMode(key);
                    if (key === "new") setSelectedProvider(null);
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm",
                    identityMode === key
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--line)] text-[var(--muted)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {identityMode === "existing" ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">
                    Search by name, NPI, or external id
                  </span>
                  <div className="mt-1 flex gap-2">
                    <input
                      value={lookupQ}
                      onChange={(e) => setLookupQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void runLookup();
                        }
                      }}
                      className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                      placeholder="e.g. PRV-1001 or 1234567890"
                    />
                    <button
                      type="button"
                      onClick={() => void runLookup()}
                      disabled={lookingUp}
                      className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {lookingUp ? "…" : "Search"}
                    </button>
                  </div>
                </label>
                <ul className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)]">
                  {hits.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => selectProvider(p)}
                        className={cn(
                          "flex w-full flex-col gap-0.5 px-3 py-3 text-left text-sm hover:bg-black/[0.02]",
                          selectedProvider?.id === p.id &&
                            "bg-[var(--accent-soft)]",
                        )}
                      >
                        <span className="font-medium">{p.display_name}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {p.external_id}
                          {p.npi ? ` · NPI ${p.npi}` : ""} · {p.subject_type}
                        </span>
                      </button>
                    </li>
                  ))}
                  {hits.length === 0 && (
                    <li className="px-3 py-6 text-center text-sm text-[var(--muted)]">
                      Search to select a seeded provider record.
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {subjectType === "practitioner" ? (
                  <>
                    <Field label="First name" value={firstName} onChange={setFirstName} />
                    <Field label="Last name" value={lastName} onChange={setLastName} />
                    <Field label="Middle name" value={middleName} onChange={setMiddleName} />
                    <Field label="Suffix" value={nameSuffix} onChange={setNameSuffix} />
                    <Field
                      label="Display name"
                      value={displayName}
                      onChange={setDisplayName}
                      className="sm:col-span-2"
                    />
                  </>
                ) : (
                  <Field
                    label="Facility name"
                    value={displayName}
                    onChange={setDisplayName}
                    className="sm:col-span-2"
                  />
                )}
                <Field label="NPI" value={npi} onChange={setNpi} />
                <Field
                  label="Organization"
                  value={organizationName}
                  onChange={setOrganizationName}
                />
                {subjectType === "practitioner" ? (
                  <Field
                    label="Specialty"
                    value={specialty}
                    onChange={setSpecialty}
                  />
                ) : (
                  <Field
                    label="Facility type"
                    value={facilityType}
                    onChange={setFacilityType}
                  />
                )}
                <Field label="Email" value={email} onChange={setEmail} />
                <Field label="Phone" value={phone} onChange={setPhone} />
              </div>
            )}
          </div>
        )}

        {currentKey === "Demographics" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Demographics</h2>
            <p className="text-sm text-[var(--muted)]">
              Used by credentialing for identity verification and outreach.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {subjectType === "practitioner" && (
                <>
                  <Field
                    label="Date of birth"
                    value={dateOfBirth}
                    onChange={setDateOfBirth}
                    type="date"
                  />
                  <label className="block text-sm">
                    <span className="text-[var(--muted)]">Gender</span>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender | "")}
                      className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                    >
                      {GENDER_OPTIONS.map((opt) => (
                        <option key={opt.value || "blank"} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="SSN last 4"
                    value={ssnLast4}
                    onChange={(v) => setSsnLast4(v.replace(/\D/g, "").slice(0, 4))}
                  />
                  <Field label="CAQH ID" value={caqhId} onChange={setCaqhId} />
                  <Field
                    label="Birth country"
                    value={birthCountry}
                    onChange={setBirthCountry}
                  />
                  <Field
                    label="Preferred languages"
                    value={preferredLanguages}
                    onChange={setPreferredLanguages}
                  />
                </>
              )}
              <Field
                label="Mobile phone"
                value={mobilePhone}
                onChange={setMobilePhone}
              />
              <Field
                label="Practice state"
                value={practiceState}
                onChange={setPracticeState}
              />
            </div>
          </div>
        )}

        {currentKey === "Address" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Address</h2>
              <button
                type="button"
                className="text-sm font-medium text-[var(--accent)]"
                onClick={() =>
                  setAddresses((prev) => [
                    ...prev,
                    emptyAddress(prev.length ? "mailing" : "work"),
                  ])
                }
              >
                + Add address
              </button>
            </div>
            <div className="space-y-4">
              {addresses.map((addr, idx) => (
                <div
                  key={idx}
                  className="grid gap-3 rounded-lg border border-[var(--line)] p-4 sm:grid-cols-2"
                >
                  <label className="block text-sm sm:col-span-2">
                    <span className="text-[var(--muted)]">Address type</span>
                    <select
                      value={addr.addressType}
                      onChange={(e) =>
                        setAddresses((prev) =>
                          prev.map((a, i) =>
                            i === idx
                              ? {
                                  ...a,
                                  addressType: e.target.value as AddressType,
                                }
                              : a,
                          ),
                        )
                      }
                      className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                    >
                      <option value="work">Work / practice</option>
                      <option value="home">Home</option>
                      <option value="mailing">Mailing</option>
                    </select>
                  </label>
                  <Field
                    label="Street line 1"
                    value={addr.line1}
                    onChange={(v) =>
                      setAddresses((prev) =>
                        prev.map((a, i) => (i === idx ? { ...a, line1: v } : a)),
                      )
                    }
                    className="sm:col-span-2"
                  />
                  <Field
                    label="Street line 2"
                    value={addr.line2}
                    onChange={(v) =>
                      setAddresses((prev) =>
                        prev.map((a, i) => (i === idx ? { ...a, line2: v } : a)),
                      )
                    }
                    className="sm:col-span-2"
                  />
                  <Field
                    label="City"
                    value={addr.city}
                    onChange={(v) =>
                      setAddresses((prev) =>
                        prev.map((a, i) => (i === idx ? { ...a, city: v } : a)),
                      )
                    }
                  />
                  <Field
                    label="State"
                    value={addr.state}
                    onChange={(v) =>
                      setAddresses((prev) =>
                        prev.map((a, i) => (i === idx ? { ...a, state: v } : a)),
                      )
                    }
                  />
                  <Field
                    label="Postal code"
                    value={addr.postalCode}
                    onChange={(v) =>
                      setAddresses((prev) =>
                        prev.map((a, i) =>
                          i === idx ? { ...a, postalCode: v } : a,
                        ),
                      )
                    }
                  />
                  <Field
                    label="Country"
                    value={addr.country}
                    onChange={(v) =>
                      setAddresses((prev) =>
                        prev.map((a, i) =>
                          i === idx ? { ...a, country: v } : a,
                        ),
                      )
                    }
                  />
                  {addresses.length > 1 && (
                    <button
                      type="button"
                      className="text-left text-sm text-rose-700 sm:col-span-2"
                      onClick={() =>
                        setAddresses((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      Remove address
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentKey === "Education" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Education history</h2>
              <button
                type="button"
                className="text-sm font-medium text-[var(--accent)]"
                onClick={() =>
                  setEducation((prev) => [...prev, emptyEducation()])
                }
              >
                + Add education
              </button>
            </div>
            <div className="space-y-4">
              {education.map((row, idx) => (
                <div
                  key={idx}
                  className="grid gap-3 rounded-lg border border-[var(--line)] p-4 sm:grid-cols-2"
                >
                  <Field
                    label="Institution"
                    value={row.institutionName}
                    onChange={(v) =>
                      setEducation((prev) =>
                        prev.map((e, i) =>
                          i === idx ? { ...e, institutionName: v } : e,
                        ),
                      )
                    }
                    className="sm:col-span-2"
                  />
                  <label className="block text-sm">
                    <span className="text-[var(--muted)]">Degree / training</span>
                    <select
                      value={row.degreeType}
                      onChange={(e) =>
                        setEducation((prev) =>
                          prev.map((ed, i) =>
                            i === idx
                              ? {
                                  ...ed,
                                  degreeType: e.target.value as DegreeType,
                                }
                              : ed,
                          ),
                        )
                      }
                      className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                    >
                      {DEGREE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Field of study"
                    value={row.fieldOfStudy}
                    onChange={(v) =>
                      setEducation((prev) =>
                        prev.map((e, i) =>
                          i === idx ? { ...e, fieldOfStudy: v } : e,
                        ),
                      )
                    }
                  />
                  <Field
                    label="Graduation year"
                    value={row.graduationYear}
                    onChange={(v) =>
                      setEducation((prev) =>
                        prev.map((e, i) =>
                          i === idx
                            ? { ...e, graduationYear: v.replace(/\D/g, "").slice(0, 4) }
                            : e,
                        ),
                      )
                    }
                  />
                  <Field
                    label="Country"
                    value={row.country}
                    onChange={(v) =>
                      setEducation((prev) =>
                        prev.map((e, i) =>
                          i === idx ? { ...e, country: v } : e,
                        ),
                      )
                    }
                  />
                  {education.length > 1 && (
                    <button
                      type="button"
                      className="text-left text-sm text-rose-700 sm:col-span-2"
                      onClick={() =>
                        setEducation((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentKey === "Work history" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Work history</h2>
              <button
                type="button"
                className="text-sm font-medium text-[var(--accent)]"
                onClick={() => setWorkHistory((prev) => [...prev, emptyWork()])}
              >
                + Add position
              </button>
            </div>
            <div className="space-y-4">
              {workHistory.map((row, idx) => (
                <div
                  key={idx}
                  className="grid gap-3 rounded-lg border border-[var(--line)] p-4 sm:grid-cols-2"
                >
                  <Field
                    label="Employer"
                    value={row.employerName}
                    onChange={(v) =>
                      setWorkHistory((prev) =>
                        prev.map((w, i) =>
                          i === idx ? { ...w, employerName: v } : w,
                        ),
                      )
                    }
                    className="sm:col-span-2"
                  />
                  <Field
                    label="Title"
                    value={row.title}
                    onChange={(v) =>
                      setWorkHistory((prev) =>
                        prev.map((w, i) => (i === idx ? { ...w, title: v } : w)),
                      )
                    }
                  />
                  <Field
                    label="Department"
                    value={row.department}
                    onChange={(v) =>
                      setWorkHistory((prev) =>
                        prev.map((w, i) =>
                          i === idx ? { ...w, department: v } : w,
                        ),
                      )
                    }
                  />
                  <Field
                    label="Start date"
                    value={row.startDate}
                    onChange={(v) =>
                      setWorkHistory((prev) =>
                        prev.map((w, i) =>
                          i === idx ? { ...w, startDate: v } : w,
                        ),
                      )
                    }
                    type="date"
                  />
                  <Field
                    label="End date"
                    value={row.endDate}
                    onChange={(v) =>
                      setWorkHistory((prev) =>
                        prev.map((w, i) =>
                          i === idx ? { ...w, endDate: v } : w,
                        ),
                      )
                    }
                    type="date"
                  />
                  <Field
                    label="Location"
                    value={row.location}
                    onChange={(v) =>
                      setWorkHistory((prev) =>
                        prev.map((w, i) =>
                          i === idx ? { ...w, location: v } : w,
                        ),
                      )
                    }
                  />
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={row.isCurrent}
                      onChange={(e) =>
                        setWorkHistory((prev) =>
                          prev.map((w, i) =>
                            i === idx
                              ? { ...w, isCurrent: e.target.checked }
                              : w,
                          ),
                        )
                      }
                    />
                    Current position
                  </label>
                  {workHistory.length > 1 && (
                    <button
                      type="button"
                      className="text-left text-sm text-rose-700 sm:col-span-2"
                      onClick={() =>
                        setWorkHistory((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentKey === "Request" && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold">Request details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { key: "new" as const, label: "New credentialing" },
                  { key: "recred" as const, label: "Recredentialing" },
                ] as const
              ).map((opt) => (
                <Choice
                  key={opt.key}
                  active={applicationType === opt.key}
                  label={opt.label}
                  onClick={() => setApplicationType(opt.key)}
                />
              ))}
            </div>
            <div>
              <div className="mb-2 text-sm text-[var(--muted)]">Intake path</div>
              <div className="grid gap-3 sm:grid-cols-3">
                {(subjectType === "facility"
                  ? ([{ key: "facility" as const, label: "Facility path" }] as const)
                  : ([
                      { key: "caqh" as const, label: "CAQH" },
                      { key: "in_house" as const, label: "In-house" },
                    ] as const)
                ).map((opt) => (
                  <Choice
                    key={opt.key}
                    active={path === opt.key}
                    label={opt.label}
                    onClick={() => setPath(opt.key)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {currentKey === "Checklist" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Document checklist</h2>
            <p className="text-sm text-[var(--muted)]">
              Mark items you can provide and optionally attach a PDF or image
              (max 10 MB). Attachments are stored and synced to Salesforce Files
              on the application.
            </p>
            <ul className="space-y-2">
              {template.map((item) => {
                const checked = checklistComplete[item.key] === true;
                const file = checklistFiles[item.key];
                return (
                  <li key={item.key}>
                    <div className="rounded-lg border border-[var(--line)] px-3 py-3">
                      <label className="flex cursor-pointer items-start gap-3 hover:bg-black/[0.01]">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={(e) =>
                            setChecklistComplete((prev) => ({
                              ...prev,
                              [item.key]: e.target.checked,
                            }))
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {item.label}
                          </span>
                          <span className="text-xs text-[var(--muted)]">
                            Required · attach supporting file if available
                          </span>
                        </span>
                      </label>
                      <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*"
                          className="block w-full max-w-md text-xs text-[var(--muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--accent)]"
                          onChange={(e) => {
                            const next = e.target.files?.[0] || null;
                            setChecklistFiles((prev) => ({
                              ...prev,
                              [item.key]: next,
                            }));
                            if (next) {
                              setChecklistComplete((prev) => ({
                                ...prev,
                                [item.key]: true,
                              }));
                            }
                          }}
                        />
                        {file && (
                          <span className="text-xs text-[var(--ink)]">
                            {file.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {currentKey === "Review" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Review and submit</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <ReviewItem label="Subject" value={subjectType} />
              <ReviewItem
                label="Provider"
                value={selectedProvider?.display_name || resolvedDisplayName() || "-"}
              />
              <ReviewItem
                label="Demographics"
                value={
                  subjectType === "practitioner"
                    ? [
                        dateOfBirth && `DOB ${dateOfBirth}`,
                        gender,
                        caqhId && `CAQH ${caqhId}`,
                        practiceState && `State ${practiceState}`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Not provided"
                    : practiceState
                      ? `State ${practiceState}`
                      : "Not provided"
                }
              />
              <ReviewItem
                label="Addresses"
                value={`${addresses.filter((a) => a.line1 && a.city).length} entered`}
              />
              {subjectType === "practitioner" && (
                <>
                  <ReviewItem
                    label="Education"
                    value={`${education.filter((e) => e.institutionName).length} record(s)`}
                  />
                  <ReviewItem
                    label="Work history"
                    value={`${workHistory.filter((w) => w.employerName).length} record(s)`}
                  />
                </>
              )}
              <ReviewItem label="Application" value={applicationType} />
              <ReviewItem
                label="Path"
                value={
                  path === "caqh"
                    ? "CAQH"
                    : path === "in_house"
                      ? "In-house"
                      : "Facility path"
                }
              />
              <ReviewItem
                label="Checklist ready"
                value={`${Object.values(checklistComplete).filter(Boolean).length} of ${template.length}`}
              />
              <ReviewItem
                label="Attachments"
                value={`${Object.values(checklistFiles).filter(Boolean).length} file(s)`}
              />
            </dl>
            <p className="rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent)]">
              Submitting creates a credentialing application for specialist
              review. You can track status on the confirmation page.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
          <button
            type="button"
            disabled={step === 0 || pending}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-md px-3 py-2 text-sm text-[var(--muted)] disabled:opacity-40"
          >
            Back
          </button>
          {step < steps.length - 1 ? (
            <button
              type="button"
              disabled={!canContinue()}
              onClick={() => setStep((s) => s + 1)}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={pending || !canContinue()}
              onClick={submit}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {pending ? "Submitting…" : "Submit request"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="text-[var(--muted)]">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
      />
    </label>
  );
}

function Choice({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-3 text-left text-sm font-medium",
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--line)] text-[var(--ink)]",
      )}
    >
      {label}
    </button>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
