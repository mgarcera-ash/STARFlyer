import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const toRad = (d: number) => (d * Math.PI) / 180;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const radius = parseFloat(searchParams.get("radius") ?? "2");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  // Bounding box: ~2 miles at Chicago latitude
  const latDelta = radius / 69;
  const lngDelta = radius / (69 * Math.cos(toRad(lat)));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase
    .from("shelters")
    .select("*")
    .gte("lat", lat - latDelta)
    .lte("lat", lat + latDelta)
    .gte("lng", lng - lngDelta)
    .lte("lng", lng + lngDelta)
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const shelters = (data ?? [])
    .map((s) => ({ ...s, distance: haversine(lat, lng, s.lat, s.lng) }))
    .filter((s) => s.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  return NextResponse.json({ shelters });
}
