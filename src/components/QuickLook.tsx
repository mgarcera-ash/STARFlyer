"use client";
import { useEffect, useState } from "react";
import type { Flyer } from "@/types/flyer";

export default function QuickLook({ flyer, onClose, onExpand }: {
  flyer: Flyer;
  onClose: () => void;
  onExpand: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
    const handleKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 280);
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: open ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0)",
        backdropFilter: open ? "blur(6px)" : "blur(0px)",
        WebkitBackdropFilter: open ? "blur(6px)" : "blur(0px)",
        transition: "background 0.28s ease, backdrop-filter 0.28s ease",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%", maxWidth: 560,
          maxHeight: "85vh",
          background: "var(--surface)",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08)",
          display: "flex", flexDirection: "column",
          transform: open ? "scale(1) translateY(0)" : "scale(0.92) translateY(16px)",
          opacity: open ? 1 : 0,
          transition: "transform 0.32s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.28s ease",
        }}
      >
        <div
          onClick={() => { handleClose(); setTimeout(onExpand, 100); }}
          style={{ overflowY: "auto", flex: 1, cursor: "pointer", position: "relative" }}
        >
          <div style={{
            position: "absolute", top: 12, right: 12, zIndex: 10,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
            borderRadius: 99, padding: "5px 10px",
            display: "flex", alignItems: "center", gap: 5,
            pointerEvents: "none",
          }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M10 2h4v4M6 14H2v-4M14 2l-5.5 5.5M2 14l5.5-5.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#fff", fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>
              Tap again to expand more
            </span>
          </div>
          {flyer.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={flyer.image_url} alt={flyer.title} style={{ width: "100%", display: "block" }} />
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
              <span style={{ fontSize: 64, fontWeight: 700, color: "var(--accent)", opacity: 0.2, fontFamily: "var(--font-sans)" }}>
                {flyer.title.charAt(0)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
