"use client";
import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { supabase } from "@/lib/supabase";
import HotspotEditor, { Hotspot } from "@/components/HotspotEditor";
import SignOutButton from "@/components/SignOutButton";

type Flyer = {
  id: string;
  title: string;
  entity: string | null;
  description: string | null;
  tags: string[] | null;
  image_url: string | null;
  status: string;
  created_at: string;
  hotspots: Hotspot[] | null;
};

export default function AdminPage() {
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [entityOptions, setEntityOptions] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const [{ data: flyerData }, { data: entityData }] = await Promise.all([
        supabase.from("flyers").select("*").eq("status", "pending").order("created_at", { ascending: true }),
        supabase.from("flyers").select("entity"),
      ]);
      setFlyers(flyerData || []);
      const unique = Array.from(
        new Set((entityData ?? []).map((r: { entity: string | null }) => r.entity).filter(Boolean) as string[])
      ).sort();
      setEntityOptions(unique);
      setLoading(false);
      setVisible(true);
    }
    load();
  }, []);

  const remove = (id: string) => setFlyers(prev => prev.filter(f => f.id !== id));

  return (
    <main style={{ minHeight: "100vh", padding: "48px 0 80px", opacity: visible ? 1 : 0, transition: "opacity 0.4s ease" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", paddingLeft: 24, paddingRight: 24 }}>

        {/* Header */}
        <div className="fade-up" style={{ animationDelay: "0.05s", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Review Queue
            </h1>
            <p style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-sans)", marginTop: 2 }}>
              {loading ? "Loading…" : `${flyers.length} pending ${flyers.length === 1 ? "flyer" : "flyers"}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a href="/" style={{
              fontSize: 13, color: "var(--text)", fontFamily: "var(--font-sans)",
              textDecoration: "none", fontWeight: 500, padding: "8px 18px",
              borderRadius: 99, border: "1.5px solid var(--border)",
              background: "var(--surface)", transition: "background 0.15s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
            >← Library</a>
            <SignOutButton />
          </div>
        </div>

        {/* Empty state */}
        {!loading && flyers.length === 0 && (
          <div className="stagger-item" style={{ textAlign: "center", padding: "64px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--muted)" }}>
              All caught up — no pending flyers.
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {flyers.map((flyer, i) => (
            <FlyerEditCard
              key={flyer.id}
              flyer={flyer}
              animationDelay={i * 0.08}
              entityOptions={entityOptions}
              onDone={remove}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

// ── Per-flyer editable card ───────────────────────────────────────────────────
function FlyerEditCard({ flyer, animationDelay, entityOptions, onDone }: {
  flyer: Flyer;
  animationDelay: number;
  entityOptions: string[];
  onDone: (id: string) => void;
}) {
  const tagInputRef = useRef<HTMLInputElement>(null);

  const [entity, setEntity] = useState(flyer.entity ?? "");
  const [title, setTitle] = useState(flyer.title);
  const [tags, setTags] = useState<string[]>(flyer.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [hotspots, setHotspots] = useState<Hotspot[]>(
    (flyer.hotspots ?? []).map(h => ({ type: h.type, label: h.label ?? "", value: h.value }))
  );
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);

  const addTag = (value: string) => {
    const cleaned = value.toLowerCase().trim();
    if (cleaned && !tags.includes(cleaned)) setTags(prev => [...prev, cleaned]);
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
    else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) setTags(prev => prev.slice(0, -1));
  };

  const save = async (status: "approved" | "rejected") => {
    setActing(status === "approved" ? "approve" : "reject");
    await supabase.from("flyers").update({
      entity: entity.trim() || null,
      title: title.trim(),
      tags,
      hotspots: hotspots.length > 0 ? hotspots : null,
      status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    }).eq("id", flyer.id);
    onDone(flyer.id);
  };

  return (
    <div
      className="stagger-item"
      style={{
        animationDelay: `${animationDelay}s`,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 24, overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Image — display only */}
      {flyer.image_url && (
        <div style={{ width: "100%", maxHeight: 280, overflowY: "auto", background: "var(--bg)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={flyer.image_url} alt={flyer.title} style={{ width: "100%", display: "block" }} />
        </div>
      )}

      {/* Editable fields */}
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 40 }}>

        <Field label="Organization / Agency" hint="Who made this flyer?">
          <input
            type="text"
            list={`entity-options-${flyer.id}`}
            value={entity}
            onChange={e => setEntity(e.target.value)}
            placeholder="e.g. DFSS, Thresholds, NAMI Chicago"
            style={inputStyle}
          />
          <datalist id={`entity-options-${flyer.id}`}>
            {entityOptions.map(opt => <option key={opt} value={opt} />)}
          </datalist>
        </Field>

        <Field label="Title" required>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Crisis Behavioral Health Clinicians"
            style={inputStyle}
          />
        </Field>

        <Field label="Tags" hint="Press Enter after each tag to add it">
          <div
            onClick={() => tagInputRef.current?.focus()}
            style={{
              ...inputStyle, cursor: "text",
              display: "flex", flexWrap: "wrap", gap: 6,
              minHeight: 44, padding: "8px 12px", alignItems: "center",
            }}
          >
            {tags.map(tag => (
              <span key={tag} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "var(--accent)", color: "#fff",
                fontSize: 11, fontWeight: 500, padding: "3px 10px",
                borderRadius: 99, fontFamily: "var(--font-sans)", whiteSpace: "nowrap",
              }}>
                {tag}
                <button onClick={e => { e.stopPropagation(); removeTag(tag); }} style={{
                  background: "none", border: "none", color: "rgba(255,255,255,0.7)",
                  cursor: "pointer", padding: 0, fontSize: 13, lineHeight: 1,
                  display: "flex", alignItems: "center",
                }}>×</button>
              </span>
            ))}
            <input
              ref={tagInputRef}
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
              placeholder={tags.length === 0 ? "mental health, crisis, shelter…" : ""}
              style={{
                border: "none", outline: "none", background: "transparent",
                fontSize: 13, fontFamily: "var(--font-sans)", color: "var(--text)",
                flexGrow: 1, minWidth: 80,
              }}
            />
          </div>
        </Field>

        <Field label="Contacts" hint="Phones and addresses found on the flyer. Tap the icon to switch between types.">
          <HotspotEditor hotspots={hotspots} onChange={setHotspots} />
        </Field>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            onClick={() => save("approved")}
            disabled={!!acting || !title.trim()}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 99,
              border: "none", background: "var(--text)", color: "#fff",
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
              cursor: acting || !title.trim() ? "not-allowed" : "pointer",
              opacity: acting || !title.trim() ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {acting === "approve" ? "Saving…" : "✓ Save & Approve"}
          </button>
          <button
            onClick={() => save("rejected")}
            disabled={!!acting}
            style={{
              padding: "10px 20px", borderRadius: 99,
              border: "1.5px solid #ef4444", background: "transparent",
              color: "#ef4444", fontFamily: "var(--font-sans)",
              fontSize: 13, fontWeight: 600, cursor: acting ? "not-allowed" : "pointer",
              opacity: acting ? 0.5 : 1,
            }}
          >
            {acting === "reject" ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div>
        <label style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
          {label}{required && <span style={{ color: "var(--accent)", marginLeft: 2 }}>*</span>}
        </label>
        {hint && <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 400, color: "var(--muted)", margin: "2px 0 0" }}>{hint}</p>}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--surface)",
  fontSize: 13, fontFamily: "var(--font-sans)", color: "var(--text)",
  outline: "none", appearance: "none",
};
