import { createClient } from "@/lib/supabase/server";

export type DashboardMicroCounts = {
  providers: number;
  practitioners: number;
  facilities: number;
  incomplete: number;
  inReview: number;
  pendingCommittee: number;
  credentialsExpired: number;
  credentialsExpiringSoon: number;
  recredDue: number;
  recredOverdue: number;
  sanctionsFlagged: number;
};

export type DashboardAppRow = {
  id: string;
  externalId: string;
  applicationType: string;
  path: string;
  status: string;
  subjectType: string;
  attemptCount: number;
  dueDate: string | null;
  providerId: string;
  providerName: string;
};

export type DashboardCredentialRow = {
  id: string;
  providerId: string;
  providerName: string;
  credentialType: string;
  name: string | null;
  status: string;
  expiresAt: string | null;
};

export type DashboardRecredRow = {
  id: string;
  displayName: string;
  subjectType: string;
  externalId: string;
  recredDueDate: string | null;
  status: string;
};

export type DashboardSummary = {
  counts: DashboardMicroCounts;
  chaseQueue: DashboardAppRow[];
  committeeQueue: DashboardAppRow[];
  expiringCredentials: DashboardCredentialRow[];
  recredQueue: DashboardRecredRow[];
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

type AppJoin = {
  id: string;
  external_id: string;
  application_type: string;
  path: string;
  status: string;
  subject_type: string;
  attempt_count: number | null;
  due_date: string | null;
  provider_id: string;
  providers:
    | { display_name: string }
    | { display_name: string }[]
    | null;
};

type CredJoin = {
  id: string;
  provider_id: string;
  credential_type: string;
  name: string | null;
  status: string;
  expires_at: string | null;
  providers:
    | { display_name: string }
    | { display_name: string }[]
    | null;
};

function providerName(
  join: { display_name: string } | { display_name: string }[] | null,
) {
  if (!join) return "—";
  if (Array.isArray(join)) return join[0]?.display_name ?? "—";
  return join.display_name;
}

function mapApp(row: AppJoin): DashboardAppRow {
  return {
    id: row.id,
    externalId: row.external_id,
    applicationType: row.application_type,
    path: row.path,
    status: row.status,
    subjectType: row.subject_type,
    attemptCount: row.attempt_count ?? 0,
    dueDate: row.due_date,
    providerId: row.provider_id,
    providerName: providerName(row.providers),
  };
}

function mapCred(row: CredJoin): DashboardCredentialRow {
  return {
    id: row.id,
    providerId: row.provider_id,
    providerName: providerName(row.providers),
    credentialType: row.credential_type,
    name: row.name,
    status: row.status,
    expiresAt: row.expires_at,
  };
}

async function countExact(
  query: PromiseLike<{
    count: number | null;
    error: { message: string } | null;
  }>,
) {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const sb = await createClient();
  const today = isoDate(new Date());
  const in90 = isoDate(addDays(new Date(), 90));
  const in120 = isoDate(addDays(new Date(), 120));

  const [
    providers,
    practitioners,
    facilities,
    incomplete,
    inReview,
    pendingCommittee,
    credentialsExpired,
    credentialsExpiringSoon,
    recredDue,
    recredOverdue,
    sanctionsFlagged,
    chaseRes,
    committeeRes,
    expiringRes,
    recredRes,
  ] = await Promise.all([
    countExact(sb.from("providers").select("*", { count: "exact", head: true })),
    countExact(
      sb
        .from("providers")
        .select("*", { count: "exact", head: true })
        .eq("subject_type", "practitioner"),
    ),
    countExact(
      sb
        .from("providers")
        .select("*", { count: "exact", head: true })
        .eq("subject_type", "facility"),
    ),
    countExact(
      sb
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("status", "incomplete"),
    ),
    countExact(
      sb
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("status", "in_review"),
    ),
    countExact(
      sb
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_committee"),
    ),
    countExact(
      sb
        .from("credentials")
        .select("*", { count: "exact", head: true })
        .or(`status.eq.expired,expires_at.lt.${today}`),
    ),
    countExact(
      sb
        .from("credentials")
        .select("*", { count: "exact", head: true })
        .or(
          `status.eq.expiring_soon,and(expires_at.gte.${today},expires_at.lte.${in90})`,
        ),
    ),
    countExact(
      sb
        .from("providers")
        .select("*", { count: "exact", head: true })
        .gte("recred_due_date", today)
        .lte("recred_due_date", in120),
    ),
    countExact(
      sb
        .from("providers")
        .select("*", { count: "exact", head: true })
        .lt("recred_due_date", today),
    ),
    countExact(
      sb
        .from("sanctions_checks")
        .select("*", { count: "exact", head: true })
        .not("result", "is", null)
        .not("result", "ilike", "clear"),
    ),
    sb
      .from("applications")
      .select(
        "id, external_id, application_type, path, status, subject_type, attempt_count, due_date, provider_id, providers(display_name)",
      )
      .eq("status", "incomplete")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    sb
      .from("applications")
      .select(
        "id, external_id, application_type, path, status, subject_type, attempt_count, due_date, provider_id, providers(display_name)",
      )
      .eq("status", "pending_committee")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    sb
      .from("credentials")
      .select(
        "id, provider_id, credential_type, name, status, expires_at, providers(display_name)",
      )
      .or(
        `status.eq.expired,status.eq.expiring_soon,and(expires_at.gte.${today},expires_at.lte.${in90}),expires_at.lt.${today}`,
      )
      .order("expires_at", { ascending: true, nullsFirst: false })
      .limit(8),
    sb
      .from("providers")
      .select(
        "id, display_name, subject_type, external_id, recred_due_date, status",
      )
      .lte("recred_due_date", in120)
      .order("recred_due_date", { ascending: true, nullsFirst: false })
      .limit(8),
  ]);

  if (chaseRes.error) throw new Error(chaseRes.error.message);
  if (committeeRes.error) throw new Error(committeeRes.error.message);
  if (expiringRes.error) throw new Error(expiringRes.error.message);
  if (recredRes.error) throw new Error(recredRes.error.message);

  return {
    counts: {
      providers,
      practitioners,
      facilities,
      incomplete,
      inReview,
      pendingCommittee,
      credentialsExpired,
      credentialsExpiringSoon,
      recredDue,
      recredOverdue,
      sanctionsFlagged,
    },
    chaseQueue: (chaseRes.data as AppJoin[]).map(mapApp),
    committeeQueue: (committeeRes.data as AppJoin[]).map(mapApp),
    expiringCredentials: (expiringRes.data as CredJoin[]).map(mapCred),
    recredQueue: (recredRes.data ?? []).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      subjectType: p.subject_type,
      externalId: p.external_id,
      recredDueDate: p.recred_due_date,
      status: p.status,
    })),
  };
}
