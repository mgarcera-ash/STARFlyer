import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RawRow = Record<string, string>;

function clean(val: string | undefined): string | null {
  const s = val?.trim();
  return s || null;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("admin-token")?.value;
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set." }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { rows }: { rows: RawRow[] } = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const stations = rows.map((r) => ({
      district:      clean(r["DISTRICT"]),
      district_name: clean(r["DISTRICT NAME"]),
      address:       clean(r["ADDRESS"]),
      zip:           clean(r["ZIP"]),
      website:       clean(r["WEBSITE"]),
      phone:         clean(r["PHONE"]),
      lat:           r["LATITUDE"]  ? parseFloat(r["LATITUDE"])  : null,
      lng:           r["LONGITUDE"] ? parseFloat(r["LONGITUDE"]) : null,
    })).filter((s) => s.district !== null);

    const { error } = await supabaseAdmin
      .from("police_stations")
      .upsert(stations, { onConflict: "district" });

    if (error) {
      console.error("Supabase upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: stations.length });
  } catch (err) {
    console.error("Unhandled error in /api/stations/load:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}
