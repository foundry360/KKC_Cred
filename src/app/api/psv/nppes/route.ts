import { NextResponse } from "next/server";
import { NPIProvider } from "@/lib/psv/providers/nppes";

/** Direct LIVE NPPES lookup for demos / debugging. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const npi = searchParams.get("npi");
  if (!npi) {
    return NextResponse.json({ error: "npi is required" }, { status: 400 });
  }

  try {
    const provider = new NPIProvider();
    const result = await provider.verify({
      applicationId: "lookup",
      requirementType: "npi_verification",
      npi,
      firstName: searchParams.get("firstName"),
      lastName: searchParams.get("lastName"),
      licenseState: searchParams.get("state"),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "NPPES lookup failed" },
      { status: 500 },
    );
  }
}
