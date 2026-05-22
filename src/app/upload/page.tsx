"use client";
import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import HotspotEditor, { Hotspot as HotspotType } from "@/components/HotspotEditor";

type OcrStatus = "idle" | "processing" | "done" | "error";

const emptyForm = () => ({ title: "" });

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [form, setForm] = useState(emptyForm());
  const [entity, setEntity] = useState("");
  const [entityOptions, setEntityOptions] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [hotspots, setHotspots] = useState<HotspotType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [progressMsg, setProgressMsg] = useState("Reading…");
  const [progressVisible, setProgressVisible] = useState(true);

  const PROGRESS_MESSAGES = ["Reading…", "Gathering…", "Reviewing…", "Thinking…", "Analyzing…"];

  useEffect(() => {
    if (ocrStatus !== "processing") return;
    let i = 0;
    const interval = setInterval(() => {
      setProgressVisible(false);
      setTimeout(() => {
        i = (i + 1) % PROGRESS_MESSAGES.length;
        setProgressMsg(PROGRESS_MESSAGES[i]);
        setProgressVisible(true);
      }, 300);
    }, 1800);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocrStatus]);

  // Load existing entity values for autocomplete
  useEffect(() => {
    supabase.from("flyers").select("entity").then(({ data }) => {
      const unique = Array.from(
        new Set((data ?? []).map((r: { entity: string | null }) => r.entity).filter(Boolean) as string[])
      ).sort();
      setEntityOptions(unique);
    });
  }, []);

  const reset = () => {
    setImageFile(null); setImagePreview(null);
    setOcrStatus("idle"); setOcrProgress(0);
    setForm(emptyForm()); setEntity(""); setTags([]); setTagInput(""); setHotspots([]);
  };

  const handleImageSelect = async (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setOcrStatus("processing");
    setOcrProgress(0);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setOcrProgress(50);

      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: file.type }),
      });

      setOcrProgress(100);
      const { ok, data } = await res.json();
      if (!ok) throw new Error("OCR failed");

      setForm({ title: data.title ?? "" });
      setTags(Array.isArray(data.tags) ? data.tags.map((t: string) => t.toLowerCase().trim()) : []);
      setHotspots(
        Array.isArray(data.hotspots)
          ? data.hotspots.map((h: { type: "phone" | "address"; label?: string; value: string }) => ({
              type: h.type,
              label: h.label ?? "",
              value: h.value,
            }))
          : []
      );
      setOcrStatus("done");
    } catch {
      setOcrStatus("error");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) handleImageSelect(file);
  };

  const addTag = (value: string) => {
    const cleaned = value.toLowerCase().trim();
    if (cleaned && !tags.includes(cleaned)) {
      setTags(prev => [...prev, cleaned]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  };

  const handleSubmit = async () => {
    if (!imageFile || !form.title.trim()) return;
    setSubmitting(true);
    try {
      const ext = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("flyers").upload(fileName, imageFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("flyers").getPublicUrl(fileName);

      const { error: insertError } = await supabase.from("flyers").insert({
        title: form.title.trim(),
        entity: entity.trim() || null,
        tags,
        image_url: publicUrl,
        status: "pending",
        hotspots: hotspots.length > 0 ? hotspots : null,
      });
      if (insertError) throw insertError;

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="stagger-item" style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
            Submitted for review
          </h2>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--text)", lineHeight: 1.6, marginBottom: 32 }}>
            Your flyer has been submitted and will appear in the library once approved.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                fontSize: 13, color: "var(--text)", fontFamily: "var(--font-sans)",
                fontWeight: 500, padding: "8px 18px", borderRadius: 99,
                border: "1.5px solid var(--border)", background: "var(--surface)",
                cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
            >Upload another</button>
            <button
              onClick={() => router.push("/")}
              style={{
                fontSize: 13, color: "#fff", fontFamily: "var(--font-sans)",
                fontWeight: 500, padding: "8px 18px", borderRadius: 99,
                border: "1.5px solid var(--text)", background: "var(--text)",
                cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >Home</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", padding: "48px 0 80px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", paddingLeft: 24, paddingRight: 24 }}>

        {/* Back button */}
        <div className="fade-up" style={{ animationDelay: "0.05s", marginBottom: 28 }}>
          <button onClick={() => router.push("/")} style={{
            fontSize: 13, color: "var(--text)", fontFamily: "var(--font-sans)",
            fontWeight: 500, padding: "8px 18px", borderRadius: 99,
            border: "1.5px solid var(--border)", background: "var(--surface)",
            cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            transition: "background 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
          >← Back</button>
        </div>

        {/* Upload zone */}
        <div className="fade-up" style={{ animationDelay: "0.08s" }}>
          {!imagePreview ? (
            <div
              onDrop={handleDrop} onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed var(--border)", borderRadius: 24,
                padding: "72px 24px", textAlign: "center", cursor: "pointer",
                marginBottom: 24, background: "rgba(0,0,0,0.02)",
                transition: "border-color 0.2s, background 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "rgba(44,95,138,0.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>📷</div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
                Tap to take a photo or upload
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text)" }}>JPG, PNG, HEIC supported</p>
            </div>
          ) : (
            <div style={{ position: "relative", marginBottom: 24, borderRadius: 18, overflow: "hidden", border: "1px solid var(--border)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                <img src={imagePreview} alt="Flyer preview" style={{ width: "100%", display: "block" }} />
              </div>
              <button onClick={reset} style={{
                position: "absolute", top: 10, right: 10,
                width: 32, height: 32, borderRadius: 99,
                background: "#ef4444", border: "1.5px solid #ef4444",
                color: "#fff", cursor: "pointer", fontSize: 16,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                transition: "background 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "#dc2626")}
                onMouseLeave={e => (e.currentTarget.style.background = "#ef4444")}
              >×</button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: "none" }} />
        </div>

        {/* OCR progress */}
        {ocrStatus === "processing" && (
          <div className="fade-up" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)", opacity: progressVisible ? 1 : 0, transition: "opacity 0.3s ease" }}>{progressMsg}</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)" }}>{ocrProgress}%</span>
            </div>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${ocrProgress}%`, background: "var(--accent)", borderRadius: 99, transition: "width 0.3s ease" }} />
            </div>
          </div>
        )}

        {ocrStatus === "done" && (
          <p className="fade-up" style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 24 }}>
            Review carefully before submission. Add more tags, contacts, or addresses if needed.
          </p>
        )}

        {/* Form */}
        {(ocrStatus === "done" || ocrStatus === "error") && (
          <div className="stagger-item" style={{ display: "flex", flexDirection: "column", gap: 40 }}>

            <Field label="Organization / Agency" hint="Who made this flyer?">
              <input
                type="text"
                list="entity-options"
                value={entity}
                onChange={e => setEntity(e.target.value)}
                placeholder="e.g. DFSS, Thresholds, NAMI Chicago"
                style={inputStyle}
              />
              <datalist id="entity-options">
                {entityOptions.map(opt => <option key={opt} value={opt} />)}
              </datalist>
            </Field>

            <Field label="Title" required>
              <input type="text" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Crisis Behavioral Health Clinicians"
                style={inputStyle} />
            </Field>

            {/* Tag chip input */}
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
                    borderRadius: 99, fontFamily: "var(--font-sans)",
                    whiteSpace: "nowrap",
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

            <button
              onClick={handleSubmit}
              disabled={submitting || !form.title.trim()}
              className="submit-btn"
              style={{
                position: "relative", overflow: "hidden", isolation: "isolate",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                alignSelf: "flex-end", marginTop: 8, padding: "10px 16px",
                borderRadius: 9999, border: "2px solid var(--border)",
                background: "var(--surface)", fontSize: 14,
                fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--text)",
                cursor: submitting || !form.title.trim() ? "not-allowed" : "pointer",
                opacity: submitting || !form.title.trim() ? 0.5 : 1,
                boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
                transition: "color 0.5s ease",
              }}
            >
              {submitting ? "Submitting…" : "Submit for review"}
              <svg
                className="submit-icon"
                width="32" height="32"
                viewBox="0 0 16 19"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  borderRadius: 9999, border: "1.5px solid var(--border)",
                  padding: 7, transform: "rotate(45deg)", flexShrink: 0,
                  transition: "transform 0.3s ease, background 0.3s ease, border-color 0.3s ease",
                  boxSizing: "border-box",
                }}
              >
                <path
                  d="M7 18C7 18.5523 7.44772 19 8 19C8.55228 19 9 18.5523 9 18H7ZM8.70711 0.292893C8.31658 -0.0976311 7.68342 -0.0976311 7.29289 0.292893L0.928932 6.65685C0.538408 7.04738 0.538408 7.68054 0.928932 8.07107C1.31946 8.46159 1.95262 8.46159 2.34315 8.07107L8 2.41421L13.6569 8.07107C14.0474 8.46159 14.6805 8.46159 15.0711 8.07107C15.4616 7.68054 15.4616 7.04738 15.0711 6.65685L8.70711 0.292893ZM9 18L9 1H7L7 18H9Z"
                  fill="#1a1916"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </main>
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

function btnStyle(variant: "primary" | "secondary"): React.CSSProperties {
  return {
    padding: "10px 20px", borderRadius: 10, fontSize: 13,
    fontFamily: "var(--font-sans)", fontWeight: 500,
    border: variant === "primary" ? "none" : "1px solid var(--border)",
    background: variant === "primary" ? "var(--text)" : "transparent",
    color: variant === "primary" ? "#fff" : "var(--muted)",
    cursor: "pointer", transition: "opacity 0.15s",
  };
}
