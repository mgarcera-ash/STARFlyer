import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { base64 } = await req.json();

    // ── Step 1: Google Cloud Vision — extract full text ───────────────────────
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_CLOUD_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          }],
        }),
      }
    );

    const visionData = await visionRes.json();
    const fullText: string = visionData.responses?.[0]?.textAnnotations?.[0]?.description ?? "";

    // ── Step 2: GPT-4o-mini — title, tags, phones, addresses ─────────────────
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `You are tagging resource flyers for a social services library used by social workers.
The following text was extracted from a flyer:

---
${fullText}
---

Return ONLY valid JSON — no markdown, no code blocks:
{
  "title": "a short action-first description of what this resource helps someone do or get — lead with a verb or outcome, not the program name (e.g. 'Find emergency shelter tonight', 'Report trafficking and get help', 'Apply for rental assistance'). Use simple, plain language a 9th grader can understand. Avoid jargon, clinical terms, or complex words. 5 to 10 words.",
  "tags": ["5 to 10 short lowercase tags"],
  "phones": [{ "label": "name or organization this number belongs to", "value": "phone number exactly as written" }],
  "sms": [{ "label": "name or organization this number belongs to", "value": "short code or SMS number exactly as written" }],
  "emails": [{ "label": "name or organization this email belongs to", "value": "email address exactly as written" }],
  "addresses": [{ "label": "name or location this address belongs to", "value": "street address exactly as written" }],
  "websites": [{ "label": "name or organization this website belongs to", "value": "URL exactly as written" }]
}

For tags, be generous — apply every category that reasonably fits. Draw from this taxonomy:

MENTAL HEALTH & BEHAVIORAL: mental health, behavioral health, counseling, therapy, crisis, psychiatric, substance use, recovery, addiction, detox, dual diagnosis
HOUSING & SHELTER: housing, shelter, emergency shelter, transitional housing, rent assistance, eviction, homelessness
FOOD & NUTRITION: food, nutrition, food bank, SNAP, meals, hunger, groceries
HEALTHCARE: healthcare, medical, insurance, Medicaid, dental, vision, clinic
EMPLOYMENT & INCOME: employment, job training, workforce, career, financial assistance, benefits
LEGAL & IMMIGRATION: legal, immigration, rights, court, asylum, deportation
FAMILY & SAFETY: family, domestic violence, parenting, childcare, foster care, child welfare
YOUTH & EDUCATION: youth, children, school, tutoring, after school, teen
SENIORS & DISABILITY: seniors, elderly, disability, accessibility, memory care
CRISIS & EMERGENCY: crisis, hotline, emergency, 988, suicide prevention, safe house
IDENTITY & LANGUAGE: LGBTQ+, español, bilingual, veterans, refugee, reentry

If the flyer is about shelter but also mentions mental health, crisis services, or behavioral health — tag all of them. Do not leave out adjacent or implied services.

For phones: list every phone number with its associated name or organization as the label. If none, return [].
For sms: list every SMS short code or text number (e.g. "text HELLO to 233733") with its label. If none, return [].
For emails: list every email address with its associated name or organization as the label. If none, return [].
For addresses: list every street address with its associated location or organization name as the label. If none, return [].
For websites: list every website URL with its associated name or organization as the label. If none, return [].`,
      }],
      max_tokens: 1500,
    });

    const raw = gptResponse.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw);

    // ── Step 3: Build hotspots (type + label + value) ────────────────────────
    type Hotspot = { type: "phone" | "sms" | "email" | "address" | "website"; label?: string; value: string };
    const mapItems = (items: unknown[], type: Hotspot["type"]): Hotspot[] =>
      (items ?? []).map((item: unknown) =>
        typeof item === "string"
          ? { type, value: item }
          : { type, label: (item as { label?: string }).label, value: (item as { value?: string }).value ?? "" }
      );

    const hotspots: Hotspot[] = [
      ...mapItems(parsed.phones ?? [], "phone"),
      ...mapItems(parsed.sms ?? [], "sms"),
      ...mapItems(parsed.emails ?? [], "email"),
      ...mapItems(parsed.addresses ?? [], "address"),
      ...mapItems(parsed.websites ?? [], "website"),
    ];

    return NextResponse.json({
      ok: true,
      data: { title: parsed.title, tags: parsed.tags, hotspots },
    });
  } catch (err) {
    console.error("OCR error:", err);
    return NextResponse.json({ ok: false, error: "OCR failed" }, { status: 500 });
  }
}
