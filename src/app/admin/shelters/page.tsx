"use client";
import { useRef, useState } from "react";
import Papa from "papaparse";

type Status = "idle" | "parsing" | "ready" | "loading" | "done" | "error";

type RawRow = Record<string, string>;

function deduplicate(rows: RawRow[]): RawRow[] {
  const bysite = new Map<string, RawRow>();
  for (const row of rows) {
    const id = row["Site ID"];
    if (!id) continue;
    const existing = bysite.get(id);
    if (!existing || new Date(row["Date"]) > new Date(existing["Date"])) {
      bysite.set(id, row);
    }
  }
  return Array.from(bysite.values());
}

export default function SheltersAdminPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [siteCount, setSiteCount] = useState(0);
  const [upsertedCount, setUpsertedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [deduped, setDeduped] = useState<RawRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoClosing, setInfoClosing] = useState(false);

  const closeInfo = () => {
    setInfoClosing(true);
    setTimeout(() => { setInfoOpen(false); setInfoClosing(false); }, 180);
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setStatus("error");
      setErrorMsg("Please select a CSV file.");
      return;
    }
    setFileName(file.name);
    setStatus("parsing");

    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = deduplicate(result.data);
        setDeduped(rows);
        setSiteCount(rows.length);
        setStatus("ready");
      },
      error: () => {
        setStatus("error");
        setErrorMsg("Failed to parse CSV. Make sure it's a valid DFSS export.");
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleLoad = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/shelters/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: deduped }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setUpsertedCount(data.count);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const reset = () => {
    setStatus("idle");
    setDeduped([]);
    setSiteCount(0);
    setFileName("");
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <main style={{ minHeight: "100vh", padding: "48px 0 80px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", paddingLeft: 24, paddingRight: 24 }}>

        {/* Header */}
        <div className="fade-up" style={{ animationDelay: "0.05s", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
          <a
            href="/admin"
            style={{
              fontSize: 13, color: "var(--text)", fontFamily: "var(--font-sans)",
              textDecoration: "none", fontWeight: 500, padding: "8px 18px",
              borderRadius: 99, border: "1.5px solid var(--border)",
              background: "var(--surface)", transition: "background 0.15s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
          >← Admin</a>
          <button
            onClick={() => setInfoOpen(true)}
            aria-label="How this works"
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "1.5px solid var(--border)",
              background: "var(--surface)",
              color: "var(--muted)", fontSize: 14, fontWeight: 600,
              fontFamily: "var(--font-sans)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--muted)"; }}
          >ℹ</button>
        </div>

        {/* Done state */}
        {status === "done" && (
          <div className="stagger-item" style={{ textAlign: "center", padding: "64px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
              {upsertedCount} shelters loaded
            </h2>
            <p style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-sans)", marginBottom: 32 }}>
              The shelters table is up to date.
            </p>
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
            >Load another</button>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="stagger-item" style={{ textAlign: "center", padding: "64px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontSize: 14, color: "var(--danger)", fontFamily: "var(--font-sans)", marginBottom: 24 }}>
              {errorMsg}
            </p>
            <button
              onClick={reset}
              style={{
                fontSize: 13, color: "var(--text)", fontFamily: "var(--font-sans)",
                fontWeight: 500, padding: "8px 18px", borderRadius: 99,
                border: "1.5px solid var(--border)", background: "var(--surface)",
                cursor: "pointer",
              }}
            >Try again</button>
          </div>
        )}

        {/* Upload zone */}
        {(status === "idle" || status === "parsing") && (
          <div className="fade-up" style={{ animationDelay: "0.08s" }}>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed var(--border)", borderRadius: 24,
                padding: "72px 24px", textAlign: "center", cursor: "pointer",
                background: "rgba(0,0,0,0.02)", transition: "border-color 0.2s, background 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "rgba(44,95,138,0.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
            >
              {status === "parsing" ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                    Parsing…
                  </p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
                    Drop CSV here or tap to select
                  </p>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)" }}>
                    DFSS Shelter Bed Availability export
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              style={{ display: "none" }}
            />
          </div>
        )}

        {/* Ready to load */}
        {status === "ready" && (
          <div className="stagger-item" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{
              border: "1px solid var(--border)", borderRadius: 16,
              padding: "20px 24px", background: "var(--surface)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                {fileName}
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--muted)" }}>
                {siteCount} unique sites found after deduplication
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleLoad}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 99,
                  border: "none", background: "var(--text)", color: "#fff",
                  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", transition: "opacity 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Load into Supabase
              </button>
              <button
                onClick={reset}
                style={{
                  padding: "10px 20px", borderRadius: 99,
                  border: "1.5px solid var(--border)", background: "var(--surface)",
                  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
                  color: "var(--text)", cursor: "pointer",
                }}
              >Cancel</button>
            </div>
          </div>
        )}

        {/* Loading */}
        {status === "loading" && (
          <div className="fade-up" style={{ textAlign: "center", padding: "64px 0" }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--muted)" }}>
              Loading{" "}
              <span className="loading-dot">.</span>
              <span className="loading-dot">.</span>
              <span className="loading-dot">.</span>
            </p>
          </div>
        )}

      </div>
      {infoOpen && (
        <div
          role="presentation"
          onClick={closeInfo}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
            animation: infoClosing ? "fadeOut 0.18s ease forwards" : "fadeIn 0.2s ease forwards",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="How this works"
            onClick={e => e.stopPropagation()}
            style={{
              background: "#1c1c1e",
              borderRadius: 28,
              border: "1.5px solid rgba(255,255,255,0.1)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
              width: "100%", maxWidth: 380,
              padding: "28px 28px 24px",
              animation: infoClosing ? "fadeScaleOut 0.18s ease forwards" : "fadeScale 0.22s cubic-bezier(0.34,1.4,0.64,1) forwards",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "#fff", fontFamily: "var(--font-sans)", letterSpacing: "-0.02em" }}>
                How this works
              </p>
              <button
                onClick={closeInfo}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(255,255,255,0.1)", border: "none",
                  color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-sans)",
                }}
              >✕</button>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-sans)", lineHeight: 1.65 }}>
              When you select the CSV, the browser&apos;s File API reads it from your hard drive into memory without uploading it. papaparse converts raw bytes into structured rows. Then JavaScript loops through every row, tracks each shelter&apos;s Site ID, and keeps only the most recent entry. The cleaned records are then sent to the database. New shelters are added, existing ones are updated. Safe to run at different intervals.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
