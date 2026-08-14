import { NextResponse } from "next/server";
import {
  ensureRequirements,
  getPsvDashboard,
  runPsvForApplication,
} from "@/lib/psv/orchestrator";
import { syncPsvResultsToSalesforce } from "@/lib/salesforce/psvSync";
import { createServiceClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get("applicationId");
  if (!applicationId) {
    return NextResponse.json(
      { error: "applicationId is required" },
      { status: 400 },
    );
  }

  try {
    const dashboard = await getPsvDashboard(applicationId);
    return NextResponse.json(dashboard);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to load PSV dashboard" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      applicationId?: string;
      action?: "ensure_requirements" | "run_psv";
    };

    if (!body.applicationId) {
      return NextResponse.json(
        { error: "applicationId is required" },
        { status: 400 },
      );
    }

    if (body.action === "ensure_requirements") {
      const requirements = await ensureRequirements(body.applicationId);
      return NextResponse.json({ requirements });
    }

    const result = await runPsvForApplication(body.applicationId);
    const salesforce = await syncPsvResultsToSalesforce(body.applicationId);
    return NextResponse.json({ ...result, salesforce });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PSV run failed" },
      { status: 500 },
    );
  }
}

/** List applications that have PSV fields for the ops index. */
export async function PUT() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, external_id, status, psv_status, readiness_score, psv_ran_at, profession, license_state, providers(display_name, npi)",
    )
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ applications: data ?? [] });
}
