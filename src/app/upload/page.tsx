"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setImagePreview(null); setCompressedBlob(null);
    setCompressing(false); setSubmitted(false);
  };

  const compressImage = (file: File, maxPx = 1600, quality = 0.80): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/webp", quality);
        const base64 = dataUrl.split(",")[1];
        const bytes = atob(base64);
        const ab = new ArrayBuffer(bytes.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < bytes.length; i++) ia[i] = bytes.charCodeAt(i);
        resolve(new Blob([ab], { type: "image/webp" }));
      };
      img.onerror = reject;
      img.src = url;
    });

  const handleImageSelect = async (file: File) => {
    setCompressing(true);
    try {
      const blob = await compressImage(file);
      setCompressedBlob(blob);
      setImagePreview(URL.createObjectURL(blob));
    } catch {
      alert("Couldn't process that image. Please try another.");
    } finally {
      setCompressing(false);
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

  const handleSubmit = async () => {
    if (!compressedBlob) return;
    setSubmitting(true);
    try {
      const fileName = `${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("flyers").upload(fileName, compressedBlob, { contentType: "image/webp" });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("flyers").getPublicUrl(fileName);

      const { error: insertError } = await supabase.from("flyers").insert({
        title: "Untitled",
        entity: null,
        tags: null,
        image_url: publicUrl,
        status: "pending",
        hotspots: null,
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
            Flyer submitted!
          </h2>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 32 }}>
            Thanks for contributing. It will appear in the library once approved.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                fontSize: 13, color: "var(--text)", fontFamily: "var(--font-sans)",
                fontWeight: 500, padding: "8px 18px", borderRadius: 99,
                border: "1.5px solid var(--border)", background: "var(--surface)",
                cursor: "pointer", transition: "background 0.15s",
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
                cursor: "pointer", transition: "opacity 0.15s",
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

        {/* Header */}
        <div className="fade-up" style={{ animationDelay: "0.05s", marginBottom: 28 }}>
          <button
            onClick={() => router.push("/")}
            style={{
              fontSize: 13, color: "var(--text)", fontFamily: "var(--font-sans)",
              fontWeight: 500, padding: "8px 18px", borderRadius: 99,
              border: "1.5px solid var(--border)", background: "var(--surface)",
              cursor: "pointer", transition: "background 0.15s",
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
                Tap to take a photo or choose from your library
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)" }}>JPG, PNG, HEIC supported</p>
            </div>
          ) : (
            <div style={{ marginBottom: 24, borderRadius: 18, overflow: "hidden", border: "1px solid var(--border)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                <img src={imagePreview} alt="Flyer preview" style={{ width: "100%", display: "block" }} />
              </div>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
        </div>

        {/* Compression progress */}
        {compressing && (
          <div className="fade-up" style={{ marginBottom: 24 }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Processing…</p>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "60%", background: "var(--accent)", borderRadius: 99 }} />
            </div>
          </div>
        )}

        {/* Submit */}
        {compressedBlob && !compressing && (
          <div className="stagger-item" style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="submit-btn"
              style={{
                position: "relative", overflow: "hidden", isolation: "isolate",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 16px", borderRadius: 9999, border: "2px solid var(--border)",
                background: "var(--surface)", fontSize: 14,
                fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--text)",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.5 : 1,
                boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
                transition: "color 0.5s ease",
              }}
            >
              {submitting ? "Submitting…" : "Submit flyer"}
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
