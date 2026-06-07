/**
 * One-time script: geocode address hotspots on existing approved flyers.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-geocode.ts
 *
 * What it does:
 *   1. Fetches all approved flyers with hotspots
 *   2. Finds address hotspots that are missing lat/lng
 *   3. Geocodes each address via Photon (komoot), scoped to Chicago
 *   4. Writes lat/lng back into the hotspot entry in Supabase
 *
 * Safe to re-run — skips addresses that already have coordinates.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CHICAGO_BBOX = "-87.94,41.64,-87.52,42.02";
const DELAY_MS = 250; // stay well under Photon's rate limit

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

type Hotspot = {
  type: string;
  label?: string;
  value: string;
  lat?: number;
  lng?: number;
};

type Flyer = {
  id: string;
  hotspots: Hotspot[];
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1&bbox=${CHICAGO_BBOX}&lang=en`;
    const res = await fetch(url);
    const data = await res.json();
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords) return null;
    const [lng, lat] = coords;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data, error } = await supabase
    .from("flyers")
    .select("id, hotspots")
    .eq("status", "approved")
    .not("hotspots", "is", null);

  if (error) { console.error("Fetch error:", error.message); process.exit(1); }

  const flyers: Flyer[] = (data ?? []).filter((f: Flyer) =>
    f.hotspots.some(h => h.type === "address" && h.lat === undefined)
  );

  console.log(`Found ${flyers.length} flyer(s) with ungeocoded addresses.\n`);

  let geocoded = 0;
  let skipped = 0;
  let failed = 0;

  for (const flyer of flyers) {
    let changed = false;

    const enriched = await Promise.all(flyer.hotspots.map(async (h, i) => {
      if (h.type !== "address" || h.lat !== undefined || !h.value.trim()) return h;

      await sleep(i * DELAY_MS); // stagger concurrent calls within a flyer
      const coords = await geocode(h.value);

      if (coords) {
        console.log(`  ✓ "${h.value}" → ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
        geocoded++;
        changed = true;
        return { ...h, ...coords };
      } else {
        console.log(`  ✗ "${h.value}" — no result`);
        failed++;
        return h;
      }
    }));

    if (!changed) { skipped++; continue; }

    const { error: updateError } = await supabase
      .from("flyers")
      .update({ hotspots: enriched })
      .eq("id", flyer.id);

    if (updateError) {
      console.error(`  ! Failed to update flyer ${flyer.id}:`, updateError.message);
    } else {
      console.log(`  → Flyer ${flyer.id} updated.\n`);
    }

    await sleep(DELAY_MS); // pause between flyers
  }

  console.log(`\nDone. Geocoded: ${geocoded} | Failed: ${failed} | Already done: ${skipped}`);
}

main();
