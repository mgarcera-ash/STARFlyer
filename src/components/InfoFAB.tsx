"use client";
import { useState } from "react";

type Section = { heading: string; body: string };

export default function InfoFAB({ sections }: { sections: Section[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="How this works"
        style={{
          position: "fixed", bottom: 32, left: 24,
          width: 44, height: 44, borderRadius: "50%",
          border: "1.5px solid var(--border)",
          background: "var(--surface)",
          color: "var(--muted)",
          fontSize: 15, fontWeight: 600,
          fontFamily: "var(--font-sans)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          zIndex: 50,
          transition: "background 0.15s, color 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--bg)"; e.currentTarget.style.color = "var(--text)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--muted)"; }}
      >ℹ</button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.35)",
              zIndex: 100,
              animation: "fadeIn 0.15s ease both",
            }}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 24,
            padding: "24px 24px 20px",
            maxWidth: 400,
            width: "calc(100% - 48px)",
            zIndex: 101,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            animation: "fadeScale 0.2s var(--ease) both",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                How this works
              </p>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--muted)", fontSize: 20, lineHeight: 1,
                  padding: 4, display: "flex", alignItems: "center",
                }}
              >×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {sections.map((s) => (
                <div key={s.heading}>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                    {s.heading}
                  </p>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
