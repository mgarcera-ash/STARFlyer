"use client";
import { useState } from "react";
import type { Flyer } from "@/types/flyer";

export default function PosterCard({ flyer, onQuickLook, animationDelay = 0 }: { flyer: Flyer; onQuickLook: () => void; animationDelay?: number }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      className="stagger-item"
      onClick={onQuickLook}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        flexShrink: 0, width: 148, height: 224, borderRadius: 30, overflow: "hidden",
        cursor: "pointer", background: "#1c1c1e",
        position: "relative",
        transform: pressed ? "scale(0.97)" : "scale(1)", transition: "transform 0.15s ease",
        animationDelay: `${animationDelay}s`,
      }}
    >
      {flyer.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flyer.image_url} alt={flyer.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 40, fontWeight: 700, color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-sans)" }}>{flyer.title.charAt(0)}</span>
        </div>
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.85) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", maskImage: "linear-gradient(to bottom, transparent 35%, black 60%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 35%, black 60%)" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 11px 12px" }}>
        {flyer.entity && <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 600, color: "#fff", fontFamily: "var(--font-sans)" }}>{flyer.entity}</p>}
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#fff", fontFamily: "var(--font-sans)", lineHeight: 1.35 }}>{flyer.title}</p>
      </div>
    </div>
  );
}
