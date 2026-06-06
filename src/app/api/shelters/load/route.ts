import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RawRow = Record<string, string>;

function parsePoint(wkt: string): { lat: number | null; lng: number | null } {
  const m = wkt?.match(/POINT \(([+-]?\d+\.?\d*) ([+-]?\d+\.?\d*)\)/);
  if (!m) return { lat: null, lng: null };
  return { lat: parseFloat(m[2]), lng: parseFloat(m[1]) }; // WKT order is lng lat
}

function clean(val: string | undefined): string | null {
  const s = val?.trim();
  return s || null;
}

function toInt(val: string | undefined): number | null {
  const n = parseInt(val ?? "");
  return isNaN(n) ? null : n;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("admin-token")?.value;
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set in environment variables." }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { rows }: { rows: RawRow[] } = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const shelters = rows.map((r) => {
      const { lat, lng } = parsePoint(r["Location"] ?? "");
      return {
        site_id:      toInt(r["Site ID"]),
        agency:       clean(r["Agency"]),
        site_name:    clean(r["Site Name"]),
        population:   clean(r["Population"]),
        shelter_type: clean(r["Shelter Type"]),
        address:      clean(r["Address"]),
        phone:        clean(r["Intake Number"]),
        ward:         toInt(r["Ward"]),
        geography:    clean(r["Geography"]),
        capacity:     toInt(r["Capacity"]),
        lat,
        lng,
        csv_date:     r["Date"] ? new Date(r["Date"]).toISOString().split("T")[0] : null,
      };
    }).filter((s) => s.site_id !== null);

    const { error } = await supabaseAdmin
      .from("shelters")
      .upsert(shelters, { onConflict: "site_id" });

    if (error) {
      console.error("Supabase upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: shelters.length });
  } catch (err) {
    console.error("Unhandled error in /api/shelters/load:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}
