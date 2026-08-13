import { NextResponse } from "next/server";
import { listProviders } from "@/lib/providers";
import type { SubjectType } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get("type");
    const type: SubjectType | "all" =
      raw === "practitioner" || raw === "facility" ? raw : "all";
    const providers = await listProviders(type);
    return NextResponse.json({ data: providers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
