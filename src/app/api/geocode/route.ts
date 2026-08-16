import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/nominatim";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const address = typeof body?.address === "string" ? body.address.trim() : "";

  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  try {
    const result = await geocodeAddress(address);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Geocoding failed" },
      { status: 502 }
    );
  }
}
