/**
 * One-time script: compress existing flyer images already in Supabase storage.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npx tsx scripts/compress-existing-images.ts
 *
 * What it does:
 *   1. Fetches all approved flyers with an image_url
 *   2. Downloads each image
 *   3. Compresses to max 1600px / JPEG 82% quality (same as upload page)
 *   4. Overwrites the file in Supabase storage (same filename → same URL)
 *   5. Skips files that are already small enough (< 200 KB)
 *
 * The image_url in the database does NOT need updating — the filename stays the same.
 */

import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const MAX_PX = 1600;
const QUALITY = 82;
const SKIP_BELOW_BYTES = 200 * 1024; // skip files already under 200 KB

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function compress(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer);
  const meta = await image.metadata();
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  const scale = longest > MAX_PX ? MAX_PX / longest : 1;

  return image
    .resize(
      Math.round((meta.width ?? MAX_PX) * scale),
      Math.round((meta.height ?? MAX_PX) * scale),
    )
    .jpeg({ quality: QUALITY })
    .toBuffer();
}

function filenameFromUrl(url: string): string {
  // Supabase public URL ends with /storage/v1/object/public/flyers/<filename>
  const parts = url.split("/flyers/");
  if (parts.length < 2) throw new Error(`Unexpected URL format: ${url}`);
  return decodeURIComponent(parts[1]);
}

async function run() {
  const { data: flyers, error } = await supabase
    .from("flyers")
    .select("id, title, image_url")
    .eq("status", "approved")
    .not("image_url", "is", null);

  if (error) throw error;
  if (!flyers?.length) { console.log("No flyers found."); return; }

  console.log(`Found ${flyers.length} flyers. Starting compression...\n`);

  let skipped = 0, compressed = 0, failed = 0;

  for (const flyer of flyers) {
    const url = flyer.image_url as string;
    process.stdout.write(`[${flyer.id.slice(0, 8)}] ${flyer.title.slice(0, 40).padEnd(40)} `);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const original = Buffer.from(await res.arrayBuffer());

      if (original.byteLength < SKIP_BELOW_BYTES) {
        console.log(`skipped (${(original.byteLength / 1024).toFixed(0)} KB — already small)`);
        skipped++;
        continue;
      }

      const smaller = await compress(original);
      const saving = ((1 - smaller.byteLength / original.byteLength) * 100).toFixed(0);

      const filename = filenameFromUrl(url);
      const { error: uploadError } = await supabase.storage
        .from("flyers")
        .upload(filename, smaller, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      console.log(`${(original.byteLength / 1024).toFixed(0)} KB → ${(smaller.byteLength / 1024).toFixed(0)} KB (${saving}% smaller)`);
      compressed++;
    } catch (err) {
      console.log(`FAILED — ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. Compressed: ${compressed}  Skipped: ${skipped}  Failed: ${failed}`);
}

run().catch(err => { console.error(err); process.exit(1); });
