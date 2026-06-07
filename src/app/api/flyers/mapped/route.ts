import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Hotspot = { type: string; label?: string; value: string; lat?: number; lng?: number };

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase
    .from("flyers")
    .select("id, title, entity, image_url, hotspots")
    .eq("status", "approved")
    .not("hotspots", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep only flyers that have at least one geocoded address hotspot
  const mapped = (data ?? []).filter((f: { hotspots: Hotspot[] }) =>
    f.hotspots.some(h => h.type === "address" && h.lat !== undefined && h.lng !== undefined)
  );

  return NextResponse.json({ flyers: mapped });
}
